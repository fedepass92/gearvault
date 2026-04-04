'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import {
  ArrowLeft, Layers, Plus, Trash2, Search, Loader2, Package, Pencil, QrCode,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function KitDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [kitData, setKitData] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [availableEquipment, setAvailableEquipment] = useState([])
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchKit = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = await supabase.from('kits').select('*').eq('id', id).single()
    if (!data) { router.push('/kit'); return }
    setKitData(data)
    setEditForm({ name: data.name, description: data.description || '' })

    const { data: itemsData } = await supabase
      .from('kit_items')
      .select('*, equipment(id, name, brand, model, serial_number, category, market_value, insured_value, battery_status, condition)')
      .eq('kit_id', id)
      .order('added_at', { ascending: true })
    setItems(itemsData || [])
    setLoading(false)
  }, [id, router])

  useEffect(() => { fetchKit() }, [fetchKit])

  useEffect(() => {
    if (!showAddPicker) return
    async function fetchEquipment() {
      const supabase = getSupabase()
      let q = supabase.from('equipment').select('id, name, brand, model, serial_number, category').order('name')
      if (pickerSearch) q = q.or(`name.ilike.%${pickerSearch}%,serial_number.ilike.%${pickerSearch}%,brand.ilike.%${pickerSearch}%`)
      const { data } = await q
      const addedIds = new Set(items.map((i) => i.equipment_id))
      setAvailableEquipment((data || []).filter((e) => !addedIds.has(e.id)))
    }
    fetchEquipment()
  }, [showAddPicker, pickerSearch, items])

  async function addItem(equipment) {
    const supabase = getSupabase()
    await supabase.from('kit_items').insert({ kit_id: id, equipment_id: equipment.id })
    setShowAddPicker(false)
    setPickerSearch('')
    fetchKit()
  }

  async function removeItem(kitItemId) {
    const supabase = getSupabase()
    await supabase.from('kit_items').delete().eq('id', kitItemId)
    fetchKit()
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    const supabase = getSupabase()
    await supabase.from('kits').update({
      name: editForm.name,
      description: editForm.description || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setEditModal(false)
    setEditSaving(false)
    fetchKit()
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = getSupabase()
    await supabase.from('kits').delete().eq('id', id)
    router.push('/kit')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!kitData) return null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()} className="mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-violet-400 flex-shrink-0" />
            <h1 className="text-xl font-bold truncate">{kitData.name}</h1>
          </div>
          {kitData.description && (
            <p className="text-xs text-muted-foreground mt-1 ml-7">{kitData.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5 ml-7">
            {items.length} item · creato {format(new Date(kitData.created_at), 'd MMM yyyy', { locale: it })}
            {items.length > 0 && (() => {
              const total = items.reduce((s, i) => s + (parseFloat(i.equipment?.market_value) || 0), 0)
              return total > 0 ? ` · Valore: € ${total.toLocaleString('it-IT', { minimumFractionDigits: 0 })}` : ''
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditModal(true)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setShowAddPicker(true)}>
          <Plus className="w-4 h-4" />
          Aggiungi attrezzatura
        </Button>
        <Link href={`/scan/kit/${id}`}>
          <Button size="sm" variant="outline">
            <QrCode className="w-4 h-4" />
            Scansiona kit
          </Button>
        </Link>
      </div>

      {/* Items list */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Contenuto del kit</h2>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nessuna attrezzatura aggiunta</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition group">
                <Link href={`/scan/${item.equipment?.id}`} className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate group-hover:text-primary transition">{item.equipment?.name || 'Eliminato'}</div>
                  <div className="text-xs text-muted-foreground">
                    {[item.equipment?.brand, item.equipment?.model].filter(Boolean).join(' · ')}
                    {item.equipment?.serial_number ? ` · S/N: ${item.equipment.serial_number}` : ''}
                  </div>
                </Link>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Dialog open={editModal} onOpenChange={(o) => { if (!o) setEditModal(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Modifica kit</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="resize-none" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setEditModal(false)}>Annulla</Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salva
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina kit</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare <strong className="text-foreground">{kitData.name}</strong>? L&apos;operazione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add equipment picker */}
      <Dialog open={showAddPicker} onOpenChange={(o) => { if (!o) { setShowAddPicker(false); setPickerSearch('') } }}>
        <DialogContent className="max-w-lg p-0 gap-0 max-h-[80vh] flex flex-col">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle>Aggiungi attrezzatura al kit</DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Cerca attrezzatura…"
                autoFocus
                className="pl-8"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {availableEquipment.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">Nessuna attrezzatura disponibile</div>
            ) : (
              <div className="divide-y divide-border/50">
                {availableEquipment.map((eq) => (
                  <button
                    key={eq.id}
                    onClick={() => addItem(eq)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{eq.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[eq.brand, eq.model].filter(Boolean).join(' · ')}
                        {eq.serial_number ? ` · S/N: ${eq.serial_number}` : ''}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
