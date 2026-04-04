'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import LabelCard from '@/components/LabelCard'
import {
  ArrowLeft, Box, Plus, Trash2, Search, Loader2,
  Printer, Package, Pencil, Layers, ChevronDown, ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function CaseDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [caseData, setCaseData] = useState(null)
  const [items, setItems] = useState([])        // case_items → equipment
  const [kits, setKits] = useState([])          // case_kits → kits (with kit_items)
  const [loading, setLoading] = useState(true)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [availableEquipment, setAvailableEquipment] = useState([])
  const [availableKits, setAvailableKits] = useState([])
  const [showLabelPreview, setShowLabelPreview] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expandedKits, setExpandedKits] = useState({})

  const fetchCase = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = await supabase.from('cases').select('*').eq('id', id).single()
    if (!data) { router.push('/case'); return }
    setCaseData(data)
    setEditForm({ name: data.name, description: data.description || '' })

    const [{ data: itemsData }, { data: kitsData }] = await Promise.all([
      supabase.from('case_items').select('*, equipment(*)').eq('case_id', id).order('added_at'),
      supabase.from('case_kits').select('*, kits(*, kit_items(*, equipment(*)))').eq('case_id', id).order('added_at'),
    ])
    setItems(itemsData || [])
    setKits(kitsData || [])
    setLoading(false)
  }, [id, router])

  useEffect(() => { fetchCase() }, [fetchCase])

  useEffect(() => {
    if (!showAddPicker) return
    async function fetchAvailable() {
      const supabase = getSupabase()
      const [eqRes, kitsRes] = await Promise.all([
        supabase.from('equipment').select('id, name, brand, model, serial_number, category').order('name'),
        supabase.from('kits').select('id, name, description, kit_items(count)').order('name'),
      ])
      const addedEqIds = new Set(items.map((i) => i.equipment_id))
      const addedKitIds = new Set(kits.map((k) => k.kit_id))
      const searchLower = pickerSearch.toLowerCase()

      setAvailableEquipment(
        (eqRes.data || [])
          .filter((e) => !addedEqIds.has(e.id))
          .filter((e) => !pickerSearch || [e.name, e.brand, e.serial_number].some((v) => v?.toLowerCase().includes(searchLower)))
      )
      setAvailableKits(
        (kitsRes.data || [])
          .filter((k) => !addedKitIds.has(k.id))
          .filter((k) => !pickerSearch || k.name.toLowerCase().includes(searchLower))
      )
    }
    fetchAvailable()
  }, [showAddPicker, pickerSearch, items, kits])

  async function addEquipment(equipment) {
    const supabase = getSupabase()
    await supabase.from('case_items').insert({ case_id: id, equipment_id: equipment.id })
    setShowAddPicker(false)
    fetchCase()
  }

  async function addKit(kit) {
    const supabase = getSupabase()
    await supabase.from('case_kits').insert({ case_id: id, kit_id: kit.id })
    setShowAddPicker(false)
    fetchCase()
  }

  async function removeItem(caseItemId) {
    const supabase = getSupabase()
    await supabase.from('case_items').delete().eq('id', caseItemId)
    fetchCase()
  }

  async function removeKit(caseKitId) {
    const supabase = getSupabase()
    await supabase.from('case_kits').delete().eq('id', caseKitId)
    fetchCase()
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    const supabase = getSupabase()
    await supabase.from('cases').update({
      name: editForm.name,
      description: editForm.description || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setEditModal(false)
    setEditSaving(false)
    fetchCase()
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = getSupabase()
    await supabase.from('cases').delete().eq('id', id)
    router.push('/case')
  }

  function handlePrint() {
    setShowLabelPreview(true)
    setTimeout(() => window.print(), 300)
  }

  const totalItems = items.length + kits.reduce((s, k) => s + (k.kits?.kit_items?.length || 0), 0)

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
  }
  if (!caseData) return null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()} className="mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <h1 className="text-xl font-bold truncate">{caseData.name}</h1>
          </div>
          {caseData.description && (
            <p className="text-xs text-muted-foreground mt-1 ml-7">{caseData.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5 ml-7">
            {items.length} item singoli · {kits.length} kit · {totalItems} item totali · creato {format(new Date(caseData.created_at), 'd MMM yyyy', { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditModal(true)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Etichetta</span>
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Label preview (print area) */}
      {showLabelPreview && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Etichetta case</h2>
          <div id="print-area">
            <LabelCard item={caseData} type="qr" isCase />
          </div>
        </div>
      )}
      <div className="hidden" id="print-area">
        <LabelCard item={caseData} type="qr" isCase />
      </div>

      {/* Action bar */}
      <Button size="sm" onClick={() => setShowAddPicker(true)}>
        <Plus className="w-4 h-4" />
        Aggiungi contenuto
      </Button>

      {/* Content */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Contenuto del case</h2>
        </div>

        {items.length === 0 && kits.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nessun contenuto aggiunto</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {/* Individual items */}
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition">
                <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.equipment?.name || 'Eliminato'}</div>
                  <div className="text-xs text-muted-foreground">
                    {[item.equipment?.brand, item.equipment?.model].filter(Boolean).join(' · ')}
                    {item.equipment?.serial_number ? ` · S/N: ${item.equipment.serial_number}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Kits */}
            {kits.map((ck) => {
              const kit = ck.kits
              if (!kit) return null
              const kitItems = kit.kit_items || []
              const expanded = expandedKits[ck.id]
              return (
                <div key={ck.id}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition cursor-pointer"
                    onClick={() => setExpandedKits((p) => ({ ...p, [ck.id]: !p[ck.id] }))}
                  >
                    <Layers className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{kit.name}</div>
                      <div className="text-xs text-muted-foreground">{kitItems.length} item nel kit</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeKit(ck.id) }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                  {expanded && kitItems.length > 0 && (
                    <div className="border-t border-border/50 bg-muted/20">
                      {kitItems.map((ki) => (
                        <div key={ki.id} className="flex items-center gap-3 px-8 py-2.5 border-b border-border/30 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground truncate">{ki.equipment?.name || '—'}</div>
                            <div className="text-xs text-muted-foreground">
                              {[ki.equipment?.brand, ki.equipment?.model].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Dialog open={editModal} onOpenChange={(o) => { if (!o) setEditModal(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Modifica case</DialogTitle></DialogHeader>
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
            <AlertDialogTitle>Elimina case</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare <strong className="text-foreground">{caseData.name}</strong>? L&apos;operazione è irreversibile.
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

      {/* Add content picker (tabs: Attrezzatura | Kit) */}
      <Dialog open={showAddPicker} onOpenChange={(o) => { if (!o) { setShowAddPicker(false); setPickerSearch('') } }}>
        <DialogContent className="max-w-lg p-0 gap-0 max-h-[80vh] flex flex-col">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle>Aggiungi al case</DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Cerca…"
                autoFocus
                className="pl-8"
              />
            </div>
          </div>
          <Tabs defaultValue="attrezzatura" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="mx-4 mt-3 mb-0 shrink-0">
              <TabsTrigger value="attrezzatura" className="flex-1">
                <Package className="w-3.5 h-3.5 mr-1.5" />
                Attrezzatura
              </TabsTrigger>
              <TabsTrigger value="kit" className="flex-1">
                <Layers className="w-3.5 h-3.5 mr-1.5" />
                Kit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attrezzatura" className="flex-1 overflow-y-auto mt-2">
              {availableEquipment.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Nessuna attrezzatura disponibile</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {availableEquipment.map((eq) => (
                    <button
                      key={eq.id}
                      onClick={() => addEquipment(eq)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{eq.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[eq.brand, eq.model].filter(Boolean).join(' · ')}
                          {eq.serial_number ? ` · S/N: ${eq.serial_number}` : ''}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="kit" className="flex-1 overflow-y-auto mt-2">
              {availableKits.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Nessun kit disponibile</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {availableKits.map((kit) => (
                    <button
                      key={kit.id}
                      onClick={() => addKit(kit)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition text-left"
                    >
                      <Layers className="w-4 h-4 text-violet-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{kit.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {kit.kit_items?.[0]?.count ?? 0} item
                          {kit.description ? ` · ${kit.description}` : ''}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
