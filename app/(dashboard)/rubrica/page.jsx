'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  BookUser, Plus, Search, X, Loader2, Pencil, Trash2,
  Mail, Phone, StickyNote, User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const EMPTY = { name: '', email: '', phone: '', notes: '' }

export default function RubricaPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null) // null = new, object = edit
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

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

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setFormError('')
    setShowModal(true)
  }

  function openEdit(contact) {
    setEditing(contact)
    setForm({ name: contact.name || '', email: contact.email || '', phone: contact.phone || '', notes: contact.notes || '' })
    setFormError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY)
    setFormError('')
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Il nome è obbligatorio'); return }
    setSaving(true)
    setFormError('')
    const supabase = getSupabase()
    const payload = {
      name:  form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
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

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = getSupabase()
    const { error } = await supabase.from('loan_contacts').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) { toast.error('Errore nella cancellazione'); return }
    toast.success('Contatto eliminato')
    setDeleteTarget(null)
    fetchContacts()
  }

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
  })

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
            {contacts.length} {contacts.length === 1 ? 'contatto' : 'contatti'}
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
          placeholder="Cerca per nome o email…"
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
              onEdit={() => openEdit(contact)}
              onDelete={() => setDeleteTarget(contact)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Dialog open={showModal} onOpenChange={(v) => { if (!v) closeModal() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica contatto' : 'Nuovo contatto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mario Rossi"
                className="h-9"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="mario@esempio.it"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefono</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+39 333 123 4567"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Informazioni aggiuntive…"
                rows={3}
                className="resize-none text-sm"
              />
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeModal} disabled={saving}>Annulla</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? 'Salva modifiche' : 'Aggiungi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Elimina contatto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            Sei sicuro di voler eliminare <span className="font-medium text-foreground">{deleteTarget?.name}</span>? L&apos;operazione è irreversibile.
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

function ContactCard({ contact, onEdit, onDelete }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border border-border">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="font-medium text-sm truncate">{contact.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
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
      </div>

      <div className="space-y-1.5">
        {contact.email && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <a href={`mailto:${contact.email}`} className="truncate hover:text-foreground transition-colors">
              {contact.email}
            </a>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <a href={`tel:${contact.phone}`} className="hover:text-foreground transition-colors">
              {contact.phone}
            </a>
          </div>
        )}
        {contact.notes && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <StickyNote className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">{contact.notes}</span>
          </div>
        )}
      </div>
    </div>
  )
}
