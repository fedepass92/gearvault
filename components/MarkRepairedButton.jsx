'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { Wrench, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function MarkRepairedButton({ equipmentId }) {
  const [loading, setLoading] = useState(false)
  const [repaired, setRepaired] = useState(false)

  async function handleRepaired() {
    setLoading(true)
    const supabase = getSupabase()
    await supabase.from('equipment').update({ condition: 'active' }).eq('id', equipmentId)
    setRepaired(true)
    setLoading(false)
    toast.success('Attrezzatura segnata come riparata')
  }

  if (repaired) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-400">
        <CheckCircle2 className="w-4 h-4" />
        Segnata come riparata
      </div>
    )
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <Wrench className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <p className="text-sm font-medium text-amber-300">In riparazione</p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Questa attrezzatura è attualmente segnata come in riparazione.
      </p>
      <button
        onClick={handleRepaired}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Segna come riparata
      </button>
    </div>
  )
}
