import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService } from '../../lib/supabase'
import {
  Download, ChevronUp, ChevronDown, Plus, Trash2,
  BarChart3, Check, Target, Clock, Users, TrendingUp,
  AlertCircle, CheckCircle
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MarketingRow {
  period: string
  pctCadastros: number
  cadastros: number
  investimento: number
  leads: number
  gastos: number
  cpa: number
}

interface FunnelStage {
  label: string
  value: number
  meta: number
}

interface ReEnrollRow {
  period: string
  pctRematriculas: number
  meta: number
  rematriculas: number
  difPct: number
  difVol: number
}

interface DropoutReason {
  id: number
  motivo: string
  fator: 'Externo' | 'Interno'
  subfator: string
  quantidade: number
}

interface AvgTimeStage {
  label: string
  currentDays: number
  previousDays: number
  meta: number
}

interface StrategicAction {
  id: number
  text: string
  done: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS_10 = ['Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr']
const MONTHS_9  = ['Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar']
const TABS = ['Marketing & CPA', 'Funil de Vendas', 'Rematrículas', 'Desistências', 'Tempo Médio', 'Ações Estratégicas']

const DEFAULT_MARKETING: MarketingRow[] = MONTHS_10.map(p => ({
  period: p, pctCadastros: 0, cadastros: 0, investimento: 0, leads: 0, gastos: 0, cpa: 0
}))

const DEFAULT_REENROLL: ReEnrollRow[] = MONTHS_9.map(p => ({
  period: p, pctRematriculas: 0, meta: 80, rematriculas: 0, difPct: 0, difVol: 0
}))

const DEFAULT_DROPOUTS: DropoutReason[] = [
  { id: 1, motivo: 'Não retornou contato',         fator: 'Externo', subfator: 'Sem resposta',    quantidade: 0 },
  { id: 2, motivo: 'Outro motivo',                  fator: 'Interno', subfator: 'Administrativo',  quantidade: 0 },
  { id: 3, motivo: 'Valor da mensalidade alto',     fator: 'Interno', subfator: 'Administrativo',  quantidade: 0 },
  { id: 4, motivo: 'Escola não oferece a série',    fator: 'Interno', subfator: 'Administrativo',  quantidade: 0 },
  { id: 5, motivo: 'Não gostou da escola',          fator: 'Interno', subfator: 'Relacionamento',  quantidade: 0 },
  { id: 6, motivo: 'Não tem vaga na série',         fator: 'Interno', subfator: 'Administrativo',  quantidade: 0 },
]

const DEFAULT_AVG_TIME: AvgTimeStage[] = [
  { label: 'Lead → Contato',     currentDays: 0, previousDays: 0, meta: 2  },
  { label: 'Contato → Visita',   currentDays: 0, previousDays: 0, meta: 5  },
  { label: 'Visita → Matrícula', currentDays: 0, previousDays: 0, meta: 7  },
  { label: 'Total do Ciclo',     currentDays: 0, previousDays: 0, meta: 14 },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function GaugeChart({ value, meta }: { value: number; meta: number }) {
  const r = 70, cx = 90, cy = 88
  const circ = Math.PI * r
  const progress = Math.min(Math.max(value / 100, 0), 1)
  const offset = circ * (1 - progress)
  const color = value >= meta ? '#14b8a6' : '#ef4444'
  const pathD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`
  return (
    <svg width="200" height="110" viewBox="0 0 180 100">
      <path d={pathD} fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round" />
      <path
        d={pathD} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#1e2d6b" fontSize="20" fontWeight="bold" fontFamily="sans-serif">{value.toFixed(1)}%</text>
      <text x={cx} y={cy + 4}  textAnchor="middle" fill="#6b7280" fontSize="9"  fontFamily="sans-serif">Fidelização</text>
      <text x={cx - r - 4} y={cy + 4} textAnchor="end"   fill="#9ca3af" fontSize="8" fontFamily="sans-serif">0%</text>
      <text x={cx + r + 4} y={cy + 4} textAnchor="start" fill="#9ca3af" fontSize="8" fontFamily="sans-serif">100%</text>
    </svg>
  )
}

function FunnelBar({ label, value, maxValue, conversion }: {
  label: string; value: number; maxValue: number; conversion?: number
}) {
  const pct = maxValue > 0 ? Math.max((value / maxValue) * 100, 8) : 8
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 mb-0.5">
        <div
          className="h-8 rounded flex items-center justify-center text-white text-xs font-bold"
          style={{ width: `${pct}%`, backgroundColor: '#14b8a6', minWidth: 48 }}
        >
          {value.toLocaleString('pt-BR')}
        </div>
        <span className="text-[11px] text-gray-500 whitespace-nowrap">{label}</span>
      </div>
      {conversion !== undefined && (
        <p className="text-[10px] italic text-gray-400 ml-1 mb-1">↓ {conversion.toFixed(1)}% conversão</p>
      )}
    </div>
  )
}

function FunnelPanel({ title, stages }: { title: string; stages: FunnelStage[] }) {
  const max = stages[0]?.value || 1
  const calcConv = (a: number, b: number) => a > 0 ? (b / a) * 100 : 0
  const calcDev  = (v: number, m: number) => m > 0 ? ((v - m) / m) * 100 : 0
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex-1 min-w-0">
      <h4 className="font-semibold text-[#1e2d6b] text-sm mb-3">{title}</h4>
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          {stages.map((s, i) => (
            <FunnelBar
              key={s.label} label={s.label} value={s.value} maxValue={max}
              conversion={i > 0 ? calcConv(stages[i - 1].value, s.value) : undefined}
            />
          ))}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-gray-400 mb-2">Meta / Desvio</div>
          {stages.map(s => {
            const d = calcDev(s.value, s.meta)
            return (
              <div key={s.label} className="mb-2 h-8 flex flex-col justify-center items-end">
                <span className="text-[10px] text-gray-500">{s.meta.toLocaleString('pt-BR')}</span>
                <span className={`text-[10px] font-bold ${d >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(0)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ActionList({ actions, title, onAdd, onToggle, onUpdateText, onBlur, onRemove }: {
  actions: StrategicAction[]
  title: string
  onAdd: () => void
  onToggle: (id: number) => void
  onUpdateText: (id: number, text: string) => void
  onBlur: (a: StrategicAction) => void
  onRemove: (id: number) => void
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-[#1e2d6b] text-sm">{title}</h3>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium">
          <Plus className="w-3.5 h-3.5" /> Nova Ação
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {actions.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">Nenhuma ação cadastrada</p>
        )}
        {actions.map(a => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => onToggle(a.id)}
              className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                a.done ? 'bg-[#14b8a6] border-[#14b8a6]' : 'border-gray-300'
              }`}
            >
              {a.done && <Check className="w-3 h-3 text-white" />}
            </button>
            <input
              className={`flex-1 text-sm bg-transparent border-none outline-none focus:bg-gray-50 rounded px-1 ${
                a.done ? 'line-through text-gray-400' : 'text-gray-700'
              }`}
              value={a.text}
              onChange={e => onUpdateText(a.id, e.target.value)}
              onBlur={() => onBlur(a)}
            />
            <button onClick={() => onRemove(a.id)} className="text-red-300 hover:text-red-500 flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GestorReports() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(0)
  const [selectedCycle, setSelectedCycle] = useState('2024/2025')
  const [selectedWeek, setSelectedWeek] = useState('Semana atual')

  // Tab 1 – Marketing
  const [marketingRows, setMarketingRows]       = useState<MarketingRow[]>(DEFAULT_MARKETING)
  const [editingCell, setEditingCell]           = useState<{ row: number; col: string } | null>(null)
  const [editValue, setEditValue]               = useState('')
  const [marketingComments, setMarketingComments] = useState('')
  const [prevCPA, setPrevCPA] = useState({ cpaGeral: 0, cpaProjetado: 0 })
  const [currCPA, setCurrCPA] = useState({ cpaGeral: 0, cpaProjetado: 0 })

  // Tab 2 – Funil
  const [funnelComments, setFunnelComments]     = useState('')
  const [concursoPct, setConcursoPct]           = useState(0)
  const [funnelGeral, setFunnelGeral]           = useState<FunnelStage[]>([
    { label: 'Cadastros',    value: 0, meta: 100 },
    { label: 'Agendamentos', value: 0, meta: 60  },
    { label: 'Visitas',      value: 0, meta: 40  },
    { label: 'Matrículas',   value: 0, meta: 20  },
  ])
  const [funnelAgend, setFunnelAgend]           = useState<FunnelStage[]>([
    { label: 'Leads',        value: 0, meta: 100 },
    { label: 'Agendamentos', value: 0, meta: 70  },
    { label: 'Compareceu',   value: 0, meta: 50  },
    { label: 'Matriculou',   value: 0, meta: 30  },
  ])
  const [funnelEventos, setFunnelEventos]       = useState<FunnelStage[]>([
    { label: 'Inscritos',    value: 0, meta: 100 },
    { label: 'Confirmados',  value: 0, meta: 70  },
    { label: 'Presentes',    value: 0, meta: 50  },
    { label: 'Matrículas',   value: 0, meta: 30  },
  ])

  // Tab 3 – Rematrículas
  const [reEnrollRows, setReEnrollRows]         = useState<ReEnrollRow[]>(DEFAULT_REENROLL)
  const [reEnrollSummary, setReEnrollSummary]   = useState({
    baseRematric: 0, inadimplentes: 0, jaTransferidos: 0,
    baseDisponivel: 0, meta: 80, taxaFidelizacao: 0
  })

  // Tab 4 – Desistências
  const [dropouts, setDropouts]                 = useState<DropoutReason[]>(DEFAULT_DROPOUTS)

  // Tab 5 – Tempo Médio
  const [avgTime, setAvgTime]                   = useState<AvgTimeStage[]>(DEFAULT_AVG_TIME)

  // Tab 6 – Ações
  const [actMkt, setActMkt]                     = useState<StrategicAction[]>([])
  const [actMat, setActMat]                     = useState<StrategicAction[]>([])
  const [actRem, setActRem]                     = useState<StrategicAction[]>([])
  const [students, setStudents]                 = useState({ value: 0, base: 0, target: 0, projection: 0 })

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.institution_id) return
    loadData()
  }, [user?.institution_id])

  async function loadData() {
    try {
      // Marketing campaigns
      const campaigns = await DatabaseService.getMarketingCampaigns(user!.institution_id)
      if (campaigns.length > 0) {
        const updated = DEFAULT_MARKETING.map((def, i) => {
          const c = campaigns[i]
          if (!c) return def
          const cpa = c.leads_generated > 0 ? c.investment / c.leads_generated : 0
          return { ...def, cadastros: c.leads_generated || 0, investimento: c.investment || 0, leads: c.leads_generated || 0, gastos: c.investment || 0, cpa }
        })
        setMarketingRows(updated)
        if (campaigns.length >= 2) {
          const p = campaigns[campaigns.length - 2]
          const c = campaigns[campaigns.length - 1]
          setPrevCPA({ cpaGeral: p.leads_generated > 0 ? p.investment / p.leads_generated : 0, cpaProjetado: p.cpa_target || 0 })
          setCurrCPA({ cpaGeral: c.leads_generated > 0 ? c.investment / c.leads_generated : 0, cpaProjetado: c.cpa_target || 0 })
        }
      }

      // Funnel metrics
      const metrics = await DatabaseService.getFunnelMetrics(user!.institution_id)
      if (metrics.length > 0) {
        const l = metrics[metrics.length - 1]
        setFunnelGeral([
          { label: 'Cadastros',    value: l.registrations || 0, meta: l.registrations_target || 100 },
          { label: 'Agendamentos', value: l.schedules || 0,     meta: l.schedules_target || 60 },
          { label: 'Visitas',      value: l.visits || 0,        meta: l.visits_target || 40 },
          { label: 'Matrículas',   value: l.enrollments || 0,   meta: l.enrollments_target || 20 },
        ])
      }

      // Re-enrollments
      const reenrolls = await DatabaseService.getReEnrollments(user!.institution_id)
      if (reenrolls.length > 0) {
        const rows: ReEnrollRow[] = reenrolls.slice(0, 9).map((r: any, i: number) => {
          const pct  = r.total_base > 0 ? (r.re_enrolled / r.total_base) * 100 : 0
          const meta = r.target_percentage || 80
          const metaVol = Math.round((r.total_base * meta) / 100)
          return {
            period: MONTHS_9[i] || r.period,
            pctRematriculas: pct, meta,
            rematriculas: r.re_enrolled || 0,
            difPct: pct - meta, difVol: (r.re_enrolled || 0) - metaVol
          }
        })
        setReEnrollRows(rows)
        const l = reenrolls[reenrolls.length - 1]
        const taxa = l.total_base > 0 ? (l.re_enrolled / l.total_base) * 100 : 0
        setReEnrollSummary({
          baseRematric: l.re_enrolled || 0, inadimplentes: l.defaulters || 0,
          jaTransferidos: l.transferred || 0, baseDisponivel: l.total_base || 0,
          meta: l.target_percentage || 80, taxaFidelizacao: taxa
        })
      }

      // Leads → avg time
      const leads = await DatabaseService.getLeads(user!.institution_id)
      const enrolled = leads.filter((l: any) => l.status === 'enrolled' && l.created_at && l.updated_at)
      if (enrolled.length > 0) {
        const avgDays = enrolled.reduce((s: number, l: any) => {
          const d = (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()) / 86400000
          return s + d
        }, 0) / enrolled.length
        setAvgTime(prev => prev.map((st, i) => ({
          ...st,
          currentDays: i === 3 ? Math.round(avgDays) : Math.round(avgDays * [0.15, 0.35, 0.50][i])
        })))
      }

      // Actions
      const actions = await DatabaseService.getActions(user!.institution_id)
      const toAction = (a: any): StrategicAction => ({ id: a.id, text: a.title, done: a.status === 'done' })
      setActMkt(actions.filter((a: any) => a.action_type === 'marketing').map(toAction))
      setActMat(actions.filter((a: any) => a.action_type === 'sales').map(toAction))
      setActRem(actions.filter((a: any) => a.action_type === 'retention').map(toAction))
    } catch (e) {
      console.error('GestorReports loadData:', e)
    }
  }

  // ── Formatters ─────────────────────────────────────────────────────────────

  const fmt = (n: number) => n.toLocaleString('pt-BR')
  const fmtR$ = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const calcConv = (a: number, b: number) => a > 0 ? (b / a) * 100 : 0

  function DevioBadge({ value }: { value: number }) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {value >= 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    )
  }

  // ── Inline editable cell (Marketing table) ─────────────────────────────────

  function EditableCell({ row, col, value, fmt: fmtFn = fmt }: {
    row: number; col: string; value: number; fmt?: (n: number) => string
  }) {
    const isEditing = editingCell?.row === row && editingCell?.col === col
    if (isEditing) return (
      <input
        autoFocus type="number" value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => e.key === 'Enter' && commitEdit()}
        className="w-16 text-right text-xs border border-teal-400 rounded px-1 py-0.5 focus:outline-none"
      />
    )
    return (
      <span
        className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 text-xs"
        onClick={() => { setEditingCell({ row, col }); setEditValue(String(value)) }}
      >
        {fmtFn(value)}
      </span>
    )
  }

  async function commitEdit() {
    if (!editingCell) return
    const { row, col } = editingCell
    const num = parseFloat(editValue) || 0
    setMarketingRows(prev => prev.map((r, i) => {
      if (i !== row) return r
      const next = { ...r, [col]: num }
      if (col === 'investimento' || col === 'leads' || col === 'gastos') {
        next.cpa = next.leads > 0 ? next.gastos / next.leads : 0
      }
      return next
    }))
    setEditingCell(null)
    try {
      await DatabaseService.createMarketingCampaign({
        institution_id: user!.institution_id,
        month_year: marketingRows[row].period,
        investment: marketingRows[row].gastos,
        leads_generated: marketingRows[row].leads,
        cpa_target: 0
      })
    } catch (_) {}
  }

  const mktTotals = {
    pctCadastros: marketingRows.reduce((s, r) => s + r.pctCadastros, 0) / marketingRows.length,
    cadastros:    marketingRows.reduce((s, r) => s + r.cadastros, 0),
    investimento: marketingRows.reduce((s, r) => s + r.investimento, 0),
    leads:        marketingRows.reduce((s, r) => s + r.leads, 0),
    gastos:       marketingRows.reduce((s, r) => s + r.gastos, 0),
    get cpa() { return this.leads > 0 ? this.gastos / this.leads : 0 }
  }

  // ── Actions helpers ─────────────────────────────────────────────────────────

  function makeAddAction(setter: React.Dispatch<React.SetStateAction<StrategicAction[]>>, actionType: string) {
    return async () => {
      const tmp: StrategicAction = { id: Date.now(), text: 'Nova ação...', done: false }
      setter(prev => [...prev, tmp])
      try {
        const created = await DatabaseService.createAction({
          institution_id: user!.institution_id,
          title: 'Nova ação...', action_type: actionType,
          status: 'pending', priority: 'medium'
        })
        setter(prev => prev.map(a => a.id === tmp.id ? { ...a, id: created.id } : a))
      } catch (_) {}
    }
  }

  function makeToggle(setter: React.Dispatch<React.SetStateAction<StrategicAction[]>>) {
    return (id: number) => {
      setter(prev => prev.map(a => {
        if (a.id !== id) return a
        const done = !a.done
        DatabaseService.updateAction(id, { status: done ? 'done' : 'pending' }).catch(() => {})
        return { ...a, done }
      }))
    }
  }

  function makeUpdateText(setter: React.Dispatch<React.SetStateAction<StrategicAction[]>>) {
    return (id: number, text: string) => setter(prev => prev.map(a => a.id === id ? { ...a, text } : a))
  }

  async function blurAction(a: StrategicAction) {
    try { await DatabaseService.updateAction(a.id, { title: a.text }) } catch (_) {}
  }

  function makeRemove(setter: React.Dispatch<React.SetStateAction<StrategicAction[]>>) {
    return (id: number) => setter(prev => prev.filter(a => a.id !== id))
  }

  // ── Tab 1 – Marketing ───────────────────────────────────────────────────────

  function renderMarketing() {
    const devPrev = prevCPA.cpaProjetado > 0 ? ((prevCPA.cpaGeral - prevCPA.cpaProjetado) / prevCPA.cpaProjetado) * 100 : 0
    const devCurr = currCPA.cpaProjetado > 0 ? ((currCPA.cpaGeral - currCPA.cpaProjetado) / currCPA.cpaProjetado) * 100 : 0
    return (
      <div className="space-y-6">
        {/* CPA cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: 'Semana Anterior', data: prevCPA, dev: devPrev },
            { title: 'Semana Atual',    data: currCPA, dev: devCurr },
          ].map(({ title, data, dev }) => (
            <div key={title} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">{title}</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">CPA Geral</span>
                  <span className="font-bold text-[#1e2d6b] text-sm">{fmtR$(data.cpaGeral)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">CPA Projetado</span>
                  <span className="font-semibold text-gray-700 text-sm">{fmtR$(data.cpaProjetado)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-xs text-gray-500">Status (desvio)</span>
                  <DevioBadge value={-dev} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Editable monthly table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-[#1e2d6b]">Acompanhamento Mensal</h3>
            <p className="text-xs text-gray-400 mt-0.5">Clique em qualquer valor para editar inline</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-2 font-medium">Período</th>
                  <th className="px-3 py-2 font-medium text-right">% Cadastros</th>
                  <th className="px-3 py-2 font-medium text-right">Cadastros</th>
                  <th className="px-3 py-2 font-medium text-right">Investimento</th>
                  <th className="px-3 py-2 font-medium text-right">Leads</th>
                  <th className="px-3 py-2 font-medium text-right">Gastos</th>
                  <th className="px-3 py-2 font-medium text-right">CPA</th>
                </tr>
              </thead>
              <tbody>
                {marketingRows.map((row, i) => (
                  <tr key={row.period} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-700">{row.period}</td>
                    <td className="px-3 py-2 text-right">
                      <EditableCell row={i} col="pctCadastros" value={row.pctCadastros} fmt={n => `${n.toFixed(1)}%`} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <EditableCell row={i} col="cadastros" value={row.cadastros} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <EditableCell row={i} col="investimento" value={row.investimento} fmt={fmtR$} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <EditableCell row={i} col="leads" value={row.leads} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <EditableCell row={i} col="gastos" value={row.gastos} fmt={fmtR$} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-[#14b8a6]">{fmtR$(row.cpa)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#1e2d6b] text-white font-semibold">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{mktTotals.pctCadastros.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right">{fmt(mktTotals.cadastros)}</td>
                  <td className="px-3 py-2 text-right">{fmtR$(mktTotals.investimento)}</td>
                  <td className="px-3 py-2 text-right">{fmt(mktTotals.leads)}</td>
                  <td className="px-3 py-2 text-right">{fmtR$(mktTotals.gastos)}</td>
                  <td className="px-3 py-2 text-right text-[#14b8a6]">{fmtR$(mktTotals.cpa)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#1e2d6b] mb-3">Análise do Gestor</h3>
          <textarea
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            rows={4} placeholder="Digite sua análise e observações sobre marketing..."
            value={marketingComments} onChange={e => setMarketingComments(e.target.value)}
          />
        </div>
      </div>
    )
  }

  // ── Tab 2 – Funil ──────────────────────────────────────────────────────────

  function renderFunnel() {
    const allFunnels = [
      { title: 'Funil Geral',         stages: funnelGeral   },
      { title: 'Funil Agendamentos',  stages: funnelAgend   },
      { title: 'Funil Eventos',       stages: funnelEventos },
    ]
    const problems = allFunnels.flatMap(({ title, stages }) =>
      stages.map(s => ({ name: `${title} — ${s.label}`, ok: s.value >= s.meta }))
    )
    return (
      <div className="space-y-6">
        {/* 3 funnels */}
        <div className="flex flex-col lg:flex-row gap-4">
          {allFunnels.map(f => <FunnelPanel key={f.title} title={f.title} stages={f.stages} />)}
        </div>

        {/* Concurso badge */}
        <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="w-12 h-12 rounded-full bg-[#14b8a6] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {concursoPct}%
          </div>
          <span className="text-sm text-gray-600">dos leads via <strong>concurso</strong></span>
          <input type="range" min={0} max={100} value={concursoPct}
            onChange={e => setConcursoPct(Number(e.target.value))}
            className="flex-1 max-w-xs accent-teal-500" />
        </div>

        {/* Comparative table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-[#1e2d6b]">Comparativo — Funil Geral</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-2 font-medium">Fase</th>
                  <th className="px-3 py-2 font-medium text-right">Meta Mês</th>
                  <th className="px-3 py-2 font-medium text-right">Meta Semana</th>
                  <th className="px-3 py-2 font-medium text-right">Realizado</th>
                  <th className="px-3 py-2 font-medium text-right">Taxa</th>
                  <th className="px-3 py-2 font-medium text-right">Desvio</th>
                </tr>
              </thead>
              <tbody>
                {funnelGeral.map((s, i) => {
                  const dev = s.meta > 0 ? ((s.value - s.meta) / s.meta) * 100 : 0
                  return (
                    <tr key={s.label} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">{s.label}</td>
                      <td className="px-3 py-2 text-right">{fmt(s.meta)}</td>
                      <td className="px-3 py-2 text-right">{fmt(Math.round(s.meta / 4))}</td>
                      <td className="px-3 py-2 text-right">{fmt(s.value)}</td>
                      <td className="px-3 py-2 text-right">
                        {i > 0 ? `${calcConv(funnelGeral[i - 1].value, s.value).toFixed(1)}%` : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${dev >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {dev >= 0 ? '+' : ''}{dev.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Auto comments */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#1e2d6b] mb-3">Análise Automática</h3>
          <div className="space-y-1.5 mb-4">
            {problems.filter(p => !p.ok).map(p => (
              <div key={p.name} className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Fase com problema: <strong>{p.name}</strong></span>
              </div>
            ))}
            {problems.filter(p => p.ok).slice(0, 4).map(p => (
              <div key={p.name} className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>Fase sem problemas: <strong>{p.name}</strong></span>
              </div>
            ))}
          </div>
          <textarea
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            rows={3} placeholder="Comentários adicionais sobre o funil..."
            value={funnelComments} onChange={e => setFunnelComments(e.target.value)}
          />
        </div>
      </div>
    )
  }

  // ── Tab 3 – Rematrículas ───────────────────────────────────────────────────

  function renderReenrollments() {
    const rate   = reEnrollSummary.taxaFidelizacao
    const isGood = rate >= reEnrollSummary.meta
    const maxBar = Math.max(...reEnrollRows.map(r => r.pctRematriculas), reEnrollSummary.meta, 1)
    return (
      <div className="space-y-6">
        {/* Gauge + summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <GaugeChart value={rate} meta={reEnrollSummary.meta} />
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm text-gray-500">Meta: <strong>{reEnrollSummary.meta}%</strong></span>
              {isGood && (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                  META BATIDA! 🎉
                </span>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-[#1e2d6b] mb-4">Resumo</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Base Rematriculada', value: fmt(reEnrollSummary.baseRematric)  },
                { label: 'Inadimplentes',       value: fmt(reEnrollSummary.inadimplentes) },
                { label: 'Já Transferidos',     value: fmt(reEnrollSummary.jaTransferidos)},
                { label: 'Base Disponível',     value: fmt(reEnrollSummary.baseDisponivel)},
                { label: 'Meta',                value: `${reEnrollSummary.meta}%`         },
                { label: 'Taxa Fidelização',    value: `${rate.toFixed(1)}%`              },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500">{item.label}</p>
                  <p className="text-sm font-bold text-[#1e2d6b] mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-[#1e2d6b]">Evolução Mensal</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-2 font-medium">Período</th>
                  <th className="px-3 py-2 font-medium text-right">% Rematric.</th>
                  <th className="px-3 py-2 font-medium text-right">Meta Rematric.</th>
                  <th className="px-3 py-2 font-medium text-right">Rematrículas</th>
                  <th className="px-3 py-2 font-medium text-right">Dif. %</th>
                  <th className="px-3 py-2 font-medium text-right">Dif. Vol.</th>
                </tr>
              </thead>
              <tbody>
                {reEnrollRows.map(row => (
                  <tr key={row.period} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-700">{row.period}</td>
                    <td className="px-3 py-2 text-right">{row.pctRematriculas.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{row.meta}%</td>
                    <td className="px-3 py-2 text-right">{fmt(row.rematriculas)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.difPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {row.difPct >= 0 ? '+' : ''}{row.difPct.toFixed(1)}%
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.difVol >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {row.difVol >= 0 ? '+' : ''}{row.difVol}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#1e2d6b] mb-4">Evolução Gráfica</h3>
          <div className="flex items-end gap-2" style={{ height: 120 }}>
            {reEnrollRows.map(row => (
              <div key={row.period} className="flex flex-col items-center flex-1 gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: 100 }}>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.round((row.pctRematriculas / maxBar) * 100)}px`,
                      backgroundColor: row.pctRematriculas >= row.meta ? '#14b8a6' : '#ef4444'
                    }}
                  />
                </div>
                <span className="text-[9px] text-gray-500">{row.period}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#14b8a6]" /><span className="text-xs text-gray-500">Acima da meta</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500"    /><span className="text-xs text-gray-500">Abaixo da meta</span></div>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab 4 – Desistências ───────────────────────────────────────────────────

  function renderDropouts() {
    const total    = dropouts.reduce((s, r) => s + r.quantidade, 0)
    const external = dropouts.filter(r => r.fator === 'Externo').reduce((s, r) => s + r.quantidade, 0)
    const internal = dropouts.filter(r => r.fator === 'Interno').reduce((s, r) => s + r.quantidade, 0)
    const extPct   = total > 0 ? (external / total) * 100 : 0
    const intPct   = total > 0 ? (internal / total) * 100 : 0

    return (
      <div className="space-y-6">
        {/* Totals */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Desistências</p>
            <p className="text-3xl font-bold text-[#1e2d6b]">{total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-xs text-gray-500 mb-1">Fator Externo</p>
            <p className="text-3xl font-bold text-blue-600">{extPct.toFixed(0)}%</p>
            <p className="text-xs text-gray-400">{external} ocorrências</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-xs text-gray-500 mb-1">Fator Interno</p>
            <p className="text-3xl font-bold text-orange-600">{intPct.toFixed(0)}%</p>
            <p className="text-xs text-gray-400">{internal} ocorrências</p>
          </div>
        </div>

        {/* Editable table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-[#1e2d6b]">Motivos de Desistência</h3>
              <p className="text-xs text-gray-400 mt-0.5">Edite os campos diretamente na tabela</p>
            </div>
            <button
              onClick={() => setDropouts(prev => [...prev, { id: Date.now(), motivo: 'Novo motivo', fator: 'Externo', subfator: '', quantidade: 0 }])}
              className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-2 font-medium">Motivo</th>
                  <th className="px-3 py-2 font-medium">Fator</th>
                  <th className="px-3 py-2 font-medium">Subfator</th>
                  <th className="px-3 py-2 font-medium text-right">Quantidade</th>
                  <th className="px-3 py-2 font-medium text-center">—</th>
                </tr>
              </thead>
              <tbody>
                {dropouts.map(r => (
                  <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-1">
                      <input
                        className="w-full bg-transparent border-none outline-none text-gray-700 focus:bg-white focus:ring-1 focus:ring-teal-300 rounded px-1 py-1"
                        value={r.motivo}
                        onChange={e => setDropouts(prev => prev.map(d => d.id === r.id ? { ...d, motivo: e.target.value } : d))}
                      />
                    </td>
                    <td className="px-3 py-1">
                      <select
                        className="bg-transparent border-none outline-none text-gray-700 text-xs"
                        value={r.fator}
                        onChange={e => setDropouts(prev => prev.map(d => d.id === r.id ? { ...d, fator: e.target.value as 'Externo' | 'Interno' } : d))}
                      >
                        <option>Externo</option>
                        <option>Interno</option>
                      </select>
                    </td>
                    <td className="px-3 py-1">
                      <input
                        className="w-full bg-transparent border-none outline-none text-gray-700 focus:bg-white focus:ring-1 focus:ring-teal-300 rounded px-1 py-1"
                        value={r.subfator}
                        onChange={e => setDropouts(prev => prev.map(d => d.id === r.id ? { ...d, subfator: e.target.value } : d))}
                      />
                    </td>
                    <td className="px-3 py-1 text-right">
                      <input
                        type="number" min={0}
                        className="w-16 bg-transparent border-none outline-none text-right text-gray-700 focus:bg-white focus:ring-1 focus:ring-teal-300 rounded px-1"
                        value={r.quantidade}
                        onChange={e => setDropouts(prev => prev.map(d => d.id === r.id ? { ...d, quantidade: parseInt(e.target.value) || 0 } : d))}
                      />
                    </td>
                    <td className="px-3 py-1 text-center">
                      <button onClick={() => setDropouts(prev => prev.filter(d => d.id !== r.id))} className="text-red-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tree visual */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#1e2d6b] mb-5">Árvore de Recusas</h3>
          <div className="flex items-start gap-8">
            <div className="flex flex-col items-center justify-center mt-6">
              <div className="bg-[#1e2d6b] text-white text-xs font-bold rounded-lg px-4 py-3 text-center whitespace-nowrap">
                Recusas<br /><span className="text-base">{total}</span>
              </div>
            </div>
            <div className="flex gap-8 flex-wrap">
              {(['Externo', 'Interno'] as const).map(fator => {
                const items = dropouts.filter(d => d.fator === fator)
                const count = items.reduce((s, d) => s + d.quantidade, 0)
                const color = fator === 'Externo' ? 'bg-blue-500' : 'bg-orange-500'
                return (
                  <div key={fator} className="flex flex-col items-center gap-2">
                    <div className={`${color} text-white text-xs font-bold rounded-lg px-4 py-2 text-center`}>
                      {fator}<br />{count}
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      {items.map(item => (
                        <div key={item.id} className="bg-gray-100 text-gray-600 text-[10px] rounded px-2 py-1 text-center whitespace-nowrap">
                          {item.motivo} ({item.quantidade})
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab 5 – Tempo Médio ────────────────────────────────────────────────────

  function renderAvgTime() {
    const totalCurr = avgTime.slice(0, 3).reduce((s, st) => s + st.currentDays, 0)
    const totalPrev = avgTime.slice(0, 3).reduce((s, st) => s + st.previousDays, 0)
    const stages: AvgTimeStage[] = [
      ...avgTime.slice(0, 3),
      { ...avgTime[3], currentDays: totalCurr, previousDays: totalPrev }
    ]
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stages.map((st, i) => {
            const diff   = st.currentDays - st.previousDays
            const isGood = st.currentDays <= st.meta
            return (
              <div key={st.label} className={`bg-white rounded-xl p-5 shadow-sm border ${i === 3 ? 'border-[#14b8a6]' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <Clock className={`w-5 h-5 ${isGood ? 'text-[#14b8a6]' : 'text-red-400'}`} />
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {isGood ? 'Dentro da meta' : 'Acima da meta'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-1">{st.label}</p>
                <p className="text-3xl font-bold text-[#1e2d6b]">
                  {st.currentDays}<span className="text-sm font-normal text-gray-400 ml-1">dias</span>
                </p>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-[10px] text-gray-400">Anterior: {st.previousDays}d</span>
                  <span className={`text-xs font-semibold flex items-center gap-0.5 ${diff <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {diff <= 0 ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                    {Math.abs(diff)}d
                  </span>
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-[10px] text-gray-400">Meta:</span>
                  <input
                    type="number" value={st.meta}
                    onChange={e => setAvgTime(prev => prev.map((s, idx) => idx === i ? { ...s, meta: parseInt(e.target.value) || 0 } : s))}
                    className="w-12 text-right text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Visual comparison */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#1e2d6b] mb-4">Comparativo — Semana Atual vs Anterior</h3>
          <div className="space-y-5">
            {stages.slice(0, 3).map(st => {
              const maxV = Math.max(st.currentDays, st.previousDays, st.meta, 1)
              return (
                <div key={st.label}>
                  <p className="text-xs text-gray-500 mb-1.5">{st.label}</p>
                  {[
                    { label: 'Atual',    days: st.currentDays,  color: '#14b8a6' },
                    { label: 'Anterior', days: st.previousDays, color: '#94a3b8' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-gray-400 w-16">{row.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 relative">
                        <div className="h-3 rounded-full" style={{ width: `${(row.days / maxV) * 100}%`, backgroundColor: row.color }} />
                        <div className="absolute top-0 bottom-0 w-0.5 bg-[#1e2d6b] opacity-50" style={{ left: `${(st.meta / maxV) * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right" style={{ color: row.color }}>{row.days}d</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">Linha vertical = meta</p>
        </div>
      </div>
    )
  }

  // ── Tab 6 – Ações Estratégicas ─────────────────────────────────────────────

  function renderActions() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ActionList
            actions={actMkt} title="Ações Marketing"
            onAdd={makeAddAction(setActMkt, 'marketing')}
            onToggle={makeToggle(setActMkt)}
            onUpdateText={makeUpdateText(setActMkt)}
            onBlur={blurAction}
            onRemove={makeRemove(setActMkt)}
          />
          <ActionList
            actions={actMat} title="Ações Time Matrículas"
            onAdd={makeAddAction(setActMat, 'sales')}
            onToggle={makeToggle(setActMat)}
            onUpdateText={makeUpdateText(setActMat)}
            onBlur={blurAction}
            onRemove={makeRemove(setActMat)}
          />
          <ActionList
            actions={actRem} title="Ações Rematrículas"
            onAdd={makeAddAction(setActRem, 'retention')}
            onToggle={makeToggle(setActRem)}
            onUpdateText={makeUpdateText(setActRem)}
            onBlur={blurAction}
            onRemove={makeRemove(setActRem)}
          />
        </div>

        {/* General cards */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#1e2d6b] mb-5">Visão Geral — Alunos</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            {[
              { label: 'vs Ano Anterior',      ref: students.base,       icon: TrendingUp },
              { label: 'vs Meta',              ref: students.target,     icon: Target     },
              { label: 'vs Projeção da Meta',  ref: students.projection, icon: BarChart3  },
            ].map(({ label, ref, icon: Icon }) => {
              const diff = students.value - ref
              const pct  = ref > 0 ? (diff / ref) * 100 : 0
              return (
                <div key={label} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500 font-medium">{label}</span>
                    <Icon className="w-4 h-4 text-[#14b8a6]" />
                  </div>
                  <p className="text-2xl font-bold text-[#1e2d6b]">{fmt(students.value)}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-sm font-semibold flex items-center gap-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {diff >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">
                      {diff >= 0 ? '+' : ''}{diff} vs {fmt(ref)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
            {[
              { label: 'Alunos Atual',         key: 'value'      },
              { label: 'Base Ano Anterior',    key: 'base'       },
              { label: 'Meta de Alunos',       key: 'target'     },
              { label: 'Projeção da Meta',     key: 'projection' },
            ].map(f => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-500">{f.label}</label>
                <input
                  type="number"
                  value={students[f.key as keyof typeof students]}
                  onChange={e => setStudents(prev => ({ ...prev, [f.key]: parseInt(e.target.value) || 0 }))}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  const tabContent = [
    renderMarketing(),
    renderFunnel(),
    renderReenrollments(),
    renderDropouts(),
    renderAvgTime(),
    renderActions(),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#1e2d6b]">Relatórios do Gestor</h1>
            <p className="text-xs text-gray-400 mt-0.5">Visão estratégica semanal da instituição</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedCycle}
              onChange={e => setSelectedCycle(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
            >
              <option>2024/2025</option>
              <option>2025/2026</option>
            </select>
            <select
              value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
            >
              <option>Semana atual</option>
              <option>Semana passada</option>
              <option>Últimas 2 semanas</option>
              <option>Mês atual</option>
            </select>
            <button className="flex items-center gap-2 bg-[#1e2d6b] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#162256] transition-colors">
              <Download className="w-4 h-4" /> Exportar PDF
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex overflow-x-auto">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-[#14b8a6] text-[#14b8a6]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {tabContent[activeTab]}
      </div>
    </div>
  )
}
