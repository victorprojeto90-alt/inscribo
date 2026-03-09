import React, { useState, useEffect, useRef } from 'react'
import {
  MessageCircle, Search, Send, Paperclip, Smile,
  Calendar, FileText, UserCheck, X, ChevronDown,
  CheckCheck, Check, Phone, User, Clock, Zap,
  AlertCircle, ArrowRight
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type ConvStatus = 'new' | 'waiting' | 'attending' | 'finished'

interface Message {
  id: number
  text: string
  sent: boolean
  time: string
  read: boolean
}

interface LeadInfo {
  student: string
  grade: string
  responsible: string
  source: string
  funnelStatus: string
  actions: string[]
}

interface Conversation {
  id: number
  name: string
  phone: string
  initials: string
  color: string
  lastMessage: string
  time: string
  unread: number
  status: ConvStatus
  messages: Message[]
  lead: LeadInfo
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 1,
    name: 'Ana Paula Rodrigues',
    phone: '(11) 98765-4321',
    initials: 'AP',
    color: '#14b8a6',
    lastMessage: 'Sim! Quero agendar uma visita para conhecer a escola',
    time: '10:32',
    unread: 2,
    status: 'waiting',
    messages: [
      { id: 1, text: 'Olá! Vi que você se interessou pela nossa escola. Posso te ajudar?', sent: true,  time: '10:15', read: true  },
      { id: 2, text: 'Oi! Sim, minha filha vai entrar no 3º ano no próximo ano',               sent: false, time: '10:20', read: true  },
      { id: 3, text: 'Que ótimo! Temos vagas disponíveis para o 3º ano. Gostaria de agendar uma visita para conhecer melhor a escola?', sent: true, time: '10:25', read: true },
      { id: 4, text: 'Sim! Quero agendar uma visita para conhecer a escola', sent: false, time: '10:32', read: false },
    ],
    lead: {
      student: 'Sofia Rodrigues', grade: '3º Ano Fundamental',
      responsible: 'Ana Paula Rodrigues', source: 'Instagram', funnelStatus: 'Agendamento',
      actions: ['Lead criado via Instagram', 'Primeiro contato via WhatsApp', 'Interesse em visita confirmado']
    }
  },
  {
    id: 2,
    name: 'Carlos Mendes',
    phone: '(11) 91234-5678',
    initials: 'CM',
    color: '#1e2d6b',
    lastMessage: 'Perfeito, estaremos lá na quinta-feira às 14h',
    time: '09:15',
    unread: 0,
    status: 'attending',
    messages: [
      { id: 1, text: 'Bom dia! Quero confirmar sua visita agendada para quinta-feira às 14h, pode ser?', sent: true, time: '09:00', read: true },
      { id: 2, text: 'Bom dia! Sim, confirmado!', sent: false, time: '09:10', read: true },
      { id: 3, text: 'Ótimo! Nossa equipe estará te esperando. Qualquer dúvida estou à disposição.', sent: true, time: '09:12', read: true },
      { id: 4, text: 'Perfeito, estaremos lá na quinta-feira às 14h', sent: false, time: '09:15', read: true },
    ],
    lead: {
      student: 'Pedro Mendes', grade: '1º Ano Médio',
      responsible: 'Carlos Mendes', source: 'Google Ads', funnelStatus: 'Visita',
      actions: ['Lead via Google Ads', 'Visita agendada para quinta', 'Confirmação de visita enviada']
    }
  },
  {
    id: 3,
    name: 'Fernanda Lima',
    phone: '(21) 97654-3210',
    initials: 'FL',
    color: '#8b5cf6',
    lastMessage: 'Obrigada! Vou formalizar a matrícula amanhã',
    time: 'Ontem',
    unread: 0,
    status: 'finished',
    messages: [
      { id: 1, text: 'Olá Fernanda! Sua matrícula está quase pronta! Falta apenas assinar o contrato.', sent: true, time: '14:00', read: true },
      { id: 2, text: 'Que maravilha! Quando posso ir assinar?', sent: false, time: '14:05', read: true },
      { id: 3, text: 'Qualquer dia útil das 8h às 17h. Temos condição especial se vier ainda essa semana!', sent: true, time: '14:08', read: true },
      { id: 4, text: 'Obrigada! Vou formalizar a matrícula amanhã', sent: false, time: '14:20', read: true },
    ],
    lead: {
      student: 'Lucas Lima', grade: '5º Ano Fundamental',
      responsible: 'Fernanda Lima', source: 'Indicação', funnelStatus: 'Matrícula',
      actions: ['Lead por indicação', 'Visita realizada', 'Proposta enviada', 'Matrícula confirmada']
    }
  },
  {
    id: 4,
    name: 'Roberto Santos',
    phone: '(31) 99876-5432',
    initials: 'RS',
    color: '#f59e0b',
    lastMessage: 'Oi, queria saber mais sobre as mensalidades',
    time: '08:50',
    unread: 3,
    status: 'new',
    messages: [
      { id: 1, text: 'Oi, queria saber mais sobre as mensalidades',                sent: false, time: '08:42', read: false },
      { id: 2, text: 'Também quero saber sobre transporte escolar',                sent: false, time: '08:45', read: false },
      { id: 3, text: 'E se tem aula de inglês no currículo',                       sent: false, time: '08:50', read: false },
    ],
    lead: {
      student: 'Enzo Santos', grade: '2º Ano Fundamental',
      responsible: 'Roberto Santos', source: 'Facebook', funnelStatus: 'Cadastro',
      actions: ['Lead criado via Facebook Ads']
    }
  },
  {
    id: 5,
    name: 'Juliana Costa',
    phone: '(41) 98765-1234',
    initials: 'JC',
    color: '#ec4899',
    lastMessage: 'Temos uma condição especial para você! Desconto de 10%...',
    time: '08:10',
    unread: 1,
    status: 'attending',
    messages: [
      { id: 1, text: 'Olá Juliana! Posso te ajudar com alguma dúvida?', sent: true, time: '07:50', read: true },
      { id: 2, text: 'Oi! Sim, fiquei interessada mas o valor ficou um pouco alto', sent: false, time: '08:00', read: true },
      { id: 3, text: 'Temos uma condição especial para você! Desconto de 10% nas 3 primeiras mensalidades para matrículas essa semana!', sent: true, time: '08:10', read: false },
    ],
    lead: {
      student: 'Beatriz Costa', grade: '4º Ano Fundamental',
      responsible: 'Juliana Costa', source: 'Instagram', funnelStatus: 'Proposta',
      actions: ['Lead via Instagram', 'Visita realizada', 'Objeção de preço registrada']
    }
  },
]

