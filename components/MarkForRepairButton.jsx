'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { Wrench, Loader2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

export default function MarkForRepairButton({ equipmentId }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    const supabase = getSupabase()
    await supabase.from('equipment').update({ condition: 'repair' }).eq('id', equipmentId)
    setDone(true)
    setLoading(false)
    setOpen(false)
    toast.success('Attrezzatura segnata come in riparazione')
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-300">
        <Wrench className="w-4 h-4" />
        Inviata in riparazione
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition"
      >
        <Wrench className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium flex-1 text-left">Manda in riparazione</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Descrizione del problema (opzionale)…"
            className="w-full text-sm bg-muted/40 border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            rows={2}
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
            Conferma — manda in riparazione
          </button>
        </div>
      )}
    </div>
  )
}
