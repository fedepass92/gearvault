'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  FileText, Plus, Search, X, Loader2, Copy, ChevronRight,
  Calendar, User, Mail, Package, Pencil, Trash2, Send,
  CheckCircle2, Archive, FileDown, ArrowLeft, Hash, BookUser,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { exportQuotePDF } from '@/lib/pdf'
import { getSuggestedRate, getDurationDiscount } from '@/lib/rental-rates'

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CFG = {
  draft:     { label: 'Bozza',      bg: 'bg-muted',          text: 'text-muted-foreground', border: 'border-border',         icon: FileText },
  sent:      { label: 'Inviato',    bg: 'bg-blue-500/15',    text: 'text-blue-300',         border: 'border-blue-500/20',    icon: Send },
  confirmed: { label: 'Confermato', bg: 'bg-emerald-500/15', text: 'text-emerald-300',      border: 'border-emerald-500/20', icon: CheckCircle2 },
  archived:  { label: 'Archiviato', bg: 'bg-muted/60',       text: 'text-muted-foreground', border: 'border-border',         icon: Archive },
}
const STATUS_FLOW       = { draft: 'sent', sent: 'confirmed', confirmed: 'archived' }
const STATUS_NEXT_LABEL = { draft: 'Invia', sent: 'Conferma', confirmed: 'Archivia' }