const QUICK_MESSAGES = [
  'Olá! Vi que você se interessou pela nossa escola. Posso te ajudar com mais informações?',
  'Quero confirmar sua visita agendada para amanhã às 10h. Podemos confirmar?',
  'Sua matrícula está quase pronta! Falta apenas assinar o contrato e está tudo certo.',
  'Temos uma condição especial para você: desconto de 10% nas primeiras mensalidades!',
  'Posso te ajudar com alguma dúvida sobre nossa escola ou processo de matrícula?',
]

const FUNNEL_STAGES = ['Cadastro', 'Contato', 'Agendamento', 'Visita', 'Proposta', 'Matrícula']

const STATUS_LABELS: Record<ConvStatus, string> = {
  new: 'Novo', waiting: 'Aguardando', attending: 'Em atendimento', finished: 'Finalizado'
}
const STATUS_COLORS: Record<ConvStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  waiting: 'bg-amber-100 text-amber-700',
  attending: 'bg-teal-100 text-teal-700',
  finished: 'bg-gray-100 text-gray-500',
}

// Simulated incoming messages
const SIM_MESSAGES = [
  'Tudo bem, obrigado pela informação!',
  'Tem vaga para o 4º ano?',
  'Qual o horário das aulas?',
  'Como funciona a alimentação escolar?',
  'Vocês têm período integral?',
]

