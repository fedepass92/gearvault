'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { Plus, Box, Loader2, ChevronRight, Search } from 'lucide-react'
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

export default function CasePage() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchCases() }, [])

  async function fetchCases() {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('cases')
      .select('*, case_items(count, equipment(market_value)), case_kits(count)')
      .order('created_at', { ascending: false })
    setCases(data || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = getSupabase()
    const { error: err } = await supabase.from('cases').insert({
      name: form.name,
      description: form.description || null,
    })
    if (err) {
      setError(err.message)
    } else {
      setShowModal(false)
      setForm(EMPTY)
      fetchCases()
    }
    setSaving(false)
  }

  const displayCases = search
    ? cases.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase()))
    : cases

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Case</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {displayCases.length}{displayCases.length !== cases.length ? ` / ${cases.length}` : ''} case
          </p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuovo case</span>
        </Button>
      </div>

      {cases.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca case…"
            className="pl-8 h-8 text-sm"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : cases.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Box className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm mb-4">Nessun case creato ancora</p>
          <Button size="sm" onClick={() => setShowModal(true)}>Crea il primo case</Button>
        </div>
      ) : displayCases.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">Nessun case trovato</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {displayCases.map((c) => (
            <Link
              key={c.id}
              href={`/case/${c.id}`}
              className="flex items-center gap-4 bg-card rounded-xl border border-border px-5 py-4 hover:bg-muted/30 transition group"
            >
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Box className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold group-hover:text-primary transition truncate">{c.name}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {c.description && <span className="truncate max-w-xs">{c.description}</span>}
                  <span>{(c.case_items?.[0]?.count ?? 0)} item</span>
                  <span>{(c.case_kits?.[0]?.count ?? 0)} kit</span>
                  {(() => {
                    const val = (c.case_items || []).reduce((s, ci) => s + (parseFloat(ci.equipment?.market_value) || 0), 0)
                    return val > 0 ? <span>€ {val.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</span> : null
                  })()}
                  <span>{format(new Date(c.created_at), 'd MMM yyyy', { locale: it })}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(o) => { if (!o) { setShowModal(false); setForm(EMPTY); setError('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuovo case</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="case-name">Nome case *</Label>
              <Input
                id="case-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Es. Case telecamere"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Descrizione del contenuto del case…"
                className="resize-none"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annulla</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Crea case
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