function StatusBadge({ status }) {
  const cfg  = STATUS_CFG[status] || STATUS_CFG.draft
  const Icon = cfg.icon
  return (
    <Badge variant="outline" className={`text-xs border ${cfg.bg} ${cfg.text} ${cfg.border} gap-1`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </Badge>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function calcRentalDays(start, end) {
  if (!start || !end) return 1
  const diff = Math.round((new Date(end) - new Date(start)) / 86400000)
  return Math.max(1, diff + 1)
}

function fmtEur(v) {
  return `€\u00a0${parseFloat(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
}

const EMPTY_QUOTE = { title: '', client_name: '', client_email: '', start_date: '', end_date: '', notes: '' }

// ── Main page ──────────────────────────────────────────────────────────────────
export default function PreventiviPage() {
  const [quotes, setQuotes]       = useState([])
  const [equipment, setEquipment] = useState([])
  const [contacts, setContacts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]       = useState('')

  // Create/edit modal
  const [showModal, setShowModal]           = useState(false)
  const [editingQuote, setEditingQuote]     = useState(null)
  const [form, setForm]                     = useState(EMPTY_QUOTE)
  const [quoteItems, setQuoteItems]         = useState([])
  const [discountPct, setDiscountPct]       = useState(0)
  const [saving, setSaving]                 = useState(false)
  const [formError, setFormError]           = useState('')

  // Contact picker
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [contactSearch, setContactSearch]         = useState('')

  // Detail view
  const [detailQuote, setDetailQuote]     = useState(null)
  const [detailItems, setDetailItems]     = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  // Async state
  const [exportingId, setExportingId]   = useState(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  // Item picker
  const [showItemPicker, setShowItemPicker]   = useState(false)
  const [itemPickerSearch, setItemPickerSearch] = useState('')

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabase()
    const { data } = await supabase
      .from('quotes')
      .select('*, quote_items(id)')
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    fetchQuotes()
    supabase.from('equipment')
      .select('id, name, brand, model, category, purchase_price, market_value, photo_url')
      .eq('condition', 'active').order('name')
      .then(({ data }) => setEquipment(data || []))
    supabase.from('loan_contacts')
      .select('id, name, email, phone')
      .order('name')
      .then(({ data }) => setContacts(data || []))
  }, [fetchQuotes])

  // ── Open detail ──────────────────────────────────────────────────────────────
  async function openDetail(quote) {
    setDetailQuote(quote)
    setDetailLoading(true)
    const { data } = await getSupabase()
      .from('quote_items')
      .select('*, equipment(id, name, brand, model, category, photo_url)')
      .eq('quote_id', quote.id)
    setDetailItems(data || [])
    setDetailLoading(false)
  }

  // ── Create / edit ────────────────────────────────────────────────────────────
  function openNew() {
    setEditingQuote(null)
    setForm(EMPTY_QUOTE)
    setQuoteItems([])
    setDiscountPct(0)
    setFormError('')
    setShowModal(true)
  }

  async function openEdit(quote) {
    setEditingQuote(quote)
    setForm({
      title:        quote.title,
      client_name:  quote.client_name  || '',
      client_email: quote.client_email || '',
      start_date:   quote.start_date   || '',
      end_date:     quote.end_date     || '',
      notes:        quote.notes        || '',
    })
    const { data } = await getSupabase().from('quote_items').select('*').eq('quote_id', quote.id)
    setQuoteItems((data || []).map((i) => ({
      item_id:    i.item_id,
      quantity:   i.quantity  ?? 1,
      days:       i.days      ?? 1,
      daily_rate: i.daily_rate ?? '',
      notes:      i.notes     ?? '',
    })))
    setDiscountPct(parseFloat(quote.discount_pct) || 0)
    setFormError('')
    setShowModal(true)
    setDetailQuote(null)
  }

  function handleDateChange(field, value) {
    const next = { ...form, [field]: value }
    setForm(next)
    const s = field === 'start_date' ? value : form.start_date
    const e = field === 'end_date'   ? value : form.end_date
    if (s && e) {
      const days = String(calcRentalDays(s, e))
      setQuoteItems((prev) => prev.map((qi) => ({ ...qi, days })))
    }
  }

  function addItem(itemId) {
    if (!itemId || quoteItems.find((i) => i.item_id === itemId)) return
    const eq      = equipment.find((e) => e.id === itemId)
    const days    = calcRentalDays(form.start_date, form.end_date)
    const suggested = eq?.purchase_price
      ? getSuggestedRate(eq.category, parseFloat(eq.purchase_price))
      : null
    setQuoteItems((prev) => [...prev, {
      item_id:    itemId,
      quantity:   1,
      days:       String(days),
      daily_rate: suggested
        ? String(suggested.daily)
        : (eq?.market_value ? String(parseFloat(eq.market_value).toFixed(0)) : ''),
      notes: '',
    }])
  }

  function removeItem(itemId) {
    setQuoteItems((prev) => prev.filter((i) => i.item_id !== itemId))
  }

  function updateItem(itemId, field, value) {
    setQuoteItems((prev) => prev.map((i) => i.item_id === itemId ? { ...i, [field]: value } : i))
  }

  async function saveToContacts() {
    if (!form.client_name.trim()) return
    const { data: newC } = await getSupabase().from('loan_contacts').insert({
      name:  form.client_name.trim(),
      email: form.client_email || null,
    }).select().single()
    if (newC) {
      setContacts((prev) => [...prev, newC].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('Contatto salvato in rubrica')
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim()) { setFormError('Il titolo è obbligatorio'); return }
    setSaving(true)
    setFormError('')
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    const quotePayload = {
      title:        form.title.trim(),
      client_name:  form.client_name  || null,
      client_email: form.client_email || null,
      start_date:   form.start_date   || null,
      end_date:     form.end_date     || null,
      notes:        form.notes        || null,
      discount_pct: discountPct       || 0,
    }

    let quoteId
    if (editingQuote) {
      const { error } = await supabase.from('quotes').update(quotePayload).eq('id', editingQuote.id)
      if (error) { setFormError(error.message); setSaving(false); return }
      quoteId = editingQuote.id
      await supabase.from('quote_items').delete().eq('quote_id', quoteId)
    } else {
      const { data: newQ, error } = await supabase.from('quotes').insert({
        user_id: user.id, status: 'draft', ...quotePayload,
      }).select().single()
      if (error || !newQ) { setFormError(error?.message || 'Errore'); setSaving(false); return }
      quoteId = newQ.id
    }

    if (quoteItems.length > 0) {
      await supabase.from('quote_items').insert(
        quoteItems.map((i) => ({
          quote_id:   quoteId,
          item_id:    i.item_id,
          quantity:   parseInt(i.quantity)  || 1,
          days:       parseInt(i.days)      || 1,
          daily_rate: i.daily_rate !== '' ? parseFloat(i.daily_rate) : null,
          notes:      i.notes || null,
        }))
      )
    }

    setSaving(false)
    setShowModal(false)
    toast.success(editingQuote ? 'Preventivo aggiornato' : 'Preventivo creato')
    fetchQuotes()
  }

  // ── Status change ─────────────────────────────────────────────────────────────
  async function advanceStatus(quote, e) {
    e?.stopPropagation()
    const next = STATUS_FLOW[quote.status]
    if (!next) return
    await getSupabase().from('quotes').update({ status: next }).eq('id', quote.id)
    setQuotes((prev) => prev.map((q) => q.id === quote.id ? { ...q, status: next } : q))
    if (detailQuote?.id === quote.id) setDetailQuote((q) => ({ ...q, status: next }))
    toast.success(`Stato aggiornato: ${STATUS_CFG[next]?.label}`)
  }

  // ── Duplicate ─────────────────────────────────────────────────────────────────
  async function duplicateQuote(quote, e) {
    e?.stopPropagation()
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: newQ, error } = await supabase.from('quotes').insert({
      user_id:      user.id,
      title:        `${quote.title} (copia)`,
      client_name:  quote.client_name  || null,
      client_email: quote.client_email || null,
      start_date:   quote.start_date   || null,
      end_date:     quote.end_date     || null,
      notes:        quote.notes        || null,
      status:       'draft',
      discount_pct: quote.discount_pct || 0,
    }).select().single()
    if (error || !newQ) { toast.error('Errore nella duplicazione'); return }
    const { data: srcItems } = await supabase.from('quote_items').select('*').eq('quote_id', quote.id)
    if (srcItems?.length > 0) {
      await supabase.from('quote_items').insert(
        srcItems.map(({ id: _, quote_id: __, ...rest }) => ({ ...rest, quote_id: newQ.id }))
      )
    }
    toast.success('Preventivo duplicato')
    fetchQuotes()
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await getSupabase().from('quotes').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    setDetailQuote(null)
    setQuotes((prev) => prev.filter((q) => q.id !== deleteTarget.id))
    toast.success('Preventivo eliminato')
  }

  // ── Export PDF ────────────────────────────────────────────────────────────────
  async function handleExportPDF(quote) {
    setExportingId(quote.id)
    try {
      const supabase = getSupabase()
      let items = detailItems
      if (!detailQuote || detailQuote.id !== quote.id) {
        const { data } = await supabase
          .from('quote_items')
          .select('*, equipment(id, name, brand, model, category, photo_url)')
          .eq('quote_id', quote.id)
        items = data || []
      }
      const { data: settingsData } = await supabase.from('app_settings').select('key, value')
      const cs = settingsData
        ? Object.fromEntries(settingsData.map((s) => [s.key, s.value]))
        : {}
      await exportQuotePDF(quote, items, cs)
    } catch {
      toast.error('Errore nella generazione del PDF')
    }
    setExportingId(null)
  }

  // ── Send email ────────────────────────────────────────────────────────────────
  async function handleSendEmail(quote) {
    if (!quote.client_email) return
    setSendingEmail(true)
    try {
      const supabase = getSupabase()
      let items = detailItems
      if (!detailQuote || detailQuote.id !== quote.id || detailItems.length === 0) {
        const { data } = await supabase
          .from('quote_items')
          .select('*, equipment(id, name, brand, model, category, photo_url)')
          .eq('quote_id', quote.id)
        items = data || []
      }
      const res  = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'quote', quote, items }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Errore invio email')
      toast.success(`Email inviata a ${quote.client_email}`)
      setQuotes((prev) => prev.map((q) => q.id === quote.id ? { ...q, status: 'sent' } : q))
      setDetailQuote((q) => q ? { ...q, status: 'sent' } : q)
    } catch (err) {
      toast.error(err.message || "Errore nell'invio email")
    } finally {
      setSendingEmail(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const displayQuotes = quotes.filter((q) => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return q.title?.toLowerCase().includes(s) || q.client_name?.toLowerCase().includes(s)
    }
    return true
  })

  function totalValue(items) {
    return items.reduce(
      (sum, i) => sum + (parseFloat(i.daily_rate || 0) * (parseInt(i.quantity) || 1) * (parseInt(i.days) || 1)),
      0
    )
  }

  function calcBreakdown(items, dPct) {
    const subtotal    = totalValue(items)
    const pct         = parseFloat(dPct) || 0
    const discountAmt = subtotal * pct / 100
    const net         = subtotal - discountAmt
    const iva         = net * 0.22
    return { subtotal, pct, discountAmt, net, iva, total: net + iva }
  }

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────────
  if (detailQuote) {
    const nextStatus = STATUS_FLOW[detailQuote.status]
    const bd = calcBreakdown(detailItems, detailQuote.discount_pct)
    const dateStart  = detailQuote.start_date || detailQuote.event_date
    const dateEnd    = detailQuote.end_date
    const rentalDays = dateStart && dateEnd ? calcRentalDays(dateStart, dateEnd) : null

    return (
      <div className="space-y-5 max-w-3xl">
        {/* Back + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => setDetailQuote(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="w-4 h-4" />
            Preventivi
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {nextStatus && (
              <Button size="sm" variant="outline" onClick={() => advanceStatus(detailQuote)}>
                <Send className="w-3.5 h-3.5" />
                {STATUS_NEXT_LABEL[detailQuote.status]}
              </Button>
            )}
            <Button size="sm" variant="outline"
              onClick={() => handleExportPDF(detailQuote)}
              disabled={exportingId === detailQuote.id}>
              {exportingId === detailQuote.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileDown className="w-3.5 h-3.5" />}
              PDF
            </Button>
            {detailQuote.client_email && !['confirmed', 'archived'].includes(detailQuote.status) && (
              <Button size="sm" variant="outline"
                onClick={() => handleSendEmail(detailQuote)}
                disabled={sendingEmail}>
                {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Invia email
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => openEdit(detailQuote)}>
              <Pencil className="w-3.5 h-3.5" />
              Modifica
            </Button>
            <Button size="sm" variant="outline" onClick={(e) => duplicateQuote(detailQuote, e)}>
              <Copy className="w-3.5 h-3.5" />
              Duplica
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(detailQuote)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Header card */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1"><StatusBadge status={detailQuote.status} /></div>
            <h1 className="text-xl font-bold">{detailQuote.title}</h1>
            <p className="text-xs text-muted-foreground mt-1 font-mono">#{detailQuote.id.slice(0, 8).toUpperCase()}</p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {detailQuote.client_name && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cliente</p>
                <p className="text-sm font-semibold">{detailQuote.client_name}</p>
                {detailQuote.client_email && <p className="text-xs text-muted-foreground">{detailQuote.client_email}</p>}
              </div>
            )}
            {dateStart && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {dateEnd ? 'Periodo noleggio' : 'Data evento'}
                </p>
                <p className="text-sm font-semibold">
                  {format(parseISO(dateStart), 'd MMM yyyy', { locale: it })}
                  {dateEnd && <> → {format(parseISO(dateEnd), 'd MMM yyyy', { locale: it })}</>}
                </p>
                {rentalDays && (
                  <p className="text-xs text-muted-foreground">{rentalDays} giorni</p>
                )}
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Creato il</p>
              <p className="text-sm font-semibold">{format(new Date(detailQuote.created_at), 'd MMM yyyy', { locale: it })}</p>
            </div>
          </div>

          {detailQuote.notes && (
            <>
              <Separator />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Note</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{detailQuote.notes}</p>
              </div>
            </>
          )}
        </div>

        {/* Items */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Attrezzatura — {detailItems.length} item
            </p>
          </div>
          {detailLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : detailItems.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Nessun item aggiunto</div>
          ) : (
            <div className="divide-y divide-border/50">
              {detailItems.map((qi) => {
                const eq        = qi.equipment
                const qty       = parseInt(qi.quantity)  || 1
                const days      = parseInt(qi.days)      || 1
                const lineTotal = parseFloat(qi.daily_rate || 0) * qty * days
                return (
                  <div key={qi.id} className="flex items-center gap-3 px-5 py-3.5">
                    {eq?.photo_url ? (
                      <img src={eq.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{eq?.name || '—'}</p>
                      {(eq?.brand || eq?.model) && (
                        <p className="text-xs text-muted-foreground truncate">{[eq?.brand, eq?.model].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <p className="text-xs text-muted-foreground">Qt. {qty} × {days} gg</p>
                      {qi.daily_rate != null && (
                        <p className="text-xs font-medium">€ {parseFloat(qi.daily_rate).toLocaleString('it-IT')} / gg</p>
                      )}
                      {lineTotal > 0 && (
                        <p className="text-sm font-bold">{fmtEur(lineTotal)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Financial breakdown */}
        {bd.subtotal > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Riepilogo economico</p>
            </div>
            <div className="px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotale</span>
                <span className="font-medium">{fmtEur(bd.subtotal)}</span>
              </div>
              {bd.pct > 0 && (
                <div className="flex justify-between text-sm text-emerald-400">
                  <span>Sconto {bd.pct}%</span>
                  <span>- {fmtEur(bd.discountAmt)}</span>
                </div>
              )}
              {bd.pct > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Totale netto</span>
                  <span className="font-medium">{fmtEur(bd.net)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>IVA 22%</span>
                <span>{fmtEur(bd.iva)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Totale ivato</span>
                <span>{fmtEur(bd.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Delete dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" /> Elimina preventivo
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Sei sicuro di voler eliminare <strong className="text-foreground">&ldquo;{deleteTarget?.title}&rdquo;</strong>? L&apos;azione è irreversibile.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Annulla</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Elimina
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  // Computed for modal
  const maxDays      = quoteItems.length > 0 ? Math.max(...quoteItems.map((qi) => parseInt(qi.days) || 1)) : 1
  const suggestedDisc = getDurationDiscount(maxDays)
  const bd           = calcBreakdown(quoteItems, discountPct)
  const clientInContacts = contacts.some(
    (c) => c.name.toLowerCase() === form.client_name.trim().toLowerCase()
  )
  const rentalDaysCalc = calcRentalDays(form.start_date, form.end_date)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Preventivi</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {displayQuotes.length}{displayQuotes.length !== quotes.length ? ` / ${quotes.length}` : ''} preventiv{quotes.length !== 1 ? 'i' : 'o'}
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Nuovo preventivo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per titolo o cliente…" className="pl-8 h-8 text-sm" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1 py-1 border border-border/50 h-8">
          {[
            { value: 'all',       label: 'Tutti' },
            { value: 'draft',     label: 'Bozze' },
            { value: 'sent',      label: 'Inviati' },
            { value: 'confirmed', label: 'Confermati' },
            { value: 'archived',  label: 'Archiviati' },
          ].map((opt) => (
            <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition whitespace-nowrap ${
                statusFilter === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : displayQuotes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground text-sm font-medium">Nessun preventivo trovato</p>
          {quotes.length === 0 && (
            <Button size="sm" className="mt-4" onClick={openNew}>Crea il primo preventivo</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {displayQuotes.map((quote) => {
            const dateStart = quote.start_date || quote.event_date
            return (
              <button key={quote.id} onClick={() => openDetail(quote)}
                className="flex items-center gap-4 bg-card rounded-xl border border-border px-5 py-4 hover:bg-muted/30 transition text-left w-full group">
                <div className="p-2.5 rounded-xl bg-primary/10 flex-shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold group-hover:text-primary transition truncate">{quote.title}</span>
                    <StatusBadge status={quote.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {quote.client_name && (
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{quote.client_name}</span>
                    )}
                    {dateStart && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(dateStart), 'd MMM yyyy', { locale: it })}
                        {quote.end_date && ` → ${format(parseISO(quote.end_date), 'd MMM', { locale: it })}`}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {quote.quote_items?.length ?? 0} item
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {STATUS_FLOW[quote.status] && (
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={(e) => advanceStatus(quote, e)}>
                      {STATUS_NEXT_LABEL[quote.status]}
                    </Button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleExportPDF(quote) }}
                    disabled={exportingId === quote.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    title="Esporta PDF">
                    {exportingId === quote.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <FileDown className="w-4 h-4" />}
                  </button>
                  <button onClick={(e) => duplicateQuote(quote, e)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    title="Duplica">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {/* ── DIALOG: Create / Edit ────────────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={(o) => { if (!o) setShowModal(false) }}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
            <DialogTitle>{editingQuote ? 'Modifica preventivo' : 'Nuovo preventivo'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* ── Titolo ─────────────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label>Titolo *</Label>
              <Input value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Es. Preventivo Shooting 2025 — Mario Rossi" />
            </div>

            {/* ── Cliente ────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <div className="flex gap-1.5">
                  <Input value={form.client_name}
                    onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                    placeholder="Nome cliente"
                    className="flex-1" />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0"
                    title="Rubrica contatti"
                    onClick={() => { setContactSearch(''); setShowContactPicker(true) }}>
                    <BookUser className="w-4 h-4" />
                  </Button>
                </div>
                {form.client_name.trim() && !clientInContacts && (
                  <button type="button" onClick={saveToContacts}
                    className="text-xs text-primary hover:underline">
                    Salva in rubrica
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Email cliente</Label>
                <Input type="email" value={form.client_email}
                  onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))}
                  placeholder="cliente@example.com" />
              </div>
            </div>

            {/* ── Date noleggio ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dal</Label>
                <Input type="date" value={form.start_date}
                  onChange={(e) => handleDateChange('start_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Al</Label>
                <Input type="date" value={form.end_date}
                  onChange={(e) => handleDateChange('end_date', e.target.value)} />
              </div>
            </div>
            {form.start_date && form.end_date && (
              <p className="text-xs text-muted-foreground -mt-3">
                Durata: <span className="font-semibold">{rentalDaysCalc} {rentalDaysCalc === 1 ? 'giorno' : 'giorni'}</span>
                {' '}— i giorni di tutti gli item vengono aggiornati automaticamente
              </p>
            )}

            {/* ── Note ───────────────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2} className="resize-none text-sm" placeholder="Note per il cliente…" />
            </div>

            <Separator />

            {/* ── Attrezzatura ────────────────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Attrezzatura</Label>
                <span className="text-xs text-muted-foreground">{quoteItems.length} item</span>
              </div>

              <Button type="button" variant="outline" size="sm"
                className="h-8 w-full border-dashed"
                onClick={() => { setItemPickerSearch(''); setShowItemPicker(true) }}>
                <Plus className="w-3.5 h-3.5" />
                Aggiungi attrezzatura
              </Button>

              {/* Item cards */}
              {quoteItems.length > 0 && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {quoteItems.map((qi) => {
                    const eq        = equipment.find((e) => e.id === qi.item_id)
                    const suggested = eq?.purchase_price
                      ? getSuggestedRate(eq.category, parseFloat(eq.purchase_price))
                      : null
                    const qty       = parseInt(qi.quantity) || 1
                    const days      = parseInt(qi.days)     || 1
                    const rate      = parseFloat(qi.daily_rate) || 0
                    const lineTotal = qty * days * rate

                    return (
                      <div key={qi.item_id} className="bg-card border border-border rounded-lg p-4">
                        {/* Row 1: name + remove */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{eq?.name || qi.item_id}</p>
                            {(eq?.brand || eq?.model) && (
                              <p className="text-xs text-muted-foreground">{[eq?.brand, eq?.model].filter(Boolean).join(' · ')}</p>
                            )}
                          </div>
                          <button onClick={() => removeItem(qi.item_id)}
                            className="ml-3 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Row 2: fields */}
                        <div className="flex gap-4 flex-wrap">
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Qtà</p>
                            <Input type="number" min="1"
                              value={qi.quantity}
                              onChange={(e) => updateItem(qi.item_id, 'quantity', e.target.value)}
                              className="h-8 w-[60px] text-sm px-2" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Giorni</p>
                            <Input type="number" min="1"
                              value={qi.days}
                              onChange={(e) => updateItem(qi.item_id, 'days', e.target.value)}
                              className="h-8 w-[70px] text-sm px-2" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">€/Giorno</p>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">€</span>
                              <Input type="number" min="0" step="1"
                                value={qi.daily_rate}
                                onChange={(e) => updateItem(qi.item_id, 'daily_rate', e.target.value)}
                                className="h-8 w-[120px] text-sm pl-5 pr-2"
                                placeholder="0" />
                            </div>
                          </div>
                        </div>

                        {/* Row 3: suggested rate hint */}
                        {suggested && eq?.purchase_price && (
                          <p className="text-xs text-muted-foreground italic mt-2">
                            Suggerito: €{suggested.daily}/g ({suggested.label} di €{parseFloat(eq.purchase_price).toLocaleString('it-IT')})
                          </p>
                        )}

                        {/* Row 4: line total */}
                        {lineTotal > 0 && (
                          <p className="text-sm font-semibold text-right mt-2">{fmtEur(lineTotal)}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Sconto + riepilogo ────────────────────────────────────────── */}
              {quoteItems.some((i) => parseFloat(i.daily_rate) > 0) && (
                <div className="space-y-3 pt-1">
                  <Separator />

                  {/* Sconto row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Sconto %</Label>
                    <Input type="number" min="0" max="100" step="1"
                      value={discountPct}
                      onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      className="h-8 w-20 text-sm" />
                    {suggestedDisc > 0 && (
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
                        onClick={() => setDiscountPct(suggestedDisc)}>
                        Applica -{suggestedDisc}%
                      </Button>
                    )}
                  </div>

                  {/* Riepilogo */}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotale</span>
                      <span>{fmtEur(bd.subtotal)}</span>
                    </div>
                    {bd.pct > 0 && (
                      <div className="flex justify-between text-emerald-500">
                        <span>Sconto {bd.pct}%</span>
                        <span>- {fmtEur(bd.discountAmt)}</span>
                      </div>
                    )}
                    {bd.pct > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Netto</span>
                        <span>{fmtEur(bd.net)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>IVA 22%</span>
                      <span>{fmtEur(bd.iva)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Totale ivato</span>
                      <span>{fmtEur(bd.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border flex-shrink-0">
            {formError && <p className="text-sm text-destructive mb-3">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingQuote ? 'Salva modifiche' : 'Crea preventivo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Rubrica contatti ─────────────────────────────────────── */}
      <Dialog open={showContactPicker} onOpenChange={(o) => { if (!o) setShowContactPicker(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookUser className="w-4 h-4" /> Rubrica contatti
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Cerca per nome…"
                className="pl-8 h-8 text-sm"
                autoFocus />
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-border/50 rounded-lg border border-border">
              {contacts
                .filter((c) => !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase()))
                .map((c) => (
                  <button key={c.id}
                    onClick={() => {
                      setForm((f) => ({ ...f, client_name: c.name, client_email: c.email || f.client_email }))
                      setShowContactPicker(false)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition text-left">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                    </div>
                  </button>
                ))}
              {contacts.filter((c) => !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase())).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nessun contatto trovato</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Delete confirm ───────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Elimina preventivo
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler eliminare <strong className="text-foreground">&ldquo;{deleteTarget?.title}&rdquo;</strong>?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Annulla</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Item picker ──────────────────────────────────────────── */}
      <Dialog open={showItemPicker} onOpenChange={(o) => { if (!o) setShowItemPicker(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4" /> Aggiungi attrezzatura
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={itemPickerSearch}
                onChange={(e) => setItemPickerSearch(e.target.value)}
                placeholder="Cerca per nome, marca…"
                className="pl-8 h-8 text-sm"
                autoFocus />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-border/50 rounded-lg border border-border">
              {equipment
                .filter((eq) => !quoteItems.find((i) => i.item_id === eq.id))
                .filter((eq) => {
                  if (!itemPickerSearch) return true
                  const s = itemPickerSearch.toLowerCase()
                  return eq.name?.toLowerCase().includes(s) || eq.brand?.toLowerCase().includes(s) || eq.model?.toLowerCase().includes(s)
                })
                .map((eq) => (
                  <button key={eq.id}
                    onClick={() => addItem(eq.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition text-left">
                    {eq.photo_url ? (
                      <img src={eq.photo_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{eq.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[eq.brand, eq.model].filter(Boolean).join(' · ')}
                        {eq.purchase_price ? ` · acq. €${parseFloat(eq.purchase_price).toLocaleString('it-IT')}` : ''}
                      </p>
                    </div>
                    {quoteItems.find((i) => i.item_id === eq.id) ? (
                      <span className="text-xs text-emerald-400 flex-shrink-0">Aggiunto</span>
                    ) : null}
                  </button>
                ))}
              {equipment.filter((eq) => !quoteItems.find((i) => i.item_id === eq.id)).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Tutto aggiunto</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
