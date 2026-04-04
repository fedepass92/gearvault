'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { Plus, Layers, Loader2, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const EMPTY = { name: '', description: '' }

export default function KitPage() {
  const [kits, setKits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchKits() }, [])

  async function fetchKits() {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('kits')
      .select('*, kit_items(count)')
      .order('created_at', { ascending: false })
    setKits(data || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = getSupabase()
    const { error: err } = await supabase.from('kits').insert({
      name: form.name,
      description: form.description || null,
    })
    if (err) {
      setError(err.message)
    } else {
      setShowModal(false)
      setForm(EMPTY)
      fetchKits()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Kit</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{kits.length} kit creati</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuovo kit</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : kits.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Layers className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm mb-4">Nessun kit creato ancora</p>
          <Button size="sm" onClick={() => setShowModal(true)}>
            Crea il primo kit
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {kits.map((k) => (
            <Link
              key={k.id}
              href={`/kit/${k.id}`}
              className="flex items-center gap-4 bg-card rounded-xl border border-border px-5 py-4 hover:bg-muted/30 transition group"
            >
              <div className="p-2.5 rounded-xl bg-violet-500/10">
                <Layers className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold group-hover:text-primary transition truncate">{k.name}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {k.description && <span className="truncate max-w-xs">{k.description}</span>}
                  <span>{k.kit_items?.[0]?.count ?? 0} item</span>
                  <span>{format(new Date(k.created_at), 'd MMM yyyy', { locale: it })}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(o) => { if (!o) { setShowModal(false); setForm(EMPTY); setError('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo kit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kit-name">Nome kit *</Label>
              <Input
                id="kit-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Es. Kit interviste"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kit-desc">Descrizione</Label>
              <Textarea
                id="kit-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Contenuto del kit…"
                className="resize-none"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Crea kit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
