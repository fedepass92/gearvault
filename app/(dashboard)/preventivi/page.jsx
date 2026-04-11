'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  FileText, Plus, Search, X, Loader2, Copy, ChevronRight,
  Calendar, User, Mail, Package, Pencil, Trash2, Send,
  CheckCircle2, Archive, FileDown, ArrowLeft, Hash, BookUser, Building2,
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

function QuoteTypeBadge({ type }) {
  if (type === 'free') return (
    <Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-300 border-blue-500/20 gap-1">
      <FileText className="w-2.5 h-2.5" />Libero
    </Badge>
  )
  return (
    <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-300 border-emerald-500/20 gap-1">
      <Package className="w-2.5 h-2.5" />Noleggio
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

const VAT_OPTIONS = [
  { value: 22, label: '22%' },
  { value: 10, label: '10%' },
  { value: 4,  label: '4%' },
  { value: 0,  label: '0% (esente)' },
]

const EMPTY_QUOTE = { title: '', client_name: '', client_email: '', start_date: '', end_date: '', notes: '' }
const EMPTY_FREE_ITEM = { description: '', detail: '', quantity: 1, unit_price: '' }

// ── Main page ──────────────────────────────────────────────────────────────────
export default function PreventiviPage() {
  const [quotes, setQuotes]       = useState([])
  const [equipment, setEquipment] = useState([])
  const [contacts, setContacts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [search, setSearch]       = useState('')

  // Rental modal
  const [showModal, setShowModal]           = useState(false)
  const [editingQuote, setEditingQuote]     = useState(null)
  const [form, setForm]                     = useState(EMPTY_QUOTE)
  const [quoteItems, setQuoteItems]         = useState([])
  const [discountPct, setDiscountPct]       = useState(0)
  const [saving, setSaving]                 = useState(false)
  const [formError, setFormError]           = useState('')

  // Free modal
  const [showFreeModal, setShowFreeModal]   = useState(false)
  const [editingFree, setEditingFree]       = useState(null)
  const [freeForm, setFreeForm]             = useState(EMPTY_QUOTE)
  const [freeItems, setFreeItems]           = useState([])
  const [freeDiscountPct, setFreeDiscountPct] = useState(0)
  const [freeVatRate, setFreeVatRate]       = useState(22)
  const [freePricesInclVat, setFreePricesInclVat] = useState(false)
  const [freeSaving, setFreeSaving]         = useState(false)
  const [freeFormError, setFreeFormError]   = useState('')

  // Type picker
  const [showTypePicker, setShowTypePicker] = useState(false)

  // Contact picker
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [contactSearch, setContactSearch]         = useState('')
  const [contactPickerTarget, setContactPickerTarget] = useState('rental') // 'rental' | 'free'

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

  // Item picker (rental)
  const [showItemPicker, setShowItemPicker]   = useState(false)
  const [itemPickerSearch, setItemPickerSearch] = useState('')

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabase()
    const { data } = await supabase
      .from('quotes')
      .select('*, quote_items(id), quote_free_items(id)')
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
      .select('id, name, email, phone, contact_type, company_name, vat_number, fiscal_code, sdi_code, pec, address, city, zip, province')
      .order('name')
      .then(({ data }) => setContacts(data || []))
  }, [fetchQuotes])

  // ── Open detail ──────────────────────────────────────────────────────────────
  async function openDetail(quote) {
    setDetailQuote(quote)
    setDetailLoading(true)
    const supabase = getSupabase()
    if (quote.quote_type === 'free') {
      const { data } = await supabase.from('quote_free_items').select('*').eq('quote_id', quote.id).order('created_at')
      setDetailItems(data || [])
    } else {
      const { data } = await supabase
        .from('quote_items')
        .select('*, equipment(id, name, brand, model, category, photo_url)')
        .eq('quote_id', quote.id)
      setDetailItems(data || [])
    }
    setDetailLoading(false)
  }

  // ── Rental: Create / edit ───────────────────────────────────────────────────
  function openNewRental() {
    setShowTypePicker(false)
    setEditingQuote(null)
    setForm(EMPTY_QUOTE)
    setQuoteItems([])
    setDiscountPct(0)
    setFormError('')
    setShowModal(true)
  }

  async function openEditRental(quote) {
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

  // ── Free: Create / edit ─────────────────────────────────────────────────────
  function openNewFree() {
    setShowTypePicker(false)
    setEditingFree(null)
    setFreeForm(EMPTY_QUOTE)
    setFreeItems([{ ...EMPTY_FREE_ITEM }])
    setFreeDiscountPct(0)
    setFreeVatRate(22)
    setFreePricesInclVat(false)
    setFreeFormError('')
    setShowFreeModal(true)
  }

  async function openEditFree(quote) {
    setEditingFree(quote)
    setFreeForm({
      title:        quote.title,
      client_name:  quote.client_name  || '',
      client_email: quote.client_email || '',
      start_date:   quote.start_date   || '',
      end_date:     quote.end_date     || '',
      notes:        quote.notes        || '',
    })
    const { data } = await getSupabase().from('quote_free_items').select('*').eq('quote_id', quote.id).order('created_at')
    setFreeItems((data || []).map((i) => ({
      description: i.description || '',
      detail:      i.detail || '',
      quantity:    i.quantity ?? 1,
      unit_price:  i.unit_price != null ? String(i.unit_price) : '',
    })))
    setFreeDiscountPct(parseFloat(quote.discount_pct) || 0)
    setFreeVatRate(parseFloat(quote.vat_rate) || 22)
    setFreePricesInclVat(!!quote.prices_include_vat)
    setFreeFormError('')
    setShowFreeModal(true)
    setDetailQuote(null)
  }

  function openEdit(quote) {
    if (quote.quote_type === 'free') openEditFree(quote)
    else openEditRental(quote)
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

  async function saveToContacts(name, email) {
    if (!name?.trim()) return
    const { data: newC } = await getSupabase().from('loan_contacts').insert({
      name:  name.trim(),
      email: email || null,
    }).select().single()
    if (newC) {
      setContacts((prev) => [...prev, newC].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('Contatto salvato in rubrica')
    }
  }

  // ── Rental: Save ─────────────────────────────────────────────────────────────
  async function handleSaveRental(e) {
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
      quote_type:   'rental',
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

  // ── Free: Save ───────────────────────────────────────────────────────────────
  async function handleSaveFree(e) {
    e.preventDefault()
    if (!freeForm.title.trim()) { setFreeFormError('Il titolo è obbligatorio'); return }
    const validItems = freeItems.filter(i => i.description.trim())
    if (validItems.length === 0) { setFreeFormError('Aggiungi almeno una voce'); return }
    setFreeSaving(true)
    setFreeFormError('')
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    const quotePayload = {
      title:             freeForm.title.trim(),
      client_name:       freeForm.client_name  || null,
      client_email:      freeForm.client_email || null,
      start_date:        freeForm.start_date   || null,
      end_date:          freeForm.end_date     || null,
      notes:             freeForm.notes        || null,
      discount_pct:      freeDiscountPct       || 0,
      quote_type:        'free',
      vat_rate:          freeVatRate,
      prices_include_vat: freePricesInclVat,
    }

    let quoteId
    if (editingFree) {
      const { error } = await supabase.from('quotes').update(quotePayload).eq('id', editingFree.id)
      if (error) { setFreeFormError(error.message); setFreeSaving(false); return }
      quoteId = editingFree.id
      await supabase.from('quote_free_items').delete().eq('quote_id', quoteId)
    } else {
      const { data: newQ, error } = await supabase.from('quotes').insert({
        user_id: user.id, status: 'draft', ...quotePayload,
      }).select().single()
      if (error || !newQ) { setFreeFormError(error?.message || 'Errore'); setFreeSaving(false); return }
      quoteId = newQ.id
    }

    await supabase.from('quote_free_items').insert(
      validItems.map((i) => ({
        quote_id:    quoteId,
        description: i.description.trim(),
        detail:      i.detail?.trim() || null,
        quantity:    parseFloat(i.quantity) || 1,
        unit_price:  i.unit_price !== '' ? parseFloat(i.unit_price) : 0,
      }))
    )

    setFreeSaving(false)
    setShowFreeModal(false)
    toast.success(editingFree ? 'Preventivo aggiornato' : 'Preventivo creato')
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
      quote_type:   quote.quote_type   || 'rental',
      vat_rate:     quote.vat_rate     || 22,
      prices_include_vat: quote.prices_include_vat || false,
    }).select().single()
    if (error || !newQ) { toast.error('Errore nella duplicazione'); return }
    if (quote.quote_type === 'free') {
      const { data: srcItems } = await supabase.from('quote_free_items').select('*').eq('quote_id', quote.id)
      if (srcItems?.length > 0) {
        await supabase.from('quote_free_items').insert(
          srcItems.map(({ id: _, quote_id: __, ...rest }) => ({ ...rest, quote_id: newQ.id }))
        )
      }
    } else {
      const { data: srcItems } = await supabase.from('quote_items').select('*').eq('quote_id', quote.id)
      if (srcItems?.length > 0) {
        await supabase.from('quote_items').insert(
          srcItems.map(({ id: _, quote_id: __, ...rest }) => ({ ...rest, quote_id: newQ.id }))
        )
      }
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

  // ── Enrich quote with contact ─────────────────────────────────────────────────
  function enrichQuote(quote) {
    const enriched = { ...quote }
    const matchedContact = contacts.find(c =>
      (c.email && c.email === quote.client_email) ||
      (c.name && c.name === quote.client_name) ||
      (c.company_name && c.company_name === quote.client_name)
    )
    if (matchedContact) enriched._contact = matchedContact
    return enriched
  }

  // ── Export PDF ────────────────────────────────────────────────────────────────
  async function handleExportPDF(quote) {
    setExportingId(quote.id)
    try {
      const supabase = getSupabase()
      let items = detailItems
      if (!detailQuote || detailQuote.id !== quote.id) {
        if (quote.quote_type === 'free') {
          const { data } = await supabase.from('quote_free_items').select('*').eq('quote_id', quote.id).order('created_at')
          items = data || []
        } else {
          const { data } = await supabase
            .from('quote_items')
            .select('*, equipment(id, name, brand, model, category, photo_url)')
            .eq('quote_id', quote.id)
          items = data || []
        }
      }
      const { data: settingsData } = await supabase.from('app_settings').select('key, value')
      const cs = settingsData ? Object.fromEntries(settingsData.map((s) => [s.key, s.value])) : {}
      await exportQuotePDF(enrichQuote(quote), items, cs)
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
        if (quote.quote_type === 'free') {
          const { data } = await supabase.from('quote_free_items').select('*').eq('quote_id', quote.id).order('created_at')
          items = data || []
        } else {
          const { data } = await supabase
            .from('quote_items')
            .select('*, equipment(id, name, brand, model, category, photo_url)')
            .eq('quote_id', quote.id)
          items = data || []
        }
      }
      const res  = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'quote', quote: enrichQuote(quote), items }),
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
    if (typeFilter !== 'all' && (q.quote_type || 'rental') !== typeFilter) return false
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

  function calcFreeBreakdown(items, dPct, vatRate, pricesInclVat) {
    const rawTotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 1) * (parseFloat(i.unit_price) || 0), 0)
    const pct = parseFloat(dPct) || 0
    const vr  = parseFloat(vatRate) || 22
    let imponibile, ivaAmt, totaleFinal
    if (pricesInclVat) {
      const discounted = rawTotal * (1 - pct / 100)
      totaleFinal = discounted
      imponibile  = discounted / (1 + vr / 100)
      ivaAmt      = totaleFinal - imponibile
    } else {
      imponibile  = rawTotal * (1 - pct / 100)
      ivaAmt      = imponibile * vr / 100
      totaleFinal = imponibile + ivaAmt
    }
    return { rawTotal, pct, discountAmt: rawTotal * pct / 100, imponibile, ivaAmt, totaleFinal, vatRate: vr, pricesInclVat }
  }

  // ── Contact picker helpers ────────────────────────────────────────────────────
  function openContactPicker(target) {
    setContactPickerTarget(target)
    setContactSearch('')
    setShowContactPicker(true)
  }

  function handleContactSelect(c) {
    const isCompany = c.contact_type === 'company'
    const label = isCompany ? (c.company_name || c.name) : c.name
    if (contactPickerTarget === 'free') {
      setFreeForm(f => ({ ...f, client_name: label, client_email: c.email || f.client_email, _contact: c }))
    } else {
      setForm(f => ({ ...f, client_name: label, client_email: c.email || f.client_email, _contact: c }))
    }
    setShowContactPicker(false)
  }

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────────
  if (detailQuote) {
    const isFree     = detailQuote.quote_type === 'free'
    const nextStatus = STATUS_FLOW[detailQuote.status]
    const dateStart  = detailQuote.start_date || detailQuote.event_date
    const dateEnd    = detailQuote.end_date
    const rentalDays = dateStart && dateEnd ? calcRentalDays(dateStart, dateEnd) : null

    // Build breakdown
    const bd = isFree
      ? calcFreeBreakdown(detailItems, detailQuote.discount_pct, detailQuote.vat_rate, detailQuote.prices_include_vat)
      : calcBreakdown(detailItems, detailQuote.discount_pct)

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
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={detailQuote.status} />
              <QuoteTypeBadge type={detailQuote.quote_type || 'rental'} />
            </div>
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
                  {dateEnd ? 'Periodo' : 'Data'}
                </p>
                <p className="text-sm font-semibold">
                  {format(parseISO(dateStart), 'd MMM yyyy', { locale: it })}
                  {dateEnd && <> → {format(parseISO(dateEnd), 'd MMM yyyy', { locale: it })}</>}
                </p>
                {rentalDays && <p className="text-xs text-muted-foreground">{rentalDays} giorni</p>}
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Creato il</p>
              <p className="text-sm font-semibold">{format(new Date(detailQuote.created_at), 'd MMM yyyy', { locale: it })}</p>
            </div>
          </div>

          {isFree && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                IVA {parseFloat(detailQuote.vat_rate) || 22}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                {detailQuote.prices_include_vat ? 'Prezzi IVA inclusa' : 'Prezzi + IVA'}
              </span>
            </div>
          )}

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
              {isFree ? `Voci — ${detailItems.length} rig${detailItems.length === 1 ? 'a' : 'he'}` : `Attrezzatura — ${detailItems.length} item`}
            </p>
          </div>
          {detailLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : detailItems.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Nessuna voce</div>
          ) : isFree ? (
            <div className="divide-y divide-border/50">
              {detailItems.map((item) => {
                const qty = parseFloat(item.quantity) || 1
                const price = parseFloat(item.unit_price) || 0
                const lineTotal = qty * price
                return (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{item.description}</p>
                      {item.detail && <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <p className="text-xs text-muted-foreground">Qt. {qty} × {fmtEur(price)}</p>
                      <p className="text-sm font-bold">{fmtEur(lineTotal)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
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
                      {lineTotal > 0 && <p className="text-sm font-bold">{fmtEur(lineTotal)}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Financial breakdown */}
        {(isFree ? bd.totaleFinal > 0 : bd.subtotal > 0) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Riepilogo economico</p>
            </div>
            <div className="px-5 py-4 space-y-2">
              {isFree ? (
                <>
                  {bd.pricesInclVat ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Totale (IVA inclusa)</span>
                        <span className="font-medium">{fmtEur(bd.rawTotal)}</span>
                      </div>
                      {bd.pct > 0 && (
                        <div className="flex justify-between text-sm text-emerald-400">
                          <span>Sconto {bd.pct}%</span>
                          <span>- {fmtEur(bd.discountAmt)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>di cui IVA {bd.vatRate}%</span>
                        <span>{fmtEur(bd.ivaAmt)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Imponibile</span>
                        <span>{fmtEur(bd.imponibile)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Imponibile</span>
                        <span className="font-medium">{fmtEur(bd.rawTotal)}</span>
                      </div>
                      {bd.pct > 0 && (
                        <>
                          <div className="flex justify-between text-sm text-emerald-400">
                            <span>Sconto {bd.pct}%</span>
                            <span>- {fmtEur(bd.discountAmt)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Imponibile netto</span>
                            <span className="font-medium">{fmtEur(bd.imponibile)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>IVA {bd.vatRate}%</span>
                        <span>{fmtEur(bd.ivaAmt)}</span>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>Totale</span>
                    <span>{fmtEur(bd.totaleFinal)}</span>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
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
  const maxDays      = quoteItems.length > 0 ? Math.max(...quoteItems.map((qi) => parseInt(qi.days) || 1)) : 1
  const suggestedDisc = getDurationDiscount(maxDays)
  const bd           = calcBreakdown(quoteItems, discountPct)
  const freeBd       = calcFreeBreakdown(freeItems, freeDiscountPct, freeVatRate, freePricesInclVat)
  const clientInContacts = contacts.some(
    (c) => c.name.toLowerCase() === form.client_name.trim().toLowerCase()
  )
  const freeClientInContacts = contacts.some(
    (c) => c.name.toLowerCase() === freeForm.client_name.trim().toLowerCase()
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
        <Button size="sm" onClick={() => setShowTypePicker(true)}>
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
        {/* Type filter */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1 py-1 border border-border/50 h-8">
          {[
            { value: 'all',    label: 'Tutti' },
            { value: 'rental', label: 'Noleggio' },
            { value: 'free',   label: 'Liberi' },
          ].map((opt) => (
            <button key={opt.value} onClick={() => setTypeFilter(opt.value)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition whitespace-nowrap ${
                typeFilter === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        {/* Status filter */}
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
            <Button size="sm" className="mt-4" onClick={() => setShowTypePicker(true)}>Crea il primo preventivo</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {displayQuotes.map((quote) => {
            const dateStart = quote.start_date || quote.event_date
            const isFree = quote.quote_type === 'free'
            const itemCount = isFree ? (quote.quote_free_items?.length ?? 0) : (quote.quote_items?.length ?? 0)
            return (
              <button key={quote.id} onClick={() => openDetail(quote)}
                className="flex items-center gap-4 bg-card rounded-xl border border-border px-5 py-4 hover:bg-muted/30 transition text-left w-full group">
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${isFree ? 'bg-blue-500/10' : 'bg-primary/10'}`}>
                  {isFree ? <FileText className="w-5 h-5 text-blue-400" /> : <Package className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold group-hover:text-primary transition truncate">{quote.title}</span>
                    <StatusBadge status={quote.status} />
                    <QuoteTypeBadge type={quote.quote_type || 'rental'} />
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
                      {isFree ? <FileText className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                      {itemCount} {isFree ? 'voc' + (itemCount === 1 ? 'e' : 'i') : 'item'}
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

      {/* ── DIALOG: Type picker ────────────────────────────────────────────── */}
      <Dialog open={showTypePicker} onOpenChange={(o) => { if (!o) setShowTypePicker(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo preventivo</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button onClick={openNewRental}
              className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition text-left space-y-2 group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold group-hover:text-primary transition">Preventivo Noleggio</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Noleggio attrezzatura dal tuo inventario</p>
            </button>
            <button onClick={openNewFree}
              className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition text-left space-y-2 group">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-sm font-semibold group-hover:text-primary transition">Preventivo Libero</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Servizi, lavori e voci personalizzate</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Rental Create / Edit ────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={(o) => { if (!o) setShowModal(false) }}>
        <DialogContent className="max-w-[900px] w-full max-h-[92vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
            <DialogTitle>{editingQuote ? 'Modifica preventivo noleggio' : 'Nuovo preventivo noleggio'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="space-y-1.5">
              <Label>Titolo *</Label>
              <Input value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Es. Preventivo Shooting 2025 — Mario Rossi" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <div className="flex gap-1.5">
                  <Input value={form.client_name}
                    onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                    placeholder="Nome cliente" className="flex-1" />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0"
                    title="Rubrica contatti"
                    onClick={() => openContactPicker('rental')}>
                    <BookUser className="w-4 h-4" />
                  </Button>
                </div>
                {form.client_name.trim() && !clientInContacts && (
                  <button type="button" onClick={() => saveToContacts(form.client_name, form.client_email)}
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

            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2} className="resize-none text-sm" placeholder="Note per il cliente…" />
            </div>

            <Separator />

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
                        <div className="flex gap-4 flex-wrap">
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Qtà</p>
                            <Input type="number" min="1" value={qi.quantity}
                              onChange={(e) => updateItem(qi.item_id, 'quantity', e.target.value)}
                              className="h-8 w-[60px] text-sm px-2" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Giorni</p>
                            <Input type="number" min="1" value={qi.days}
                              onChange={(e) => updateItem(qi.item_id, 'days', e.target.value)}
                              className="h-8 w-[70px] text-sm px-2" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">€/Giorno</p>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">€</span>
                              <Input type="number" min="0" step="1" value={qi.daily_rate}
                                onChange={(e) => updateItem(qi.item_id, 'daily_rate', e.target.value)}
                                className="h-8 w-[120px] text-sm pl-5 pr-2" placeholder="0" />
                            </div>
                          </div>
                        </div>
                        {suggested && eq?.purchase_price && (
                          <p className="text-xs text-muted-foreground italic mt-2">
                            Suggerito: €{suggested.daily}/g ({suggested.label} di €{parseFloat(eq.purchase_price).toLocaleString('it-IT')})
                          </p>
                        )}
                        {lineTotal > 0 && (
                          <p className="text-sm font-semibold text-right mt-2">{fmtEur(lineTotal)}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {quoteItems.some((i) => parseFloat(i.daily_rate) > 0) && (
                <div className="space-y-3 pt-1">
                  <Separator />
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Sconto %</Label>
                    <Input type="number" min="0" max="100" step="1" value={discountPct}
                      onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      className="h-8 w-20 text-sm" />
                    {suggestedDisc > 0 && (
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
                        onClick={() => setDiscountPct(suggestedDisc)}>
                        Applica -{suggestedDisc}%
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotale</span><span>{fmtEur(bd.subtotal)}</span></div>
                    {bd.pct > 0 && <div className="flex justify-between text-emerald-500"><span>Sconto {bd.pct}%</span><span>- {fmtEur(bd.discountAmt)}</span></div>}
                    {bd.pct > 0 && <div className="flex justify-between text-muted-foreground"><span>Netto</span><span>{fmtEur(bd.net)}</span></div>}
                    <div className="flex justify-between text-muted-foreground"><span>IVA 22%</span><span>{fmtEur(bd.iva)}</span></div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold"><span>Totale ivato</span><span>{fmtEur(bd.total)}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border flex-shrink-0">
            {formError && <p className="text-sm text-destructive mb-3">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button onClick={handleSaveRental} disabled={saving || !form.title.trim()}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingQuote ? 'Salva modifiche' : 'Crea preventivo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Free Create / Edit ──────────────────────────────────────── */}
      <Dialog open={showFreeModal} onOpenChange={(o) => { if (!o) setShowFreeModal(false) }}>
        <DialogContent className="max-w-[900px] w-full max-h-[92vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
            <DialogTitle>{editingFree ? 'Modifica preventivo libero' : 'Nuovo preventivo libero'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="space-y-1.5">
              <Label>Titolo *</Label>
              <Input value={freeForm.title}
                onChange={(e) => setFreeForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Es. Preventivo servizi video — Cliente" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <div className="flex gap-1.5">
                  <Input value={freeForm.client_name}
                    onChange={(e) => setFreeForm((f) => ({ ...f, client_name: e.target.value }))}
                    placeholder="Nome cliente" className="flex-1" />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0"
                    onClick={() => openContactPicker('free')}>
                    <BookUser className="w-4 h-4" />
                  </Button>
                </div>
                {freeForm.client_name.trim() && !freeClientInContacts && (
                  <button type="button" onClick={() => saveToContacts(freeForm.client_name, freeForm.client_email)}
                    className="text-xs text-primary hover:underline">
                    Salva in rubrica
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Email cliente</Label>
                <Input type="email" value={freeForm.client_email}
                  onChange={(e) => setFreeForm((f) => ({ ...f, client_email: e.target.value }))}
                  placeholder="cliente@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dal</Label>
                <Input type="date" value={freeForm.start_date}
                  onChange={(e) => setFreeForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Al</Label>
                <Input type="date" value={freeForm.end_date}
                  onChange={(e) => setFreeForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={freeForm.notes}
                onChange={(e) => setFreeForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2} className="resize-none text-sm" placeholder="Note per il cliente…" />
            </div>

            <Separator />

            {/* ── Voci ──────────────────────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Voci</Label>
                <span className="text-xs text-muted-foreground">{freeItems.length} rig{freeItems.length === 1 ? 'a' : 'he'}</span>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {freeItems.map((item, idx) => {
                  const qty   = parseFloat(item.quantity) || 0
                  const price = parseFloat(item.unit_price) || 0
                  const lineTotal = qty * price
                  return (
                    <div key={idx} className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <textarea value={item.description}
                          rows={1}
                          onChange={(e) => {
                            const next = [...freeItems]
                            next[idx] = { ...next[idx], description: e.target.value }
                            setFreeItems(next)
                          }}
                          onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                          placeholder="Descrizione voce (es. Riprese video 2 giorni, Post-produzione…)"
                          className="flex-1 text-sm rounded-md border border-border bg-background px-3 py-2 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
                        <button onClick={() => setFreeItems(prev => prev.filter((_, i) => i !== idx))}
                          className="ml-3 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex-shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea value={item.detail || ''}
                        rows={1}
                        onChange={(e) => {
                          const next = [...freeItems]
                          next[idx] = { ...next[idx], detail: e.target.value }
                          setFreeItems(next)
                        }}
                        onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                        placeholder="Dettaglio (es. Include operatore, attrezzatura, trasporto…)"
                        className="w-full mb-3 text-xs text-muted-foreground rounded-md border border-border/50 bg-muted/30 px-3 py-1.5 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
                      <div className="flex items-end gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Qtà</p>
                          <Input type="number" min="1" step="1" value={item.quantity}
                            onChange={(e) => {
                              const next = [...freeItems]
                              next[idx] = { ...next[idx], quantity: e.target.value }
                              setFreeItems(next)
                            }}
                            className="h-8 w-[60px] text-sm px-2" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Prezzo unit.</p>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">€</span>
                            <Input type="number" min="0" step="0.01" value={item.unit_price}
                              onChange={(e) => {
                                const next = [...freeItems]
                                next[idx] = { ...next[idx], unit_price: e.target.value }
                                setFreeItems(next)
                              }}
                              className="h-8 w-[120px] text-sm pl-5 pr-2" placeholder="0,00" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Totale</p>
                          <p className="h-8 flex items-center text-sm font-semibold">{lineTotal > 0 ? fmtEur(lineTotal) : '—'}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button type="button" variant="outline" size="sm"
                className="h-8 w-full border-dashed"
                onClick={() => setFreeItems(prev => [...prev, { ...EMPTY_FREE_ITEM }])}>
                <Plus className="w-3.5 h-3.5" />
                Aggiungi voce
              </Button>

              {/* ── IVA toggle + riepilogo ────────────────────────────────── */}
              {freeItems.some(i => parseFloat(i.unit_price) > 0) && (
                <div className="space-y-3 pt-1">
                  <Separator />

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => setFreePricesInclVat(!freePricesInclVat)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${freePricesInclVat ? 'bg-primary' : 'bg-muted'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${freePricesInclVat ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {freePricesInclVat ? 'Prezzi IVA inclusa' : 'Prezzi + IVA'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Aliquota IVA</Label>
                      <select value={freeVatRate}
                        onChange={(e) => setFreeVatRate(parseFloat(e.target.value))}
                        className="h-8 px-2 text-sm rounded-md border border-border bg-background text-foreground">
                        {VAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Sconto %</Label>
                    <Input type="number" min="0" max="100" step="1" value={freeDiscountPct}
                      onChange={(e) => setFreeDiscountPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      className="h-8 w-20 text-sm" />
                  </div>

                  <div className="space-y-1.5 text-sm">
                    {freePricesInclVat ? (
                      <>
                        <div className="flex justify-between text-muted-foreground"><span>Totale (IVA inclusa)</span><span>{fmtEur(freeBd.rawTotal)}</span></div>
                        {freeBd.pct > 0 && <div className="flex justify-between text-emerald-500"><span>Sconto {freeBd.pct}%</span><span>- {fmtEur(freeBd.discountAmt)}</span></div>}
                        <div className="flex justify-between text-muted-foreground"><span>di cui IVA {freeBd.vatRate}%</span><span>{fmtEur(freeBd.ivaAmt)}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Imponibile</span><span>{fmtEur(freeBd.imponibile)}</span></div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-muted-foreground"><span>Imponibile</span><span>{fmtEur(freeBd.rawTotal)}</span></div>
                        {freeBd.pct > 0 && <div className="flex justify-between text-emerald-500"><span>Sconto {freeBd.pct}%</span><span>- {fmtEur(freeBd.discountAmt)}</span></div>}
                        {freeBd.pct > 0 && <div className="flex justify-between text-muted-foreground"><span>Imponibile netto</span><span>{fmtEur(freeBd.imponibile)}</span></div>}
                        <div className="flex justify-between text-muted-foreground"><span>IVA {freeBd.vatRate}%</span><span>{fmtEur(freeBd.ivaAmt)}</span></div>
                      </>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold"><span>Totale</span><span>{fmtEur(freeBd.totaleFinal)}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border flex-shrink-0">
            {freeFormError && <p className="text-sm text-destructive mb-3">{freeFormError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFreeModal(false)}>Annulla</Button>
              <Button onClick={handleSaveFree} disabled={freeSaving || !freeForm.title.trim()}>
                {freeSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingFree ? 'Salva modifiche' : 'Crea preventivo'}
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
                .filter((c) => {
                  if (!contactSearch) return true
                  const s = contactSearch.toLowerCase()
                  return c.name?.toLowerCase().includes(s) || c.company_name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s)
                })
                .map((c) => {
                  const isCompany = c.contact_type === 'company'
                  const label = isCompany ? (c.company_name || c.name) : c.name
                  return (
                    <button key={c.id}
                      onClick={() => handleContactSelect(c)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition text-left">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isCompany ? 'bg-blue-500/10' : 'bg-primary/10'}`}>
                        {isCompany ? <Building2 className="w-3.5 h-3.5 text-blue-400" /> : <User className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{label}</p>
                        {isCompany && c.name && <p className="text-[11px] text-muted-foreground truncate">Ref. {c.name}</p>}
                        {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                      </div>
                    </button>
                  )
                })}
              {contacts.filter((c) => {
                if (!contactSearch) return true
                const s = contactSearch.toLowerCase()
                return c.name?.toLowerCase().includes(s) || c.company_name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s)
              }).length === 0 && (
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

      {/* ── DIALOG: Item picker (rental) ─────────────────────────────────── */}
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
