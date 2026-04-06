'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  HandHelping, Plus, Search, X, Loader2, CheckCircle2,
  AlertTriangle, Clock, User, Phone, Mail, Calendar,
  Pencil, Trash2, BookUser, ChevronRight, Package,
} from 'lucide-react'
import { format, parseISO, differenceInDays, isPast } from 'date-fns'
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CFG = {
  active:   { label: 'In prestito',  bg: 'bg-blue-500/15',    text: 'text-blue-300',    border: 'border-blue-500/20' },
  returned: { label: 'Restituito',   bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/20' },
  overdue:  { label: 'Scaduto',      bg: 'bg-red-500/15',     text: 'text-red-300',     border: 'border-red-500/20' },
}

function loanStatus(loan) {
  if (loan.actual_return) return 'returned'
  if (loan.expected_return && isPast(parseISO(loan.expected_return + 'T23:59:59'))) return 'overdue'
  return 'active'
}

// ── Empty forms ────────────────────────────────────────────────────────────────
const EMPTY_LOAN = {
  item_id: '', contact_id: '', loan_date: format(new Date(), 'yyyy-MM-dd'),
  expected_return: '', notes: '',
}
const EMPTY_CONTACT = { name: '', email: '', phone: '', notes: '' }

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.active
  return (
    <Badge variant="outline" className={`text-xs border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {status === 'overdue' && <AlertTriangle className="w-2.5 h-2.5 mr-1" />}
      {status === 'returned' && <CheckCircle2 className="w-2.5 h-2.5 mr-1" />}
      {cfg.label}
    </Badge>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function PrestitiPage() {
  const [loans, setLoans]               = useState([])
  const [contacts, setContacts]         = useState([])
  const [equipment, setEquipment]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState('loans') // 'loans' | 'contacts'
  const [statusFilter, setStatusFilter] = useState('all')  // 'all'|'active'|'returned'|'overdue'
  const [search, setSearch]             = useState('')

  // New loan dialog
  const [showLoanModal, setShowLoanModal]   = useState(false)
  const [loanForm, setLoanForm]             = useState(EMPTY_LOAN)
  const [savingLoan, setSavingLoan]         = useState(false)
  const [loanError, setLoanError]           = useState('')
  // Inline new contact inside loan form
  const [newContactInline, setNewContactInline] = useState(false)
  const [inlineContact, setInlineContact]       = useState(EMPTY_CONTACT)

  // Return dialog
  const [returnTarget, setReturnTarget]   = useState(null)
  const [returningLoan, setReturningLoan] = useState(false)

  // Loan detail
  const [detailLoan, setDetailLoan]       = useState(null)

  // Contact CRUD
  const [showContactModal, setShowContactModal]   = useState(false)
  const [contactForm, setContactForm]             = useState(EMPTY_CONTACT)
  const [editingContact, setEditingContact]       = useState(null)
  const [savingContact, setSavingContact]         = useState(false)
  const [deleteContact, setDeleteContact]         = useState(null)
  const [deletingContact, setDeletingContact]     = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabase()
    const [{ data: loansData }, { data: contactsData }, { data: eqData }] = await Promise.all([
      supabase.from('loans').select('*, loan_contacts(*), equipment(id, name, brand, model, photo_url)').order('loan_date', { ascending: false }),
      supabase.from('loan_contacts').select('*').order('name'),
      supabase.from('equipment').select('id, name, brand, model, photo_url').eq('condition', 'active').order('name'),
    ])
    setLoans(loansData || [])
    setContacts(contactsData || [])
    setEquipment(eqData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Computed ─────────────────────────────────────────────────────────────────
  const loansWithStatus = loans.map((l) => ({ ...l, _status: loanStatus(l) }))

  const activeLoanedIds = new Set(
    loansWithStatus.filter((l) => l._status !== 'returned').map((l) => l.item_id)
  )

  const displayLoans = loansWithStatus.filter((l) => {
    if (statusFilter !== 'all' && l._status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        l.equipment?.name?.toLowerCase().includes(q) ||
        l.loan_contacts?.name?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const stats = {
    active:   loansWithStatus.filter((l) => l._status === 'active').length,
    overdue:  loansWithStatus.filter((l) => l._status === 'overdue').length,
    returned: loansWithStatus.filter((l) => l._status === 'returned').length,
  }

  // ── New loan ─────────────────────────────────────────────────────────────────
  function openNewLoan() {
    setLoanForm(EMPTY_LOAN)
    setLoanError('')
    setNewContactInline(false)
    setInlineContact(EMPTY_CONTACT)
    setShowLoanModal(true)
  }

  async function handleSaveLoan(e) {
    e.preventDefault()
    setLoanError('')
    if (!loanForm.item_id) { setLoanError('Seleziona un item'); return }

    setSavingLoan(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    let contactId = loanForm.contact_id

    // Create inline contact if needed
    if (newContactInline) {
      if (!inlineContact.name.trim()) { setLoanError('Inserisci il nome del contatto'); setSavingLoan(false); return }
      const { data: newC, error: cErr } = await supabase
        .from('loan_contacts')
        .insert({ name: inlineContact.name.trim(), email: inlineContact.email || null, phone: inlineContact.phone || null, notes: inlineContact.notes || null })
        .select().single()
      if (cErr || !newC) { setLoanError('Errore nella creazione del contatto'); setSavingLoan(false); return }
      contactId = newC.id
      setContacts((prev) => [...prev, newC].sort((a, b) => a.name.localeCompare(b.name)))
    }

    if (!contactId) { setLoanError('Seleziona o crea un contatto'); setSavingLoan(false); return }

    const { error } = await supabase.from('loans').insert({
      item_id: loanForm.item_id,
      contact_id: contactId,
      loaned_by: user.id,
      loan_date: loanForm.loan_date,
      expected_return: loanForm.expected_return || null,
      notes: loanForm.notes || null,
      status: 'active',
    })

    setSavingLoan(false)
    if (error) { setLoanError(error.message); return }

    setShowLoanModal(false)
    toast.success('Prestito registrato')
    fetchAll()
  }

  // ── Register return ───────────────────────────────────────────────────────────
  async function handleReturn() {
    if (!returnTarget) return
    setReturningLoan(true)
    const supabase = getSupabase()
    const today = format(new Date(), 'yyyy-MM-dd')
    const { error } = await supabase
      .from('loans')
      .update({ actual_return: today, status: 'returned' })
      .eq('id', returnTarget.id)
    setReturningLoan(false)
    setReturnTarget(null)
    setDetailLoan(null)
    if (error) { toast.error('Errore nella restituzione'); return }
    toast.success('Restituzione registrata')
    fetchAll()
  }

  // ── Contact CRUD ──────────────────────────────────────────────────────────────
  function openNewContact() {
    setEditingContact(null)
    setContactForm(EMPTY_CONTACT)
    setShowContactModal(true)
  }

  function openEditContact(c) {
    setEditingContact(c)
    setContactForm({ name: c.name, email: c.email || '', phone: c.phone || '', notes: c.notes || '' })
    setShowContactModal(true)
  }

  async function handleSaveContact(e) {
    e.preventDefault()
    if (!contactForm.name.trim()) return
    setSavingContact(true)
    const supabase = getSupabase()

    if (editingContact) {
      const { error } = await supabase.from('loan_contacts').update({
        name: contactForm.name.trim(), email: contactForm.email || null,
        phone: contactForm.phone || null, notes: contactForm.notes || null,
      }).eq('id', editingContact.id)
      if (error) { toast.error('Errore nel salvataggio'); setSavingContact(false); return }
      setContacts((prev) => prev.map((c) => c.id === editingContact.id ? { ...c, ...contactForm, name: contactForm.name.trim() } : c))
      toast.success('Contatto aggiornato')
    } else {
      const { data, error } = await supabase.from('loan_contacts').insert({
        name: contactForm.name.trim(), email: contactForm.email || null,
        phone: contactForm.phone || null, notes: contactForm.notes || null,
      }).select().single()
      if (error || !data) { toast.error('Errore nella creazione'); setSavingContact(false); return }
      setContacts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('Contatto aggiunto')
    }

    setSavingContact(false)
    setShowContactModal(false)
  }

  async function handleDeleteContact() {
    if (!deleteContact) return
    setDeletingContact(true)
    const supabase = getSupabase()
    const { error } = await supabase.from('loan_contacts').delete().eq('id', deleteContact.id)
    setDeletingContact(false)
    setDeleteContact(null)
    if (error) { toast.error('Impossibile eliminare — potrebbe avere prestiti associati'); return }
    setContacts((prev) => prev.filter((c) => c.id !== deleteContact.id))
    toast.success('Contatto eliminato')
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Prestiti</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {stats.active} attivi
            {stats.overdue > 0 && <span className="text-red-400 ml-2">· {stats.overdue} scaduti</span>}
          </p>
        </div>
        {tab === 'loans' && (
          <Button size="sm" onClick={openNewLoan}>
            <Plus className="w-4 h-4" />
            Nuovo prestito
          </Button>
        )}
        {tab === 'contacts' && (
          <Button size="sm" onClick={openNewContact}>
            <Plus className="w-4 h-4" />
            Nuovo contatto
          </Button>
        )}
      </div>

      {/* Stats bar */}
      {!loading && tab === 'loans' && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'active',   label: 'In prestito', color: 'text-blue-400',    icon: Clock },
            { key: 'overdue',  label: 'Scaduti',     color: 'text-red-400',     icon: AlertTriangle },
            { key: 'returned', label: 'Restituiti',  color: 'text-emerald-400', icon: CheckCircle2 },
          ].map(({ key, label, color, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={`bg-card border rounded-xl p-3 text-left transition hover:border-primary/40 ${statusFilter === key ? 'border-primary/60 bg-primary/5' : 'border-border'}`}
            >
              <div className={`flex items-center gap-1.5 text-xs font-medium ${color} mb-1`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </div>
              <div className="text-2xl font-bold">{stats[key]}</div>
            </button>
          ))}
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 border border-border/50 w-fit">
        {[
          { key: 'loans',    label: 'Prestiti',   icon: HandHelping },
          { key: 'contacts', label: 'Rubrica',     icon: BookUser },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
              tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {key === 'contacts' && contacts.length > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                {contacts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── LOANS TAB ───────────────────────────────────────────────────────── */}
      {tab === 'loans' && (
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca item o contatto…" className="pl-8 h-8 text-sm" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1 py-1 border border-border/50 h-8">
              {[
                { value: 'all',      label: 'Tutti' },
                { value: 'active',   label: 'Attivi' },
                { value: 'overdue',  label: 'Scaduti' },
                { value: 'returned', label: 'Restituiti' },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition whitespace-nowrap ${statusFilter === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayLoans.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <HandHelping className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm font-medium">Nessun prestito trovato</p>
              {loans.length === 0 && (
                <p className="text-muted-foreground/60 text-xs mt-1">Registra il primo prestito con il bottone in alto</p>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              {displayLoans.map((loan) => {
                const st = loan._status
                const eq = loan.equipment
                const ct = loan.loan_contacts
                const daysLeft = loan.expected_return
                  ? differenceInDays(parseISO(loan.expected_return), new Date())
                  : null

                return (
                  <button
                    key={loan.id}
                    onClick={() => setDetailLoan(loan)}
                    className={`flex items-center gap-4 bg-card rounded-xl border px-5 py-4 hover:bg-muted/30 transition text-left w-full group ${
                      st === 'overdue' ? 'border-red-500/30' : 'border-border'
                    }`}
                  >
                    {/* Photo / icon */}
                    <div className="flex-shrink-0">
                      {eq?.photo_url ? (
                        <img src={eq.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold group-hover:text-primary transition truncate">
                          {eq?.name || '—'}
                        </span>
                        <StatusBadge status={st} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {ct && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {ct.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(loan.loan_date), 'd MMM yyyy', { locale: it })}
                        </span>
                        {loan.expected_return && st !== 'returned' && (
                          <span className={`flex items-center gap-1 ${st === 'overdue' ? 'text-red-400 font-medium' : daysLeft != null && daysLeft <= 3 ? 'text-amber-400' : ''}`}>
                            <Clock className="w-3 h-3" />
                            {st === 'overdue'
                              ? `Scaduto ${Math.abs(daysLeft)}gg fa`
                              : daysLeft === 0 ? 'Scade oggi'
                              : `Scade tra ${daysLeft}gg`
                            }
                          </span>
                        )}
                        {loan.actual_return && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Restituito {format(parseISO(loan.actual_return), 'd MMM yyyy', { locale: it })}
                          </span>
                        )}
                      </div>
                    </div>

                    {st !== 'returned' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-shrink-0"
                        onClick={(ev) => { ev.stopPropagation(); setReturnTarget(loan) }}
                      >
                        Restituito
                      </Button>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── CONTACTS TAB ────────────────────────────────────────────────────── */}
      {tab === 'contacts' && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <BookUser className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm font-medium">Nessun contatto salvato</p>
              <p className="text-muted-foreground/60 text-xs mt-1">I contatti vengono creati durante il prestito o da qui</p>
            </div>
          ) : (
            contacts.map((c) => {
              const cLoans = loansWithStatus.filter((l) => l.contact_id === c.id)
              const active = cLoans.filter((l) => l._status !== 'returned').length
              return (
                <div key={c.id} className="flex items-center gap-4 bg-card rounded-xl border border-border px-5 py-4">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{c.name[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </span>
                      )}
                      {cLoans.length > 0 && (
                        <span className="text-muted-foreground/60">
                          {cLoans.length} prestit{cLoans.length !== 1 ? 'i' : 'o'}
                          {active > 0 && <span className="text-blue-400 ml-1">· {active} attiv{active !== 1 ? 'i' : 'o'}</span>}
                        </span>
                      )}
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground/60 mt-1 truncate max-w-xs">{c.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEditContact(c)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteContact(c)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── DIALOG: Nuovo prestito ────────────────────────────────────────────── */}
      <Dialog open={showLoanModal} onOpenChange={(o) => { if (!o) setShowLoanModal(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><HandHelping className="w-4 h-4" /> Nuovo prestito</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveLoan} className="space-y-4">

            {/* Item select */}
            <div className="space-y-1.5">
              <Label>Attrezzatura *</Label>
              <Select value={loanForm.item_id} onValueChange={(v) => setLoanForm((f) => ({ ...f, item_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona un item…" /></SelectTrigger>
                <SelectContent>
                  {equipment
                    .filter((eq) => !activeLoanedIds.has(eq.id))
                    .map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.name}{eq.brand ? ` — ${eq.brand}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contact select / create */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Contatto *</Label>
                <button type="button" onClick={() => setNewContactInline((v) => !v)}
                  className="text-xs text-primary hover:underline">
                  {newContactInline ? '← Seleziona esistente' : '+ Nuovo contatto'}
                </button>
              </div>
              {newContactInline ? (
                <div className="space-y-2 bg-muted/30 border border-border rounded-lg p-3">
                  <Input value={inlineContact.name} onChange={(e) => setInlineContact((f) => ({ ...f, name: e.target.value }))} placeholder="Nome *" className="h-8 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={inlineContact.email} onChange={(e) => setInlineContact((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className="h-8 text-sm" type="email" />
                    <Input value={inlineContact.phone} onChange={(e) => setInlineContact((f) => ({ ...f, phone: e.target.value }))} placeholder="Telefono" className="h-8 text-sm" />
                  </div>
                </div>
              ) : (
                <Select value={loanForm.contact_id} onValueChange={(v) => setLoanForm((f) => ({ ...f, contact_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona un contatto…" /></SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.email ? ` (${c.email})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data prestito *</Label>
                <Input type="date" value={loanForm.loan_date} onChange={(e) => setLoanForm((f) => ({ ...f, loan_date: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Restituzione prevista</Label>
                <Input type="date" value={loanForm.expected_return} onChange={(e) => setLoanForm((f) => ({ ...f, expected_return: e.target.value }))} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={loanForm.notes} onChange={(e) => setLoanForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="resize-none text-sm" placeholder="Note sul prestito…" />
            </div>

            {loanError && <p className="text-sm text-destructive">{loanError}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowLoanModal(false)}>Annulla</Button>
              <Button type="submit" disabled={savingLoan}>
                {savingLoan && <Loader2 className="w-4 h-4 animate-spin" />}
                Registra prestito
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Dettaglio prestito ────────────────────────────────────────── */}
      <Dialog open={!!detailLoan} onOpenChange={(o) => { if (!o) setDetailLoan(null) }}>
        <DialogContent className="max-w-sm">
          {detailLoan && (() => {
            const st = detailLoan._status
            const eq = detailLoan.equipment
            const ct = detailLoan.loan_contacts
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <HandHelping className="w-4 h-4" />
                    Dettaglio prestito
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <StatusBadge status={st} />

                  {/* Item */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Attrezzatura</p>
                    <div className="flex items-center gap-3">
                      {eq?.photo_url ? (
                        <img src={eq.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted border border-border flex-shrink-0 flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-sm">{eq?.name}</p>
                        {(eq?.brand || eq?.model) && (
                          <p className="text-xs text-muted-foreground">{[eq?.brand, eq?.model].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  {ct && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Prestato a</p>
                      <p className="font-semibold text-sm">{ct.name}</p>
                      {ct.email && <p className="text-xs text-muted-foreground">{ct.email}</p>}
                      {ct.phone && <p className="text-xs text-muted-foreground">{ct.phone}</p>}
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Data prestito</p>
                      <p className="text-sm font-medium">{format(parseISO(detailLoan.loan_date), 'd MMM yyyy', { locale: it })}</p>
                    </div>
                    {detailLoan.expected_return && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Restituzione prevista</p>
                        <p className={`text-sm font-medium ${st === 'overdue' ? 'text-red-400' : ''}`}>
                          {format(parseISO(detailLoan.expected_return), 'd MMM yyyy', { locale: it })}
                        </p>
                      </div>
                    )}
                    {detailLoan.actual_return && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Restituito il</p>
                        <p className="text-sm font-medium text-emerald-400">{format(parseISO(detailLoan.actual_return), 'd MMM yyyy', { locale: it })}</p>
                      </div>
                    )}
                  </div>

                  {detailLoan.notes && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Note</p>
                      <p className="text-sm text-muted-foreground">{detailLoan.notes}</p>
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setDetailLoan(null)}>Chiudi</Button>
                  {st !== 'returned' && (
                    <Button onClick={() => setReturnTarget(detailLoan)}>
                      <CheckCircle2 className="w-4 h-4" />
                      Registra restituzione
                    </Button>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Conferma restituzione ─────────────────────────────────────── */}
      <Dialog open={!!returnTarget} onOpenChange={(o) => { if (!o) setReturnTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Registra restituzione
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Conferma la restituzione di{' '}
            <strong className="text-foreground">{returnTarget?.equipment?.name}</strong>
            {returnTarget?.loan_contacts?.name && (
              <> da parte di <strong className="text-foreground">{returnTarget.loan_contacts.name}</strong></>
            )}
            . Verrà registrata la data di oggi.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReturnTarget(null)} disabled={returningLoan}>Annulla</Button>
            <Button onClick={handleReturn} disabled={returningLoan}>
              {returningLoan && <Loader2 className="w-4 h-4 animate-spin" />}
              Conferma restituzione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Contatto ─────────────────────────────────────────────────── */}
      <Dialog open={showContactModal} onOpenChange={(o) => { if (!o) setShowContactModal(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Modifica contatto' : 'Nuovo contatto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveContact} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Mario Rossi" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} placeholder="mario@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefono</Label>
                <Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+39 333 000000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={contactForm.notes} onChange={(e) => setContactForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="resize-none text-sm" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowContactModal(false)}>Annulla</Button>
              <Button type="submit" disabled={savingContact || !contactForm.name.trim()}>
                {savingContact && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingContact ? 'Salva' : 'Aggiungi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Elimina contatto ──────────────────────────────────────────── */}
      <Dialog open={!!deleteContact} onOpenChange={(o) => { if (!o) setDeleteContact(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Elimina contatto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler eliminare <strong className="text-foreground">{deleteContact?.name}</strong>?
            I prestiti associati rimarranno nello storico.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteContact(null)} disabled={deletingContact}>Annulla</Button>
            <Button variant="destructive" onClick={handleDeleteContact} disabled={deletingContact}>
              {deletingContact && <Loader2 className="w-4 h-4 animate-spin" />}
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
