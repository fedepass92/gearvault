'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import {
  Plus, Briefcase, MapPin, Calendar, Loader2, ChevronRight, Copy,
  ChevronLeft, List, LayoutGrid, Search, X, BookmarkPlus, BookOpen,
  Pencil, Trash2, Package, Check, ImageOff, LayoutTemplate,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isToday, parseISO,
} from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  planned:    'bg-muted text-muted-foreground border-border',
  out:        'bg-amber-500/15 text-amber-300 border-amber-500/20',
  returned:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  incomplete: 'bg-red-500/15 text-red-300 border-red-500/20',
}
const STATUS_DOT = {
  planned:    'bg-muted-foreground',
  out:        'bg-amber-400',
  returned:   'bg-emerald-400',
  incomplete: 'bg-red-400',
}
const STATUS_LABELS = { planned: 'Pianificato', out: 'In uscita', returned: 'Rientrato', incomplete: 'Incompleto' }

const EMPTY_SET = { name: '', job_date: '', end_date: '', location: '', notes: '', status: 'planned' }
const WEEKDAYS  = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

// ── Calendar view (unchanged) ─────────────────────────────────────────────────
function CalendarView({ sets }) {
  const [month, setMonth] = useState(new Date())
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(month),     { weekStartsOn: 1 }),
  })
  const setsWithDate = sets.filter((s) => s.job_date)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3">
        <button onClick={() => setMonth((m) => subMonths(m, 1))} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-semibold capitalize">{format(month, 'MMMM yyyy', { locale: it })}</h2>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-border/40">
          {days.map((day) => {
            const daySets = setsWithDate.filter((s) => isSameDay(parseISO(s.job_date), day))
            return (
              <div key={day.toISOString()} className={`min-h-[72px] p-1.5 ${isSameMonth(day, month) ? '' : 'opacity-30'}`}>
                <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium mb-1 rounded-full ${isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {daySets.slice(0, 2).map((s) => (
                    <Link key={s.id} href={`/set/${s.id}`} className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight hover:bg-muted/50 transition truncate group">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[s.status] || 'bg-muted-foreground'}`} />
                      <span className="truncate group-hover:text-primary transition">{s.name}</span>
                    </Link>
                  ))}
                  {daySets.length > 2 && <div className="text-[10px] text-muted-foreground px-1">+{daySets.length - 2} altri</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_LABELS).map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[k]}`} /> {label}
          </div>
        ))}
      </div>
      {sets.filter((s) => !s.job_date).length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Senza data</h3>
          </div>
          <div className="divide-y divide-border/50">
            {sets.filter((s) => !s.job_date).map((set) => (
              <Link key={set.id} href={`/set/${set.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition group">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[set.status] || 'bg-muted-foreground'}`} />
                <span className="flex-1 text-sm font-medium group-hover:text-primary transition truncate">{set.name}</span>
                <Badge variant="outline" className={`text-xs border flex-shrink-0 ${STATUS_BADGE[set.status]}`}>{STATUS_LABELS[set.status] || set.status}</Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SetPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Set state
  const [sets, setSets]       = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView]       = useState('list')
  const [showModal, setShowModal]     = useState(false)
  const [form, setForm]               = useState(EMPTY_SET)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [duplicating, setDuplicating] = useState(null)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Template state
  const [tab, setTab]                     = useState(searchParams.get('tab') === 'template' ? 'templates' : 'sets')
  const [templates, setTemplates]         = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [savingTemplate, setSavingTemplate]     = useState(null) // set.id being saved
  const [showSaveModal, setShowSaveModal]       = useState(false)
  const [saveTargetSet, setSaveTargetSet]       = useState(null)
  const [tplName, setTplName]                   = useState('')
  const [tplDesc, setTplDesc]                   = useState('')
  const [showTplPreview, setShowTplPreview]     = useState(null) // template object
  const [tplPreviewItems, setTplPreviewItems]   = useState([])
  const [tplPreviewLoading, setTplPreviewLoading] = useState(false)
  const [creatingFromTpl, setCreatingFromTpl]   = useState(false)
  const [newSetFromTpl, setNewSetFromTpl]       = useState({ name: '', job_date: '', location: '', notes: '' })
  const [showCreateFromTpl, setShowCreateFromTpl] = useState(null) // template
  const [renameTpl, setRenameTpl]               = useState(null) // template to rename
  const [renameName, setRenameName]             = useState('')
  const [deleteTpl, setDeleteTpl]               = useState(null)
  const [deletingTpl, setDeletingTpl]           = useState(false)

  // New template from scratch
  const [showNewTplModal, setShowNewTplModal]   = useState(false)
  const [newTplForm, setNewTplForm]             = useState({ name: '', description: '' })
  const [newTplItems, setNewTplItems]           = useState([]) // array of equipment objects
  const [showTplItemPicker, setShowTplItemPicker] = useState(false)
  const [tplItemSearch, setTplItemSearch]       = useState('')
  const [savingNewTpl, setSavingNewTpl]         = useState(false)

  // Edit set modal state
  const [editingSet, setEditingSet]           = useState(null)
  const [editForm, setEditForm]               = useState(EMPTY_SET)
  const [editSaving, setEditSaving]           = useState(false)
  const [editSetItems, setEditSetItems]       = useState([])
  const [editItemsLoading, setEditItemsLoading] = useState(false)
  const [allEquipment, setAllEquipment]       = useState([])
  const [editItemSearch, setEditItemSearch]   = useState('')
  const [addingItem, setAddingItem]           = useState(null) // equipment.id being added

  useEffect(() => { fetchSets() }, [])

  // Sync tab state with URL searchParams (handles sidebar navigation without remount)
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const targetTab = tabParam === 'template' ? 'templates' : 'sets'
    setTab(targetTab)
  }, [searchParams])

  // Fetch templates when switching to template tab
  useEffect(() => {
    if (tab === 'templates' && templates.length === 0) fetchTemplates()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Set fetching ─────────────────────────────────────────────────────────────
  async function fetchSets() {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('sets')
      .select('*, set_items(id, equipment(market_value))')
      .order('job_date', { ascending: true, nullsFirst: false })
    setSets(data || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = getSupabase()
    const { error: err } = await supabase.from('sets').insert({
      name: form.name,
      job_date: form.job_date || null,
      end_date: form.end_date || null,
      location: form.location || null,
      notes: form.notes || null,
      status: 'planned',
    })
    if (err) {
      setError(err.message)
    } else {
      setShowModal(false)
      setForm(EMPTY_SET)
      fetchSets()
      toast.success(`Set "${form.name}" creato`)
    }
    setSaving(false)
  }

  async function duplicateSet(set, e) {
    e.preventDefault()
    e.stopPropagation()
    setDuplicating(set.id)
    const supabase = getSupabase()
    const { data: newSet, error: setErr } = await supabase
      .from('sets')
      .insert({ name: `${set.name} (copia)`, location: set.location || null, notes: set.notes || null, status: 'planned' })
      .select().single()
    if (setErr || !newSet) { setDuplicating(null); return }
    const { data: sourceItems } = await supabase.from('set_items').select('equipment_id').eq('set_id', set.id)
    if (sourceItems?.length > 0) {
      await supabase.from('set_items').insert(sourceItems.map((i) => ({ set_id: newSet.id, equipment_id: i.equipment_id, status: 'planned' })))
    }
    setDuplicating(null)
    toast.success(`"${set.name}" duplicato`)
    router.push(`/set/${newSet.id}`)
  }

  // ── Template fetching ─────────────────────────────────────────────────────────
  async function fetchTemplates() {
    setTemplatesLoading(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('set_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setTemplates(data || [])
    setTemplatesLoading(false)
  }

  // ── Save set as template ──────────────────────────────────────────────────────
  function openSaveModal(set, e) {
    e.preventDefault()
    e.stopPropagation()
    setSaveTargetSet(set)
    setTplName(set.name)
    setTplDesc('')
    setShowSaveModal(true)
  }

  async function handleSaveAsTemplate(e) {
    e.preventDefault()
    if (!saveTargetSet) return
    setSavingTemplate(saveTargetSet.id)
    const supabase = getSupabase()

    const { data: { user } } = await supabase.auth.getUser()
    const { data: setItems } = await supabase
      .from('set_items')
      .select('equipment_id, status')
      .eq('set_id', saveTargetSet.id)

    const items = (setItems || []).map((i) => ({ item_id: i.equipment_id, notes: '' }))

    const { error } = await supabase.from('set_templates').insert({
      user_id: user.id,
      name: tplName.trim(),
      description: tplDesc.trim() || null,
      items,
    })

    setSavingTemplate(null)
    setShowSaveModal(false)
    setSaveTargetSet(null)

    if (error) { toast.error('Errore nel salvataggio'); return }
    toast.success(`Template "${tplName}" salvato`)
    // Refresh templates list if on that tab or for next visit
    setTemplates([]) // will re-fetch on tab switch
  }

  // ── Preview template items ────────────────────────────────────────────────────
  async function openPreview(tpl) {
    setShowTplPreview(tpl)
    setTplPreviewItems([])
    if (!tpl.items?.length) return
    setTplPreviewLoading(true)
    const supabase = getSupabase()
    const ids = tpl.items.map((i) => i.item_id).filter(Boolean)
    const { data } = await supabase
      .from('equipment')
      .select('id, name, brand, model, photo_url')
      .in('id', ids)
    setTplPreviewItems(data || [])
    setTplPreviewLoading(false)
  }

  // ── Create set from template ──────────────────────────────────────────────────
  function openCreateFromTpl(tpl) {
    setShowCreateFromTpl(tpl)
    setNewSetFromTpl({ name: tpl.name, job_date: '', location: '', notes: '' })
    setShowTplPreview(null)
  }

  async function handleCreateFromTemplate(e) {
    e.preventDefault()
    if (!showCreateFromTpl) return
    setCreatingFromTpl(true)
    const supabase = getSupabase()

    const { data: newSet, error: setErr } = await supabase
      .from('sets')
      .insert({
        name: newSetFromTpl.name,
        job_date: newSetFromTpl.job_date || null,
        location: newSetFromTpl.location || null,
        notes: newSetFromTpl.notes || null,
        status: 'planned',
      })
      .select().single()

    if (setErr || !newSet) {
      toast.error('Errore nella creazione del set')
      setCreatingFromTpl(false)
      return
    }

    const items = (showCreateFromTpl.items || [])
      .filter((i) => i.item_id)
      .map((i) => ({ set_id: newSet.id, equipment_id: i.item_id, status: 'planned' }))

    if (items.length > 0) {
      await supabase.from('set_items').insert(items)
    }

    setCreatingFromTpl(false)
    setShowCreateFromTpl(null)
    toast.success(`Set "${newSet.name}" creato dal template`)
    router.push(`/set/${newSet.id}`)
  }

  // ── Rename template ───────────────────────────────────────────────────────────
  function openRename(tpl, e) {
    e.stopPropagation()
    setRenameTpl(tpl)
    setRenameName(tpl.name)
  }

  async function handleRename(e) {
    e.preventDefault()
    if (!renameTpl || !renameName.trim()) return
    const supabase = getSupabase()
    const { error } = await supabase
      .from('set_templates')
      .update({ name: renameName.trim() })
      .eq('id', renameTpl.id)
    if (error) { toast.error('Errore nella rinomina'); return }
    setTemplates((prev) => prev.map((t) => t.id === renameTpl.id ? { ...t, name: renameName.trim() } : t))
    setRenameTpl(null)
    toast.success('Template rinominato')
  }

  // ── Delete template ───────────────────────────────────────────────────────────
  async function handleDeleteTemplate() {
    if (!deleteTpl) return
    setDeletingTpl(true)
    const supabase = getSupabase()
    const { error } = await supabase.from('set_templates').delete().eq('id', deleteTpl.id)
    setDeletingTpl(false)
    setDeleteTpl(null)
    if (error) { toast.error('Errore nella cancellazione'); return }
    setTemplates((prev) => prev.filter((t) => t.id !== deleteTpl.id))
    toast.success('Template eliminato')
  }

  // ── Tab switcher (syncs URL) ──────────────────────────────────────────────────
  function switchTab(newTab) {
    setTab(newTab)
    router.replace(newTab === 'templates' ? '/set?tab=template' : '/set', { scroll: false })
  }

  // ── New template from scratch ─────────────────────────────────────────────────
  async function openNewTplModal() {
    setNewTplForm({ name: '', description: '' })
    setNewTplItems([])
    setTplItemSearch('')
    setShowNewTplModal(true)
    if (allEquipment.length === 0) {
      const supabase = getSupabase()
      const { data } = await supabase.from('equipment').select('id, name, brand, model, photo_url, category').eq('condition', 'active').order('name')
      setAllEquipment(data || [])
    }
  }

  async function handleCreateNewTemplate(e) {
    e.preventDefault()
    if (!newTplForm.name.trim()) return
    setSavingNewTpl(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const items = newTplItems.map((eq) => ({ item_id: eq.id, notes: '' }))
    const { error } = await supabase.from('set_templates').insert({
      user_id: user.id,
      name: newTplForm.name.trim(),
      description: newTplForm.description.trim() || null,
      items,
    })
    setSavingNewTpl(false)
    if (error) { toast.error('Errore nel salvataggio'); return }
    toast.success(`Template "${newTplForm.name}" creato`)
    setShowNewTplModal(false)
    setTemplates([]) // force re-fetch on next render
    if (tab === 'templates') fetchTemplates()
  }

  // ── Edit set modal ────────────────────────────────────────────────────────────
  async function openEditModal(set, e) {
    e.preventDefault()
    e.stopPropagation()
    setEditingSet(set)
    setEditForm({
      name: set.name || '',
      job_date: set.job_date || '',
      end_date: set.end_date || '',
      location: set.location || '',
      notes: set.notes || '',
      status: set.status || 'planned',
    })
    setEditItemSearch('')
    setEditSetItems([])
    setEditItemsLoading(true)
    const supabase = getSupabase()
    const [{ data: items }, { data: equip }] = await Promise.all([
      supabase.from('set_items').select('id, equipment_id, equipment(id, name, brand, model, photo_url, category)')
        .eq('set_id', set.id).order('id'),
      supabase.from('equipment').select('id, name, brand, model, photo_url, category').eq('condition', 'active').order('name'),
    ])
    setEditSetItems(items || [])
    setAllEquipment(equip || [])
    setEditItemsLoading(false)
  }

  function closeEditModal() {
    setEditingSet(null)
    setEditForm(EMPTY_SET)
    setEditSetItems([])
    setEditItemSearch('')
  }

  async function handleEditSave(e) {
    e.preventDefault()
    if (!editingSet) return
    setEditSaving(true)
    const supabase = getSupabase()
    const { error } = await supabase.from('sets').update({
      name: editForm.name,
      job_date: editForm.job_date || null,
      end_date: editForm.end_date || null,
      location: editForm.location || null,
      notes: editForm.notes || null,
    }).eq('id', editingSet.id)
    setEditSaving(false)
    if (error) { toast.error('Errore nel salvataggio'); return }
    toast.success('Set aggiornato')
    closeEditModal()
    fetchSets()
  }

  async function handleEditRemoveItem(setItemId) {
    const supabase = getSupabase()
    await supabase.from('set_items').delete().eq('id', setItemId)
    setEditSetItems((prev) => prev.filter((i) => i.id !== setItemId))
  }

  async function handleEditAddItem(equipment) {
    if (!editingSet) return
    setAddingItem(equipment.id)
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('set_items')
      .insert({ set_id: editingSet.id, equipment_id: equipment.id, status: 'planned' })
      .select('id, equipment_id, equipment(id, name, brand, model, photo_url, category)')
      .single()
    setAddingItem(null)
    if (error) { toast.error('Errore nell\'aggiunta'); return }
    setEditSetItems((prev) => [...prev, data])
    setEditItemSearch('')
  }

  // ── Filtered sets ─────────────────────────────────────────────────────────────
  const displaySets = sets.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return s.name?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q)
    }
    return true
  })

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Set Manager</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {tab === 'sets'
              ? `${displaySets.length}${displaySets.length !== sets.length ? ` / ${sets.length}` : ''} set`
              : `${templates.length} template${templates.length !== 1 ? '' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'sets' && (
            <>
              <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/50">
                <button onClick={() => setView('list')} className={`p-1.5 rounded-md transition ${view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Vista lista">
                  <List className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setView('calendar')} className={`p-1.5 rounded-md transition ${view === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Vista calendario">
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
              <Button size="sm" onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nuovo set</span>
              </Button>
            </>
          )}
          {tab === 'templates' && (
            <Button size="sm" onClick={openNewTplModal}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuovo template</span>
            </Button>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 border border-border/50 w-fit">
        <button
          onClick={() => switchTab('sets')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
            tab === 'sets' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Set
        </button>
        <button
          onClick={() => switchTab('templates')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
            tab === 'templates' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
          Template
          {templates.length > 0 && (
            <span className="ml-0.5 text-[10px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
              {templates.length}
            </span>
          )}
        </button>
      </div>

      {/* ── SETS TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'sets' && (
        <>
          {/* Search + filter */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per nome o location…" className="pl-8 h-8 text-sm" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1 py-1 border border-border/50 h-8">
              {[
                { value: 'all', label: 'Tutti' },
                { value: 'planned', label: 'Pianificati' },
                { value: 'out', label: 'In uscita' },
                { value: 'returned', label: 'Rientrati' },
                { value: 'incomplete', label: 'Incompleti' },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setStatusFilter(opt.value)} className={`px-2 py-0.5 rounded text-xs font-medium transition whitespace-nowrap ${statusFilter === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : sets.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <Briefcase className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground text-sm mb-4">Nessun set creato ancora</p>
              <Button size="sm" onClick={() => setShowModal(true)}>Crea il primo set</Button>
            </div>
          ) : view === 'calendar' ? (
            <CalendarView sets={displaySets} />
          ) : displaySets.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <Briefcase className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground text-sm">Nessun set trovato</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {displaySets.map((set) => (
                <Link
                  key={set.id}
                  href={`/set/${set.id}`}
                  className="flex items-center gap-4 bg-card rounded-xl border border-border px-5 py-4 hover:bg-muted/30 transition group"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Briefcase className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold group-hover:text-primary transition truncate">{set.name}</span>
                      <Badge variant="outline" className={`text-xs border ${STATUS_BADGE[set.status] || 'bg-muted text-muted-foreground'}`}>
                        {STATUS_LABELS[set.status] || set.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {set.job_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(set.job_date), 'd MMM yyyy', { locale: it })}
                        </span>
                      )}
                      {set.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {set.location}
                        </span>
                      )}
                      <span>{set.set_items?.length ?? 0} item</span>
                      {(() => {
                        const val = (set.set_items || []).reduce((s, si) => s + (parseFloat(si.equipment?.market_value) || 0), 0)
                        return val > 0 ? <span>€ {val.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</span> : null
                      })()}
                    </div>
                  </div>
                  {/* Edit */}
                  <button
                    onClick={(e) => openEditModal(set, e)}
                    title="Modifica set"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition flex-shrink-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {/* Save as template */}
                  <button
                    onClick={(e) => openSaveModal(set, e)}
                    disabled={savingTemplate === set.id}
                    title="Salva come template"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition flex-shrink-0 disabled:opacity-40"
                  >
                    {savingTemplate === set.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <BookmarkPlus className="w-4 h-4" />}
                  </button>
                  {/* Duplicate */}
                  <button
                    onClick={(e) => duplicateSet(set, e)}
                    disabled={duplicating === set.id}
                    title="Duplica set"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition flex-shrink-0 disabled:opacity-40"
                  >
                    {duplicating === set.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TEMPLATES TAB ────────────────────────────────────────────────────── */}
      {tab === 'templates' && (
        <div className="space-y-3">
          {templatesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground text-sm font-medium mb-1">Nessun template salvato</p>
              <p className="text-muted-foreground/60 text-xs mb-4">
                Crea un template da zero oppure clicca <BookmarkPlus className="w-3.5 h-3.5 inline mx-0.5" /> su un set esistente
              </p>
              <Button size="sm" onClick={openNewTplModal}>
                <Plus className="w-4 h-4" />
                Nuovo template
              </Button>
            </div>
          ) : (
            templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center gap-4 bg-card rounded-xl border border-border px-5 py-4">
                <div className="p-2.5 rounded-xl bg-primary/10 flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{tpl.name}</div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {tpl.description && <span className="truncate max-w-[200px]">{tpl.description}</span>}
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <Package className="w-3 h-3" />
                      {tpl.items?.length ?? 0} item
                    </span>
                    <span className="flex-shrink-0">
                      {format(new Date(tpl.created_at), 'd MMM yyyy', { locale: it })}
                    </span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => openPreview(tpl)}
                  >
                    <Plus className="w-3 h-3" />
                    Usa
                  </Button>
                  <button
                    onClick={(e) => openRename(tpl, e)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    title="Rinomina"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTpl(tpl)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                    title="Elimina"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── DIALOG: Nuovo set ─────────────────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={(o) => { if (!o) { setShowModal(false); setForm(EMPTY_SET); setError('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuovo set</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-name">Nome set *</Label>
              <Input id="set-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Es. Shooting Milano 2024" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data inizio</Label>
                <Input type="date" value={form.job_date} onChange={(e) => setForm((f) => ({ ...f, job_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data fine</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Es. Studio Roma" />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Note sul set…" className="resize-none" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Crea set
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Salva come template ───────────────────────────────────────── */}
      <Dialog open={showSaveModal} onOpenChange={(o) => { if (!o) setShowSaveModal(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4" />
              Salva come template
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveAsTemplate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome template *</Label>
              <Input value={tplName} onChange={(e) => setTplName(e.target.value)} required placeholder="Es. Set Video Completo" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrizione <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
              <Input value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} placeholder="Es. Per shooting in studio" />
            </div>
            {saveTargetSet && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                Verranno salvati gli item attualmente assegnati al set <strong>{saveTargetSet.name}</strong>.
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowSaveModal(false)}>Annulla</Button>
              <Button type="submit" disabled={!!savingTemplate || !tplName.trim()}>
                {savingTemplate && <Loader2 className="w-4 h-4 animate-spin" />}
                Salva template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Anteprima template ────────────────────────────────────────── */}
      <Dialog open={!!showTplPreview} onOpenChange={(o) => { if (!o) setShowTplPreview(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {showTplPreview?.name}
            </DialogTitle>
          </DialogHeader>
          {showTplPreview && (
            <div className="space-y-4">
              {showTplPreview.description && (
                <p className="text-sm text-muted-foreground">{showTplPreview.description}</p>
              )}
              {/* Items preview */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Attrezzatura ({showTplPreview.items?.length ?? 0} item)
                </p>
                {tplPreviewLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : !showTplPreview.items?.length ? (
                  <p className="text-sm text-muted-foreground/60 italic">Nessun item nel template</p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {(showTplPreview.items || []).map((tplItem, i) => {
                      const eq = tplPreviewItems.find((e) => e.id === tplItem.item_id)
                      return (
                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/40">
                          {eq?.photo_url ? (
                            <img src={eq.photo_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0 border border-border" />
                          ) : (
                            <div className="w-7 h-7 rounded bg-muted flex-shrink-0 border border-border flex items-center justify-center">
                              <Package className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{eq?.name || <span className="text-muted-foreground/40 italic">Item rimosso</span>}</div>
                            {(eq?.brand || eq?.model) && (
                              <div className="text-xs text-muted-foreground truncate">{[eq.brand, eq.model].filter(Boolean).join(' · ')}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTplPreview(null)}>Chiudi</Button>
            <Button onClick={() => openCreateFromTpl(showTplPreview)}>
              <Plus className="w-4 h-4" />
              Crea set da template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Crea set da template ──────────────────────────────────────── */}
      <Dialog open={!!showCreateFromTpl} onOpenChange={(o) => { if (!o) setShowCreateFromTpl(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nuovo set da &ldquo;{showCreateFromTpl?.name}&rdquo;
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFromTemplate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome set *</Label>
              <Input value={newSetFromTpl.name} onChange={(e) => setNewSetFromTpl((f) => ({ ...f, name: e.target.value }))} required placeholder="Es. Shooting Milano 2025" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data lavoro</Label>
                <Input type="date" value={newSetFromTpl.job_date} onChange={(e) => setNewSetFromTpl((f) => ({ ...f, job_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={newSetFromTpl.location} onChange={(e) => setNewSetFromTpl((f) => ({ ...f, location: e.target.value }))} placeholder="Es. Studio Roma" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={newSetFromTpl.notes} onChange={(e) => setNewSetFromTpl((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Note sul set…" className="resize-none" />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <Check className="w-3 h-3 inline mr-1 text-emerald-400" />
              {showCreateFromTpl?.items?.length ?? 0} item verranno aggiunti automaticamente dal template.
            </p>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateFromTpl(null)}>Annulla</Button>
              <Button type="submit" disabled={creatingFromTpl || !newSetFromTpl.name.trim()}>
                {creatingFromTpl && <Loader2 className="w-4 h-4 animate-spin" />}
                Crea set
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Rinomina template ─────────────────────────────────────────── */}
      <Dialog open={!!renameTpl} onOpenChange={(o) => { if (!o) setRenameTpl(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rinomina template</DialogTitle></DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nuovo nome *</Label>
              <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} required autoFocus />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameTpl(null)}>Annulla</Button>
              <Button type="submit" disabled={!renameName.trim()}>Rinomina</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Modifica set ─────────────────────────────────────────────── */}
      <Dialog open={!!editingSet} onOpenChange={(o) => { if (!o) closeEditModal() }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Modifica set
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* ── Campi base ── */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome set *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Es. Shooting Milano 2024"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Data inizio</Label>
                  <Input
                    type="date"
                    value={editForm.job_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, job_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data fine</Label>
                  <Input
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Es. Studio Roma"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Note sul set…"
                  className="resize-none"
                />
              </div>
            </div>

            {/* ── Attrezzatura ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500 shrink-0">
                  Attrezzatura
                  {editSetItems.length > 0 && (
                    <span className="ml-1.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                      {editSetItems.length}
                    </span>
                  )}
                </p>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>

              {/* Cerca e aggiungi */}
              {(() => {
                const addedIds = new Set(editSetItems.map((i) => i.equipment_id))
                const results = allEquipment
                  .filter((e) => !addedIds.has(e.id))
                  .filter((e) => {
                    if (!editItemSearch) return false
                    const q = editItemSearch.toLowerCase()
                    return [e.name, e.brand, e.model].some((v) => v?.toLowerCase().includes(q))
                  })
                return (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={editItemSearch}
                      onChange={(e) => setEditItemSearch(e.target.value)}
                      placeholder="Cerca attrezzatura da aggiungere…"
                      className="pl-8 h-8 text-sm"
                    />
                    {editItemSearch && results.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-44 overflow-y-auto">
                        {results.map((eq) => (
                          <button
                            key={eq.id}
                            onClick={() => handleEditAddItem(eq)}
                            disabled={addingItem === eq.id}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition disabled:opacity-50"
                          >
                            {eq.photo_url ? (
                              <img src={eq.photo_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0 border border-border" />
                            ) : (
                              <div className="w-7 h-7 rounded bg-muted flex-shrink-0 border border-border flex items-center justify-center">
                                <ImageOff className="w-3 h-3 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{eq.name}</p>
                              {(eq.brand || eq.model) && (
                                <p className="text-xs text-muted-foreground truncate">{[eq.brand, eq.model].filter(Boolean).join(' · ')}</p>
                              )}
                            </div>
                            {addingItem === eq.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />
                              : <Plus className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                    {editItemSearch && results.length === 0 && !editItemsLoading && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-popover border border-border rounded-lg shadow-lg px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">Nessun item trovato</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Lista item correnti */}
              {editItemsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : editSetItems.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nessun item nel set</p>
              ) : (
                <div className="space-y-1.5">
                  {editSetItems.map((si) => {
                    const eq = si.equipment
                    return (
                      <div key={si.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
                        {eq?.photo_url ? (
                          <img src={eq.photo_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-border" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex-shrink-0 border border-border flex items-center justify-center">
                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{eq?.name || '—'}</p>
                          {(eq?.brand || eq?.model) && (
                            <p className="text-xs text-muted-foreground truncate">{[eq.brand, eq.model].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleEditRemoveItem(si.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex-shrink-0"
                          title="Rimuovi"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-border bg-card gap-2">
            <Button variant="outline" onClick={closeEditModal}>Annulla</Button>
            <Button onClick={handleEditSave} disabled={editSaving || !editForm.name.trim()}>
              {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salva modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Nuovo template da zero ───────────────────────────────────── */}
      <Dialog open={showNewTplModal} onOpenChange={(o) => { if (!o) setShowNewTplModal(false) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4" />
              Nuovo template
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateNewTemplate} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Nome template *</Label>
                <Input
                  value={newTplForm.name}
                  onChange={(e) => setNewTplForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Es. Set Video Completo"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrizione <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
                <Input
                  value={newTplForm.description}
                  onChange={(e) => setNewTplForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Es. Per shooting in studio"
                />
              </div>

              {/* Attrezzatura */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500 shrink-0">
                    Attrezzatura
                    {newTplItems.length > 0 && (
                      <span className="ml-1.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                        {newTplItems.length}
                      </span>
                    )}
                  </p>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowTplItemPicker(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Aggiungi attrezzatura
                </button>
                {newTplItems.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {newTplItems.map((eq) => (
                      <div key={eq.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
                        {eq.photo_url ? (
                          <img src={eq.photo_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-border" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex-shrink-0 border border-border flex items-center justify-center">
                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{eq.name}</p>
                          {(eq.brand || eq.model) && (
                            <p className="text-xs text-muted-foreground truncate">{[eq.brand, eq.model].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewTplItems((prev) => prev.filter((i) => i.id !== eq.id))}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="px-5 py-3 border-t border-border bg-card gap-2">
              <Button type="button" variant="outline" onClick={() => setShowNewTplModal(false)}>Annulla</Button>
              <Button type="submit" disabled={savingNewTpl || !newTplForm.name.trim()}>
                {savingNewTpl && <Loader2 className="w-4 h-4 animate-spin" />}
                Salva template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Item picker per nuovo template ────────────────────────────── */}
      <Dialog open={showTplItemPicker} onOpenChange={(o) => { if (!o) { setShowTplItemPicker(false); setTplItemSearch('') } }}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle>Aggiungi attrezzatura</DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={tplItemSearch}
                onChange={(e) => setTplItemSearch(e.target.value)}
                placeholder="Cerca per nome, marca, modello…"
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {(() => {
              const addedIds = new Set(newTplItems.map((i) => i.id))
              const results = allEquipment
                .filter((e) => !addedIds.has(e.id))
                .filter((e) => {
                  if (!tplItemSearch) return true
                  const q = tplItemSearch.toLowerCase()
                  return [e.name, e.brand, e.model].some((v) => v?.toLowerCase().includes(q))
                })
              if (results.length === 0) {
                return (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    {tplItemSearch ? 'Nessun risultato' : 'Tutto l\'inventario è già stato aggiunto'}
                  </div>
                )
              }
              return results.map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => {
                    setNewTplItems((prev) => [...prev, eq])
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition text-left border-b border-border/30 last:border-0"
                >
                  {eq.photo_url ? (
                    <img src={eq.photo_url} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0 border border-border" />
                  ) : (
                    <div className="w-9 h-9 rounded bg-muted flex-shrink-0 border border-border flex items-center justify-center">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{eq.name}</p>
                    {(eq.brand || eq.model) && (
                      <p className="text-xs text-muted-foreground truncate">{[eq.brand, eq.model].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Elimina template ──────────────────────────────────────────── */}
      <Dialog open={!!deleteTpl} onOpenChange={(o) => { if (!o) setDeleteTpl(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" />
              Elimina template
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler eliminare il template <strong className="text-foreground">&ldquo;{deleteTpl?.name}&rdquo;</strong>? L&apos;azione è irreversibile.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTpl(null)} disabled={deletingTpl}>Annulla</Button>
            <Button variant="destructive" onClick={handleDeleteTemplate} disabled={deletingTpl}>
              {deletingTpl && <Loader2 className="w-4 h-4 animate-spin" />}
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
