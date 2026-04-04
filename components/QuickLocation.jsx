'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { MapPin, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

const LOCATIONS = [
  { value: 'studio', label: 'Studio', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25' },
  { value: 'campo', label: 'Campo', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25' },
  { value: 'prestito', label: 'Prestito', color: 'bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/25' },
]

export default function QuickLocation({ equipmentId, currentLocation }) {
  const [location, setLocation] = useState(currentLocation)
  const [saving, setSaving] = useState(null)

  async function handleSet(value) {
    if (value === location) return
    setSaving(value)
    const supabase = getSupabase()
    const { error } = await supabase
      .from('equipment')
      .update({ location: value })
      .eq('id', equipmentId)
    setSaving(null)
    if (error) { toast.error('Errore nel salvataggio'); return }
    setLocation(value)
    const label = LOCATIONS.find((l) => l.value === value)?.label || value
    toast.success(`Location aggiornata: ${label}`)
  }

  return (
    <div className="bg-card rounded-xl border border-border px-4 py-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" />
        Aggiorna location
      </p>
      <div className="grid grid-cols-3 gap-2">
        {LOCATIONS.map((loc) => {
          const active = location === loc.value
          return (
            <button
              key={loc.value}
              onClick={() => handleSet(loc.value)}
              disabled={!!saving}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition disabled:opacity-50 ${
                active
                  ? loc.color + ' ring-1 ring-current'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              {saving === loc.value
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : active
                ? <Check className="w-3.5 h-3.5" />
                : <MapPin className="w-3.5 h-3.5 opacity-60" />}
              {loc.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
