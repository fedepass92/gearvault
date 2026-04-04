'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { MessageSquarePlus, Loader2, Check } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'

export default function QuickNote({ equipmentId, currentNotes }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)
    const supabase = getSupabase()
    const timestamp = format(new Date(), "d MMM yyyy HH:mm", { locale: it })
    const entry = `[${timestamp}] ${text.trim()}`
    const updated = currentNotes ? `${currentNotes}\n${entry}` : entry
    const { error } = await supabase
      .from('equipment')
      .update({ notes: updated })
      .eq('id', equipmentId)
    setSaving(false)
    if (error) { toast.error('Errore nel salvataggio'); return }
    setText('')
    setOpen(false)
    setSaved(true)
    toast.success('Nota aggiunta')
    setTimeout(() => setSaved(false), 3000)
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-400">
        <Check className="w-4 h-4" />
        Nota salvata
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-muted hover:bg-muted/70 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition"
      >
        <MessageSquarePlus className="w-4 h-4" />
        Aggiungi osservazione
      </button>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Osservazione rapida</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Es: batteria scarica, graffi su obiettivo, manca il tappo…"
        rows={3}
        autoFocus
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex gap-2">
        <button
          onClick={() => { setOpen(false); setText('') }}
          className="flex-1 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          Annulla
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !text.trim()}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Salva
        </button>
      </div>
    </div>
  )
}
