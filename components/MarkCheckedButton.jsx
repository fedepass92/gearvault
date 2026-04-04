'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'

export default function MarkCheckedButton({ equipmentId, currentCheckedAt }) {
  const [loading, setLoading] = useState(false)
  const [checkedAt, setCheckedAt] = useState(currentCheckedAt)

  async function handleMark() {
    setLoading(true)
    const supabase = getSupabase()
    const now = new Date().toISOString()
    await supabase.from('equipment').update({ last_checked_at: now }).eq('id', equipmentId)
    setCheckedAt(now)
    setLoading(false)
    toast.success('Controllo registrato')
  }

  if (checkedAt && new Date(checkedAt).toDateString() === new Date().toDateString()) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-400">
        <CheckCircle2 className="w-4 h-4" />
        Controllato oggi alle {format(new Date(checkedAt), 'HH:mm')}
      </div>
    )
  }

  return (
    <button
      onClick={handleMark}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl text-sm font-medium transition"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
      Segna come controllato
    </button>
  )
}
