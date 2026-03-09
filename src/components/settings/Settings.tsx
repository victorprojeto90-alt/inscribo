import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, supabase } from '../../lib/supabase'
import type { User } from '../../lib/supabase'
import {
  Building2, Users, MessageCircle, Bell,
  Save, Upload, Plus, X, Check, Wifi, WifiOff,
  Eye, EyeOff, ToggleLeft, ToggleRight, Loader2
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SchoolForm {
  name: string
  cnpj: string
  address: string
  phone: string
  email: string
  website: string
  logo_url: string
  meta_enrollments: number
  meta_cpa: number
  meta_reenrollment: number
}

interface InviteForm {
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
}

interface WaConfig {
  api_url: string
  api_key: string
  instance_name: string
}

type WaStatus = 'idle' | 'testing' | 'connected' | 'disconnected'

interface NotifSetting {
  id: string
  label: string
  enabled: boolean
  channel: 'email' | 'whatsapp' | 'both'
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  user: 'Atendente',
}

const TABS = [
  { id: 'school',  label: 'Minha Escola', icon: Building2    },
  { id: 'users',   label: 'Usuários',     icon: Users        },
  { id: 'wa',      label: 'WhatsApp',     icon: MessageCircle },
  { id: 'notifs',  label: 'Notificações', icon: Bell         },
]

const LOCAL_KEY = (id: string) => `inscribo_settings_${id}`

// ─── Component ───────────────────────────────────────────────────────────────

export default function Settings() {
  const { user, signUp } = useAuth()
  const [activeTab, setActiveTab] = useState('school')
  const fileRef = useRef<HTMLInputElement>(null)

  // Tab 1 – School
  const [school, setSchool] = useState<SchoolForm>({
    name: '', cnpj: '', address: '', phone: '',
    email: '', website: '', logo_url: '',
    meta_enrollments: 0, meta_cpa: 0, meta_reenrollment: 80,
  })
  const [schoolSaving, setSchoolSaving] = useState(false)
  const [schoolSaved, setSchoolSaved]   = useState(false)

  // Tab 2 – Users
  const [users, setUsers]             = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showInvite, setShowInvite]   = useState(false)
  const [invite, setInvite]           = useState<InviteForm>({ full_name: '', email: '', role: 'user' })
  const [inviting, setInviting]       = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [showPwd, setShowPwd]         = useState(false)
  const [invitePwd, setInvitePwd]     = useState('')

  // Tab 3 – WhatsApp
  const [wa, setWa]           = useState<WaConfig>({ api_url: '', api_key: '', instance_name: '' })
  const [waStatus, setWaStatus] = useState<WaStatus>('idle')
  const [showApiKey, setShowApiKey] = useState(false)

  // Tab 4 – Notifications
  const [notifs, setNotifs] = useState<NotifSetting[]>([
    { id: 'new_lead',      label: 'Novo lead cadastrado',            enabled: true,  channel: 'email'    },
    { id: 'visit_sched',   label: 'Visita agendada',                 enabled: true,  channel: 'both'     },
    { id: 'no_contact',    label: 'Lead sem contato há 3 dias',      enabled: true,  channel: 'whatsapp' },
    { id: 'cpa_exceeded',  label: 'Meta de CPA ultrapassada',        enabled: false, channel: 'email'    },
    { id: 'reenroll_pend', label: 'Rematrícula pendente',            enabled: true,  channel: 'email'    },
  ])

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.institution_id) return
    loadInstitution()
    loadUsers()
    loadLocalSettings()
  }, [user?.institution_id])

  async function loadInstitution() {
    try {
      const inst = await DatabaseService.getInstitution(user!.institution_id)
      if (inst) {
        setSchool(prev => ({ ...prev, name: inst.name, logo_url: inst.logo_url || '' }))
      }
    } catch (e) {
      console.error('Settings: loadInstitution', e)
    }
  }

  async function loadUsers() {
    setUsersLoading(true)
    try {
      const data = await DatabaseService.getUsers(user!.institution_id)
      setUsers(data)
    } catch (e) {
      console.error('Settings: loadUsers', e)
    } finally {
      setUsersLoading(false)
    }
  }

  function loadLocalSettings() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY(user!.institution_id))
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.school) setSchool(prev => ({ ...prev, ...saved.school }))
      if (saved.wa)     setWa(saved.wa)
      if (saved.notifs) setNotifs(saved.notifs)
    } catch (_) {}
  }

  function saveLocal(patch: object) {
    try {
      const key  = LOCAL_KEY(user!.institution_id)
      const prev = JSON.parse(localStorage.getItem(key) || '{}')
      localStorage.setItem(key, JSON.stringify({ ...prev, ...patch }))
    } catch (_) {}
  }

  // ── Tab 1 – School ─────────────────────────────────────────────────────────

  async function saveSchool() {
    if (!user?.institution_id) return
    setSchoolSaving(true)
    try {
      await DatabaseService.updateInstitution(user.institution_id, {
        name: school.name,
        logo_url: school.logo_url || undefined,
      })
      saveLocal({ school })
      setSchoolSaved(true)
      setTimeout(() => setSchoolSaved(false), 2500)
    } catch (e) {
      console.error('saveSchool:', e)
    } finally {
      setSchoolSaving(false)
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setSchool(prev => ({ ...prev, logo_url: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  // ── Tab 2 – Users ──────────────────────────────────────────────────────────

  async function handleInvite() {
    if (!invite.email || !invite.full_name || !invitePwd) return
    setInviting(true)
    setInviteError('')
    try {
      await signUp(invite.email, invitePwd, invite.full_name, invite.role)
      await loadUsers()
      setShowInvite(false)
      setInvite({ full_name: '', email: '', role: 'user' })
      setInvitePwd('')
    } catch (e: any) {
      setInviteError(e?.message || 'Erro ao convidar usuário')
    } finally {
      setInviting(false)
    }
  }

  async function toggleUserActive(u: User) {
    try {
      const { error } = await supabase.from('users').update({ active: !u.active }).eq('id', u.id)
      if (!error) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, active: !x.active } : x))
    } catch (e) {
      console.error('toggleUserActive:', e)
    }
  }

  // ── Tab 3 – WhatsApp ───────────────────────────────────────────────────────

  function saveWa() {
    saveLocal({ wa })
  }

  async function testConnection() {
    if (!wa.api_url) return
    setWaStatus('testing')
    try {
      const res = await fetch(`${wa.api_url.replace(/\/$/, '')}/instance/connectionState/${wa.instance_name}`, {
        headers: { apikey: wa.api_key }
      })
      setWaStatus(res.ok ? 'connected' : 'disconnected')
    } catch (_) {
      setWaStatus('disconnected')
    }
  }

  // ── Tab 4 – Notifications ──────────────────────────────────────────────────

  function saveNotifs() {
    saveLocal({ notifs })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        {children}
      </div>
    )
  }

  const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white'

  // ─────────────────────────

  function renderSchool() {
    return (
      <div className="space-y-6">
        {/* Logo */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#1e2d6b] mb-4">Logo da Instituição</h3>
          <div className="flex items-center gap-5">
            <div
              className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden cursor-pointer hover:border-teal-400 transition-colors flex-shrink-0"
              onClick={() => fileRef.current?.click()}
            >
              {school.logo_url
                ? <img src={school.logo_url} alt="Logo" className="w-full h-full object-cover" />
                : <Upload className="w-6 h-6 text-gray-400" />
              }
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-sm text-[#14b8a6] font-medium hover:underline"
              >
                Fazer upload de imagem
              </button>
              <p className="text-xs text-gray-400 mt-0.5">PNG, JPG ou SVG. Máx. 2 MB. Aparecerá circular.</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
          </div>
        </div>

        {/* Institution data */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#1e2d6b] mb-4">Dados da Instituição</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup label="Nome da Instituição *">
              <input className={inputCls} value={school.name}
                onChange={e => setSchool(p => ({ ...p, name: e.target.value }))} placeholder="Ex.: Colégio Futuro" />
            </FieldGroup>
            <FieldGroup label="CNPJ">
              <input className={inputCls} value={school.cnpj}
                onChange={e => setSchool(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
            </FieldGroup>
            <FieldGroup label="Endereço">
              <input className={inputCls} value={school.address}
                onChange={e => setSchool(p => ({ ...p, address: e.target.value }))} placeholder="Rua, número, bairro, cidade" />
            </FieldGroup>
            <FieldGroup label="Telefone">
              <input className={inputCls} value={school.phone}
                onChange={e => setSchool(p => ({ ...p, phone: e.target.value }))} placeholder="(11) 3000-0000" />
            </FieldGroup>
            <FieldGroup label="E-mail">
              <input className={inputCls} type="email" value={school.email}
                onChange={e => setSchool(p => ({ ...p, email: e.target.value }))} placeholder="contato@escola.com.br" />
            </FieldGroup>
            <FieldGroup label="Site">
              <input className={inputCls} value={school.website}
                onChange={e => setSchool(p => ({ ...p, website: e.target.value }))} placeholder="https://www.escola.com.br" />
            </FieldGroup>
          </div>
        </div>

        {/* Goals */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#1e2d6b] mb-1">Metas</h3>
          <p className="text-xs text-gray-400 mb-4">Usadas nos relatórios e indicadores de desempenho</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FieldGroup label="Meta Anual de Matrículas">
              <input className={inputCls} type="number" min={0} value={school.meta_enrollments}
                onChange={e => setSchool(p => ({ ...p, meta_enrollments: parseInt(e.target.value) || 0 }))} placeholder="0" />
            </FieldGroup>
            <FieldGroup label="Meta de CPA (R$)">
              <input className={inputCls} type="number" min={0} value={school.meta_cpa}
                onChange={e => setSchool(p => ({ ...p, meta_cpa: parseFloat(e.target.value) || 0 }))} placeholder="0,00" />
            </FieldGroup>
            <FieldGroup label="Meta de Rematrícula (%)">
              <input className={inputCls} type="number" min={0} max={100} value={school.meta_reenrollment}
                onChange={e => setSchool(p => ({ ...p, meta_reenrollment: parseFloat(e.target.value) || 0 }))} placeholder="80" />
            </FieldGroup>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={saveSchool}
            disabled={schoolSaving}
            className="flex items-center gap-2 bg-[#1e2d6b] text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-[#162256] transition-colors disabled:opacity-60"
          >
            {schoolSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : schoolSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {schoolSaved ? 'Salvo!' : 'Salvar Dados'}
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────

  function renderUsers() {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[#1e2d6b]">Usuários da Instituição</h3>
              <p className="text-xs text-gray-400 mt-0.5">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 bg-[#14b8a6] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors"
            >
              <Plus className="w-4 h-4" /> Convidar Usuário
            </button>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-[#14b8a6] animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-3 py-3 font-medium">E-mail</th>
                  <th className="px-3 py-3 font-medium">Perfil</th>
                  <th className="px-3 py-3 font-medium text-center">Status</th>
                  <th className="px-3 py-3 font-medium text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#14b8a6' }}
                        >
                          {u.full_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-700">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        u.role === 'admin'   ? 'bg-purple-100 text-purple-700' :
                        u.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                                              'bg-gray-100 text-gray-600'
                      }`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggleUserActive(u)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          u.active
                            ? 'text-red-600 bg-red-50 hover:bg-red-100'
                            : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {u.active ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-sm text-gray-400 py-8">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Invite Modal */}
        {showInvite && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="font-bold text-[#1e2d6b]">Convidar Usuário</h2>
                <button onClick={() => { setShowInvite(false); setInviteError('') }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {inviteError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                    {inviteError}
                  </div>
                )}
                <FieldGroup label="Nome completo *">
                  <input className={inputCls} value={invite.full_name} placeholder="João da Silva"
                    onChange={e => setInvite(p => ({ ...p, full_name: e.target.value }))} />
                </FieldGroup>
                <FieldGroup label="E-mail *">
                  <input className={inputCls} type="email" value={invite.email} placeholder="joao@escola.com.br"
                    onChange={e => setInvite(p => ({ ...p, email: e.target.value }))} />
                </FieldGroup>
                <FieldGroup label="Perfil *">
                  <select className={inputCls} value={invite.role}
                    onChange={e => setInvite(p => ({ ...p, role: e.target.value as InviteForm['role'] }))}>
                    <option value="user">Atendente</option>
                    <option value="manager">Gestor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </FieldGroup>
                <FieldGroup label="Senha provisória *">
                  <div className="relative">
                    <input
                      className={inputCls + ' pr-10'}
                      type={showPwd ? 'text' : 'password'}
                      value={invitePwd}
                      onChange={e => setInvitePwd(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FieldGroup>
              </div>
              <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
                <button
                  onClick={() => { setShowInvite(false); setInviteError('') }}
                  className="text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !invite.email || !invite.full_name || !invitePwd}
                  className="flex items-center gap-2 text-sm text-white bg-[#14b8a6] hover:bg-teal-600 rounded-lg px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Convidar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────

  function renderWhatsApp() {
    const statusMap = {
      idle:         { icon: null,              text: '',           cls: '' },
      testing:      { icon: <Loader2 className="w-4 h-4 animate-spin text-gray-400" />, text: 'Testando...', cls: 'text-gray-500' },
      connected:    { icon: <Wifi    className="w-4 h-4 text-emerald-500" />, text: 'Conectado',   cls: 'text-emerald-600' },
      disconnected: { icon: <WifiOff className="w-4 h-4 text-red-500"    />, text: 'Desconectado',cls: 'text-red-600'     },
    }
    const s = statusMap[waStatus]

    return (
      <div className="space-y-5">
        {/* Config card */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#1e2d6b] mb-1">Configuração — Evolution API</h3>
          <p className="text-xs text-gray-400 mb-5">Configure a URL e credenciais da sua instância Evolution API para habilitar o atendimento via WhatsApp.</p>

          <div className="space-y-4">
            <FieldGroup label="URL da API">
              <input className={inputCls} value={wa.api_url}
                onChange={e => setWa(p => ({ ...p, api_url: e.target.value }))}
                placeholder="https://api.seudominio.com.br" />
            </FieldGroup>
            <FieldGroup label="API Key">
              <div className="relative">
                <input
                  className={inputCls + ' pr-10'}
                  type={showApiKey ? 'text' : 'password'}
                  value={wa.api_key}
                  onChange={e => setWa(p => ({ ...p, api_key: e.target.value }))}
                  placeholder="Chave de autenticação da API"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FieldGroup>
            <FieldGroup label="Nome da Instância">
              <input className={inputCls} value={wa.instance_name}
                onChange={e => setWa(p => ({ ...p, instance_name: e.target.value }))}
                placeholder="minha-escola" />
            </FieldGroup>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={testConnection}
              disabled={!wa.api_url || waStatus === 'testing'}
              className="flex items-center gap-2 text-sm font-medium border border-[#14b8a6] text-[#14b8a6] hover:bg-teal-50 rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wifi className="w-4 h-4" /> Testar Conexão
            </button>
            {s.text && (
              <div className={`flex items-center gap-1.5 text-sm font-medium ${s.cls}`}>
                {s.icon}{s.text}
              </div>
            )}
            <button
              onClick={saveWa}
              className="ml-auto flex items-center gap-2 bg-[#1e2d6b] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#162256] transition-colors"
            >
              <Save className="w-4 h-4" /> Salvar
            </button>
          </div>
        </div>

        {/* Status + QR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h4 className="font-semibold text-[#1e2d6b] text-sm mb-3">Status da Conexão</h4>
            <div className="flex items-center gap-2">
              {waStatus === 'connected' ? (
                <>
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-semibold text-emerald-600">Conectado ●</span>
                </>
              ) : waStatus === 'disconnected' ? (
                <>
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm font-semibold text-red-600">Desconectado ●</span>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full bg-gray-300" />
                  <span className="text-sm text-gray-500">Aguardando teste</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Configure a URL e clique em "Testar Conexão" para verificar o status da integração.
            </p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h4 className="font-semibold text-[#1e2d6b] text-sm mb-3">QR Code</h4>
            <div className="w-full aspect-square max-w-[160px] mx-auto bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200">
              <MessageCircle className="w-8 h-8 text-gray-300" />
              <p className="text-xs text-gray-400 text-center leading-snug px-2">
                Escaneie para conectar o WhatsApp
              </p>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">
              O QR Code será gerado após a conexão com a Evolution API
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────

  function renderNotifications() {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-[#1e2d6b]">Preferências de Notificação</h3>
            <p className="text-xs text-gray-400 mt-0.5">Escolha quais eventos disparam notificações e por qual canal</p>
          </div>
          <div className="divide-y divide-gray-50">
            {notifs.map(n => (
              <div key={n.id} className="flex items-center gap-4 px-5 py-4">
                <button
                  onClick={() => setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, enabled: !x.enabled } : x))}
                  className="flex-shrink-0"
                >
                  {n.enabled
                    ? <ToggleRight className="w-8 h-8 text-[#14b8a6]" />
                    : <ToggleLeft  className="w-8 h-8 text-gray-300"   />
                  }
                </button>
                <span className={`flex-1 text-sm ${n.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                  {n.label}
                </span>
                <select
                  disabled={!n.enabled}
                  value={n.channel}
                  onChange={e => setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, channel: e.target.value as NotifSetting['channel'] } : x))}
                  className={`text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white transition-opacity ${!n.enabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="both">Ambos</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveNotifs}
            className="flex items-center gap-2 bg-[#1e2d6b] text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-[#162256] transition-colors"
          >
            <Save className="w-4 h-4" /> Salvar Preferências
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────

  const tabContent: Record<string, React.ReactNode> = {
    school: renderSchool(),
    users:  renderUsers(),
    wa:     renderWhatsApp(),
    notifs: renderNotifications(),
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-[#1e2d6b]">Configurações</h1>
        <p className="text-xs text-gray-400 mt-0.5">Gerencie os dados e integrações da sua instituição</p>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-[#14b8a6] text-[#14b8a6]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-4xl">
        {tabContent[activeTab]}
      </div>
    </div>
  )
}
