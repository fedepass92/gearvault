'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  BookUser, Plus, Search, X, Loader2, Pencil, Trash2,
  Mail, Phone, StickyNote, User, Building2, MapPin,
  FileText, ExternalLink, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

// ── Empty form ────────────────────────────────────────────────────────────────
const EMPTY = {
  contact_type: 'private',
  name: '', company_name: '', email: '', phone: '', pec: '',
  vat_number: '', fiscal_code: '', sdi_code: '',
  address: '', city: '', zip: '', province: '', country: 'Italia',
  notes: '',
}

function displayName(c) {
  return c.contact_type === 'company' ? (c.company_name || c.name || '—') : (c.name || '—')
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RubricaPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  // Create/edit modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  // Detail dialog
  const [detailContact, setDetailContact] = useState(null)
  const [history, setHistory]             = useState({ quotes: [], loans: [] })
  const [historyLoading, setHistoryLoading] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  // ── Fetch contacts ────────────────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('loan_contacts')
      .select('*')
      .order('name')
    if (!error) setContacts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  // ── Open detail ───────────────────────────────────────────────────────────
  async function openDetail(contact) {
    setDetailContact(contact)
    setHistoryLoading(true)
    const supabase = getSupabase()
    const [quotesRes, loansRes] = await Promise.all([
      supabase.from('quotes')
        .select('id, title, status, created_at, client_name, client_email')
        .or(`client_email.eq.${contact.email || ''},client_name.eq.${contact.name || ''}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('loans')
        .select('id, status, checkout_date, return_date, contact_id')
        .eq('contact_id', contact.id)
        .order('checkout_date', { ascending: false })
        .limit(20),
    ])
    setHistory({
      quotes: (quotesRes.data || []).filter(q => q.client_email === contact.email || q.client_name === contact.name),
      loans: loansRes.data || [],
    })
    setHistoryLoading(false)
  }

  // ── Open new / edit ───────────────────────────────────────────────────────
  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setFormError('')
    setShowModal(true)
  }

  function openEdit(contact) {
    setEditing(contact)
    setForm({
      contact_type: contact.contact_type || 'private',
      name:         contact.name || '',
      company_name: contact.company_name || '',
      email:        contact.email || '',
      phone:        contact.phone || '',
      pec:          contact.pec || '',
      vat_number:   contact.vat_number || '',
      fiscal_code:  contact.fiscal_code || '',
      sdi_code:     contact.sdi_code || '',
      address:      contact.address || '',
      city:         contact.city || '',
      zip:          contact.zip || '',
      province:     contact.province || '',
      country:      contact.country || 'Italia',
      notes:        contact.notes || '',
    })
    setFormError('')
    setShowModal(true)
    setDetailContact(null)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY)
    setFormError('')
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    const isCompany = form.contact_type === 'company'
    if (isCompany && !form.company_name.trim()) {
      setFormError('La ragione sociale è obbligatoria')
      return
    }
    if (!isCompany && !form.name.trim()) {
      setFormError('Il nome è obbligatorio')
      return
    }
    if (isCompany && !form.vat_number.trim()) {
      setFormError('La P.IVA è obbligatoria')
      return
    }

    setSaving(true)
    setFormError('')
    const supabase = getSupabase()
    const payload = {
      contact_type: form.contact_type,
      name:         form.name.trim() || null,
      company_name: isCompany ? form.company_name.trim() : null,
      email:        form.email.trim() || null,
      phone:        form.phone.trim() || null,
      pec:          form.pec.trim() || null,
      vat_number:   form.vat_number.trim() || null,
      fiscal_code:  form.fiscal_code.trim() || null,
      sdi_code:     form.sdi_code.trim() || null,
      address:      form.address.trim() || null,
      city:         form.city.trim() || null,
      zip:          form.zip.trim() || null,
      province:     form.province.trim() || null,
      country:      form.country.trim() || null,
      notes:        form.notes.trim() || null,
    }

    let error
    if (editing) {
      ;({ error } = await supabase.from('loan_contacts').update(payload).eq('id', editing.id))
    } else {
      ;({ error } = await supabase.from('loan_contacts').insert(payload))
    }
    setSaving(false)
    if (error) { setFormError('Errore nel salvataggio'); return }
    toast.success(editing ? 'Contatto aggiornato' : 'Contatto aggiunto')
    closeModal()
    fetchContacts()
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = getSupabase()
    const { error } = await supabase.from('loan_contacts').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) { toast.error('Errore nella cancellazione'); return }
    toast.success('Contatto eliminato')
    setDeleteTarget(null)
    setDetailContact(null)
    fetchContacts()
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase()
    return !q
      || c.name?.toLowerCase().includes(q)
      || c.company_name?.toLowerCase().includes(q)
      || c.email?.toLowerCase().includes(q)
      || c.phone?.includes(q)
  })

  const privateCount = contacts.filter(c => c.contact_type !== 'company').length
  const companyCount = contacts.filter(c => c.contact_type === 'company').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookUser className="w-6 h-6" />
            Rubrica
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {contacts.length} contatt{contacts.length === 1 ? 'o' : 'i'}
            {contacts.length > 0 && (
              <span className="ml-2 text-xs">
                ({privateCount} privat{privateCount === 1 ? 'o' : 'i'}, {companyCount} aziend{companyCount === 1 ? 'a' : 'e'})
              </span>
            )}
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Nuovo contatto
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome, azienda, email…"
          className="pl-9 h-9"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <BookUser className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {search ? 'Nessun contatto trovato' : 'Nessun contatto ancora. Aggiungine uno!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onClick={() => openDetail(contact)}
              onEdit={(e) => { e.stopPropagation(); openEdit(contact) }}
              onDelete={(e) => { e.stopPropagation(); setDeleteTarget(contact) }}
            />
          ))}
        </div>
      )}

      {/* ── Detail dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!detailContact} onOpenChange={(v) => { if (!v) setDetailContact(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
          {detailContact && (
            <>
              {/* Header */}
              <div className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border border-border ${
                      detailContact.contact_type === 'company' ? 'bg-blue-500/10' : 'bg-muted'
                    }`}>
                      {detailContact.contact_type === 'company'
                        ? <Building2 className="w-5 h-5 text-blue-400" />
                        : <User className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold truncate">{displayName(detailContact)}</h2>
                      {detailContact.contact_type === 'company' && detailContact.name && (
                        <p className="text-xs text-muted-foreground truncate">Ref. {detailContact.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className={`text-xs ${
                      detailContact.contact_type === 'company'
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {detailContact.contact_type === 'company' ? 'Azienda' : 'Privato'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => openEdit(detailContact)}>
                    <Pencil className="w-3.5 h-3.5" /> Modifica
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { setDetailContact(null); setDeleteTarget(detailContact) }}>
                    <Trash2 className="w-3.5 h-3.5" /> Elimina
                  </Button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Dati di contatto */}
                {(detailContact.email || detailContact.phone || detailContact.pec) && (
                  <DetailSection title="Dati di contatto">
                    {detailContact.email && (
                      <DetailRow icon={Mail} label="Email">
                        <a href={`mailto:${detailContact.email}`} className="text-primary hover:underline text-sm">
                          {detailContact.email}
                        </a>
                      </DetailRow>
                    )}
                    {detailContact.phone && (
                      <DetailRow icon={Phone} label="Telefono">
                        <a href={`tel:${detailContact.phone}`} className="text-primary hover:underline text-sm">
                          {detailContact.phone}
                        </a>
                      </DetailRow>
                    )}
                    {detailContact.pec && (
                      <DetailRow icon={Mail} label="PEC">
                        <a href={`mailto:${detailContact.pec}`} className="text-primary hover:underline text-sm">
                          {detailContact.pec}
                        </a>
                      </DetailRow>
                    )}
                  </DetailSection>
                )}

                {/* Dati fiscali */}
                {(detailContact.vat_number || detailContact.fiscal_code || detailContact.sdi_code) && (
                  <DetailSection title="Dati fiscali">
                    {detailContact.vat_number && (
                      <DetailRow label="P.IVA">
                        <span className="text-sm font-mono">{detailContact.vat_number}</span>
                      </DetailRow>
                    )}
                    {detailContact.fiscal_code && (
                      <DetailRow label="Codice Fiscale">
                        <span className="text-sm font-mono">{detailContact.fiscal_code}</span>
                      </DetailRow>
                    )}
                    {detailContact.sdi_code && (
                      <DetailRow label="Codice SDI">
                        <span className="text-sm font-mono">{detailContact.sdi_code}</span>
                      </DetailRow>
                    )}
                  </DetailSection>
                )}

                {/* Indirizzo */}
                {(detailContact.address || detailContact.city) && (
                  <DetailSection title="Indirizzo">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-sm">
                        {[
                          detailContact.address,
                          [detailContact.zip, detailContact.city].filter(Boolean).join(' '),
                          detailContact.province ? `(${detailContact.province})` : null,
                          detailContact.country && detailContact.country !== 'Italia' ? detailContact.country : null,
                        ].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </DetailSection>
                )}

                {/* Note */}
                {detailContact.notes && (
                  <DetailSection title="Note">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailContact.notes}</p>
                  </DetailSection>
                )}

                {/* Storico */}
                <DetailSection title="Storico">
                  {historyLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : history.quotes.length === 0 && history.loans.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Nessun preventivo o prestito associato</p>
                  ) : (
                    <div className="space-y-2">
                      {history.quotes.map(q => (
                        <div key={q.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 truncate">{q.title}</span>
                          <Badge variant="outline" className="text-[10px]">{q.status}</Badge>
                        </div>
                      ))}
                      {history.loans.map(l => (
                        <div key={l.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 truncate">Prestito #{l.id.slice(0, 8)}</span>
                          <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </DetailSection>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit modal ────────────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={(v) => { if (!v) closeModal() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
            <DialogTitle>{editing ? 'Modifica contatto' : 'Nuovo contatto'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Toggle tipo */}
            <div className="space-y-1.5">
              <Label>Tipo contatto</Label>
              <div className="flex gap-2">
                <Button
                  type="button" size="sm"
                  variant={form.contact_type === 'private' ? 'default' : 'outline'}
                  onClick={() => setForm(f => ({ ...f, contact_type: 'private' }))}
                  className="flex-1 gap-1.5"
                >
                  <User className="w-3.5 h-3.5" /> Privato
                </Button>
                <Button
                  type="button" size="sm"
                  variant={form.contact_type === 'company' ? 'default' : 'outline'}
                  onClick={() => setForm(f => ({ ...f, contact_type: 'company' }))}
                  className="flex-1 gap-1.5"
                >
                  <Building2 className="w-3.5 h-3.5" /> Azienda
                </Button>
              </div>
            </div>

            <Separator />

            {form.contact_type === 'company' ? (
              /* ── Campi AZIENDA ─────────────────────────────────────────── */
              <>
                <div className="space-y-1.5">
                  <Label>Ragione sociale <span className="text-destructive">*</span></Label>
                  <Input value={form.company_name}
                    onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))}
                    placeholder="Azienda S.r.l." className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome referente</Label>
                  <Input value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Mario Rossi" className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.email}
                      onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="info@azienda.it" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>PEC</Label>
                    <Input type="email" value={form.pec}
                      onChange={(e) => setForm(f => ({ ...f, pec: e.target.value }))}
                      placeholder="azienda@pec.it" className="h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Telefono</Label>
                  <Input type="tel" value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+39 02 1234567" className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>P.IVA <span className="text-destructive">*</span></Label>
                    <Input value={form.vat_number}
                      onChange={(e) => setForm(f => ({ ...f, vat_number: e.target.value }))}
                      placeholder="01234567890" className="h-9 font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Codice Fiscale</Label>
                    <Input value={form.fiscal_code}
                      onChange={(e) => setForm(f => ({ ...f, fiscal_code: e.target.value }))}
                      placeholder="01234567890" className="h-9 font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Codice SDI</Label>
                  <Input value={form.sdi_code}
                    onChange={(e) => setForm(f => ({ ...f, sdi_code: e.target.value }))}
                    placeholder="KRRH6B9" className="h-9 font-mono" maxLength={7} />
                </div>
              </>
            ) : (
              /* ── Campi PRIVATO ─────────────────────────────────────────── */
              <>
                <div className="space-y-1.5">
                  <Label>Nome completo <span className="text-destructive">*</span></Label>
                  <Input value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Mario Rossi" className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.email}
                      onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="mario@esempio.it" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefono</Label>
                    <Input type="tel" value={form.phone}
                      onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+39 333 123 4567" className="h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Codice Fiscale</Label>
                  <Input value={form.fiscal_code}
                    onChange={(e) => setForm(f => ({ ...f, fiscal_code: e.target.value }))}
                    placeholder="RSSMRA85M01H501Z" className="h-9 font-mono" />
                </div>
              </>
            )}

            <Separator />

            {/* ── Indirizzo (shared) ──────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label>Indirizzo</Label>
              <Input value={form.address}
                onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Via Roma 1" className="h-9" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Città</Label>
                <Input value={form.city}
                  onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Roma" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label>CAP</Label>
                <Input value={form.zip}
                  onChange={(e) => setForm(f => ({ ...f, zip: e.target.value }))}
                  placeholder="00100" className="h-9" maxLength={5} />
              </div>
              <div className="space-y-1.5">
                <Label>Provincia</Label>
                <Input value={form.province}
                  onChange={(e) => setForm(f => ({ ...f, province: e.target.value }))}
                  placeholder="RM" className="h-9" maxLength={2} />
              </div>
            </div>

            {/* ── Note ────────────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Informazioni aggiuntive…"
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
            <Button variant="outline" size="sm" onClick={closeModal} disabled={saving}>Annulla</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? 'Salva modifiche' : 'Aggiungi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Elimina contatto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            Sei sicuro di voler eliminare <span className="font-medium text-foreground">{deleteTarget && displayName(deleteTarget)}</span>? L&apos;operazione è irreversibile.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>Annulla</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Contact Card ──────────────────────────────────────────────────────────────
function ContactCard({ contact, onClick, onEdit, onDelete }) {
  const isCompany = contact.contact_type === 'company'
  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border border-border ${
            isCompany ? 'bg-blue-500/10' : 'bg-muted'
          }`}>
            {isCompany
              ? <Building2 className="w-4 h-4 text-blue-400" />
              : <User className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <span className="font-medium text-sm truncate block">{displayName(contact)}</span>
            {isCompany && contact.name && (
              <span className="text-[11px] text-muted-foreground truncate block">Ref. {contact.name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant="outline" className={`text-[10px] ${
            isCompany
              ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
              : 'bg-muted text-muted-foreground border-border'
          }`}>
            {isCompany ? 'Azienda' : 'Privato'}
          </Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        {contact.email && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>{contact.phone}</span>
          </div>
        )}
      </div>

      {/* Edit/Delete on hover */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Modifica"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Elimina"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      </div>
    </div>
  )
}

// ── Detail helpers ────────────────────────────────────────────────────────────
function DetailSection({ title, children }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-2.5">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      {label && !Icon && <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>}
      {label && Icon && <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{label}</span>}
      {children}
    </div>
  )
}
