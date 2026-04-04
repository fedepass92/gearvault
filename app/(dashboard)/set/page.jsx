'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { Plus, Briefcase, MapPin, Calendar, Loader2, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const STATUS_BADGE = {
  planned: 'bg-muted text-muted-foreground border-border',
  out: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  returned: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  incomplete: 'bg-red-500/15 text-red-300 border-red-500/20',
}
const STATUS_LABELS = { planned: 'Pianificato', out: 'In uscita', returned: 'Rientrato', incomplete: 'Incompleto' }

const EMPTY_SET = { name: '', job_date: '', location: '', notes: '', status: 'planned' }

export default function SetPage() {
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_SET)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchSets() }, [])

  async function fetchSets() {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('sets')
      .select('*, set_items(count)')
      .order('created_at', { ascending: false })
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
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Set Manager</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{sets.length} set creati</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuovo set</span>
        </Button>
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
      ) : (
        <div className="grid gap-3">
          {sets.map((set) => (
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
                      {format(new Date(set.job_date), 'd MMM yyyy', { locale: it })}
                    </span>
                  )}
                  {set.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {set.location}
                    </span>
                  )}
                  <span>{set.set_items?.[0]?.count ?? 0} item</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(o) => { if (!o) { setShowModal(false); setForm(EMPTY_SET); setError('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuovo set</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-name">Nome set *</Label>
              <Input
                id="set-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Es. Shooting Milano 2024"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data lavoro</Label>
                <Input type="date" value={form.job_date} onChange={(e) => setForm((f) => ({ ...f, job_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Es. Studio Roma" />
              </div>
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
    </div>
  )
}
