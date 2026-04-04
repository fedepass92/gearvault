'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { Briefcase, Loader2, Check, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

export default function QuickAddToSet({ equipmentId, currentSetIds = [] }) {
  const [open, setOpen] = useState(false)
  const [sets, setSets] = useState([])
  const [loadingSets, setLoadingSets] = useState(false)
  const [saving, setSaving] = useState(null)
  const [added, setAdded] = useState(new Set(currentSetIds))

  async function handleOpen() {
    if (open) { setOpen(false); return }
    setLoadingSets(true)
    setOpen(true)
    const supabase = getSupabase()
    const { data } = await supabase
      .from('sets')
      .select('id, name, job_date, status')
      .in('status', ['planned', 'out'])
      .order('job_date', { ascending: true, nullsFirst: false })
    setSets(data || [])
    setLoadingSets(false)
  }

  async function handleAdd(setId, setName) {
    setSaving(setId)
    const supabase = getSupabase()
    const { error } = await supabase
      .from('set_items')
      .upsert({ set_id: setId, equipment_id: equipmentId, status: 'planned' }, { onConflict: 'set_id,equipment_id', ignoreDuplicates: true })
    setSaving(null)
    if (error) { toast.error('Errore'); return }
    setAdded((prev) => new Set([...prev, setId]))
    toast.success(`Aggiunto a "${setName}"`)
  }

  const STATUS_LABELS = { planned: 'Pianificato', out: 'In uscita' }
  const STATUS_STYLES = {
    planned: 'bg-muted text-muted-foreground',
    out: 'bg-amber-500/15 text-amber-300',
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition"
      >
        <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium flex-1 text-left">Aggiungi a un set</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border">
          {loadingSets ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : sets.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-5 px-4">
              Nessun set attivo disponibile
            </p>
          ) : (
            <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
              {sets.map((s) => {
                const isAdded = added.has(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => !isAdded && handleAdd(s.id, s.name)}
                    disabled={isAdded || saving === s.id}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition disabled:cursor-default text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      {s.job_date && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.job_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[s.status] || 'bg-muted text-muted-foreground'}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                    {saving === s.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
                    ) : isAdded ? (
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