function now() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WhatsAppHub() {
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS)
  const [activeId, setActiveId]           = useState<number>(1)
  const [filter, setFilter]               = useState<'all' | ConvStatus>('all')
  const [search, setSearch]               = useState('')
  const [inputText, setInputText]         = useState('')
  const [isTyping, setIsTyping]           = useState(false)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [selectedStage, setSelectedStage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const active = conversations.find(c => c.id === activeId) ?? conversations[0]

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeId, active?.messages.length])

  // Mark messages as read when switching conversation
  useEffect(() => {
    setConversations(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, unread: 0, messages: c.messages.map(m => ({ ...m, read: true })) }
        : c
    ))
  }, [activeId])

  // Simulate incoming message every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const targetId = [1, 4, 5][Math.floor(Math.random() * 3)]
      const text = SIM_MESSAGES[Math.floor(Math.random() * SIM_MESSAGES.length)]
      const t = now()

      // Show typing indicator for 2s then deliver message
      if (targetId === activeId) setIsTyping(true)

      setTimeout(() => {
        setIsTyping(false)
        setConversations(prev => prev.map(c => {
          if (c.id !== targetId) return c
          const newMsg: Message = { id: Date.now(), text, sent: false, time: t, read: c.id === activeId }
          return {
            ...c,
            lastMessage: text,
            time: t,
            unread: c.id === activeId ? 0 : c.unread + 1,
            messages: [...c.messages, newMsg],
            status: c.status === 'finished' ? 'waiting' : c.status,
          }
        }))
      }, 2000)
    }, 30000)
    return () => clearInterval(interval)
  }, [activeId])

  // ── Helpers ──────────────────────────────────────────────────────────────

  function sendMessage(text: string) {
    if (!text.trim()) return
    const msg: Message = { id: Date.now(), text: text.trim(), sent: true, time: now(), read: true }
    setConversations(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, lastMessage: text.trim(), time: msg.time, messages: [...c.messages, msg], status: 'attending' }
        : c
    ))
    setInputText('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText) }
  }

  const filtered = conversations.filter(c => {
    const matchFilter = filter === 'all' || c.status === filter
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
    return matchFilter && matchSearch
  })

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Demo banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span className="text-xs text-amber-700">
          <strong>Modo demonstração</strong> — conecte a Evolution API nas Configurações para atendimento real via WhatsApp.
        </span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── Column 1 — Conversation list ───────────────────────────────── */}
        <div className="w-[260px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-[#1e2d6b] text-sm">WhatsApp</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-600 font-medium">Conectado</span>
              </div>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="Buscar nome ou número..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="px-3 py-2 border-b border-gray-100 flex gap-1 flex-wrap">
            {([['all', 'Todos'], ['new', 'Novos'], ['waiting', 'Aguardando'], ['attending', 'Atendendo'], ['finished', 'Finalizados']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${
                  filter === val ? 'bg-[#14b8a6] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {label}
                {val === 'all' && totalUnread > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full px-1 text-[9px]">{totalUnread}</span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">Nenhuma conversa encontrada</p>
            )}
            {filtered.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveId(conv.id)}
                className={`w-full text-left px-3 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${
                  conv.id === activeId ? 'border-l-4 border-l-[#14b8a6] bg-teal-50' : 'border-l-4 border-l-transparent'
                }`}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: conv.color }}
                >
                  {conv.initials}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-gray-800 truncate">{conv.name}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{conv.time}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">{conv.lastMessage}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[conv.status]}`}>
                      {STATUS_LABELS[conv.status]}
                    </span>
                    {conv.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#14b8a6] text-white text-[10px] font-bold flex items-center justify-center">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Column 2 — Chat ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: active.color }}
              >
                {active.initials}
              </div>
              <div>
                <p className="font-semibold text-[#1e2d6b] text-sm">{active.name}</p>
                <p className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" />{active.phone}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowLeadModal(true)}
              className="flex items-center gap-1.5 text-xs text-[#14b8a6] border border-[#14b8a6] rounded-lg px-3 py-1.5 hover:bg-teal-50 transition-colors font-medium"
            >
              <User className="w-3.5 h-3.5" /> Ver Lead no CRM
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {active.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    msg.sent
                      ? 'bg-[#14b8a6] text-white rounded-tr-sm'
                      : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                  }`}
                >
                  <p className="leading-relaxed">{msg.text}</p>
                  <div className={`flex items-center gap-1 mt-1 ${msg.sent ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${msg.sent ? 'text-teal-100' : 'text-gray-400'}`}>{msg.time}</span>
                    {msg.sent && (
                      msg.read
                        ? <CheckCheck className="w-3 h-3 text-teal-100" />
                        : <Check className="w-3 h-3 text-teal-100" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          <div className="px-4 pt-3 pb-1 bg-white border-t border-gray-100 flex gap-2 flex-wrap">
            {[
              { icon: Calendar,   label: 'Agendar Visita',         action: () => sendMessage('Vamos agendar sua visita! Qual seria o melhor dia e horário para você?') },
              { icon: FileText,   label: 'Enviar Proposta',         action: () => sendMessage('Segue nossa proposta comercial completa com valores e condições especiais para você!') },
              { icon: UserCheck,  label: 'Marcar como Matriculado', action: () => sendMessage('Parabéns! Sua matrícula foi confirmada! Bem-vindo(a) à nossa família escolar! 🎉') },
            ].map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex items-center gap-1.5 text-[11px] text-gray-600 bg-gray-100 hover:bg-teal-50 hover:text-teal-700 rounded-lg px-2.5 py-1.5 transition-colors font-medium"
              >
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {/* Input footer */}
          <div className="bg-white px-4 py-3 border-t border-gray-100 flex items-end gap-2 flex-shrink-0">
            <button className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1">
              <Paperclip className="w-5 h-5" />
            </button>
            <button className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1">
              <Smile className="w-5 h-5" />
            </button>
            <textarea
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none min-h-[40px] max-h-[120px]"
              placeholder="Digite uma mensagem..."
              rows={1}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim()}
              className="w-10 h-10 rounded-xl bg-[#14b8a6] flex items-center justify-center text-white hover:bg-teal-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Column 3 — Lead panel ───────────────────────────────────────── */}
        <div className="w-[280px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
          {/* Lead card */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dados do Lead</h3>
            <div className="space-y-2.5">
              {[
                { icon: User,    label: 'Aluno',       value: active.lead.student      },
                { icon: Clock,   label: 'Série',       value: active.lead.grade        },
                { icon: User,    label: 'Responsável', value: active.lead.responsible  },
                { icon: Zap,     label: 'Origem',      value: active.lead.source       },
                { icon: ArrowRight, label: 'Funil',    value: active.lead.funnelStatus },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-gray-400">{label}</p>
                    <p className="text-xs font-medium text-gray-700">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action history */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Histórico</h3>
            <div className="space-y-2">
              {active.lead.actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#14b8a6] flex-shrink-0 mt-1.5" />
                  <span className="text-[11px] text-gray-600">{action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Move in Kanban */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Mover no Kanban</h3>
            <div className="flex gap-2">
              <select
                value={selectedStage}
                onChange={e => setSelectedStage(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white text-gray-700"
              >
                <option value="">Selecionar etapa...</option>
                {FUNNEL_STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
              <button
                disabled={!selectedStage}
                onClick={() => {
                  if (!selectedStage) return
                  setConversations(prev => prev.map(c =>
                    c.id === activeId ? { ...c, lead: { ...c.lead, funnelStatus: selectedStage } } : c
                  ))
                  setSelectedStage('')
                }}
                className="text-xs bg-[#1e2d6b] text-white rounded-lg px-3 py-2 hover:bg-[#162256] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Mover
              </button>
            </div>
          </div>

          {/* Quick messages */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#14b8a6]" /> Mensagens Rápidas
            </h3>
            <div className="space-y-2">
              {QUICK_MESSAGES.map((msg, i) => (
                <button
                  key={i}
                  onClick={() => setInputText(msg)}
                  className="w-full text-left text-[11px] text-gray-600 bg-gray-50 hover:bg-teal-50 hover:text-teal-700 rounded-lg px-3 py-2.5 transition-colors leading-relaxed border border-transparent hover:border-teal-200"
                >
                  {msg.length > 65 ? `${msg.slice(0, 62)}...` : msg}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Lead Modal ────────────────────────────────────────────────────── */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-[#1e2d6b]">Dados do Lead — CRM</h2>
              <button onClick={() => setShowLeadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: active.color }}
                >
                  {active.initials}
                </div>
                <div>
                  <p className="font-bold text-gray-800">{active.name}</p>
                  <p className="text-sm text-gray-500">{active.phone}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[active.status]}`}>
                    {STATUS_LABELS[active.status]}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Aluno',        value: active.lead.student      },
                  { label: 'Série',        value: active.lead.grade        },
                  { label: 'Responsável',  value: active.lead.responsible  },
                  { label: 'Origem',       value: active.lead.source       },
                  { label: 'Etapa Funil',  value: active.lead.funnelStatus },
                  { label: 'Conversas',    value: `${active.messages.length} mensagens` },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500">{item.label}</p>
                    <p className="text-sm font-semibold text-[#1e2d6b] mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Histórico de Ações</p>
                <div className="space-y-1.5">
                  {active.lead.actions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#14b8a6] flex-shrink-0 mt-1.5" />
                      <span className="text-xs text-gray-600">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowLeadModal(false)}
                className="text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-2 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => { setShowLeadModal(false); window.location.href = '/leads' }}
                className="text-sm text-white bg-[#1e2d6b] hover:bg-[#162256] rounded-lg px-4 py-2 transition-colors"
              >
                Abrir no CRM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
