'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Package, Loader2 } from 'lucide-react'
import CompanyLogo from '@/components/CompanyLogo'

// ── Supabase anon client (no auth) ────────────────────────────────────────────
function getAnonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

const CONDITION_CONFIG = {
  active:  { label: 'Attivo',       className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  repair:  { label: 'Manutenzione', className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  retired: { label: 'Ritirato',     className: 'bg-muted text-muted-foreground border border-border' },
}

const CATEGORY_LABELS = {
  camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
  lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
}

const CATEGORY_ICONS = {
  camera: '📷', lens: '🔭', drone: '🚁', audio: '🎙️',
  lighting: '💡', support: '🎬', accessory: '🔧', altro: '📦',
}

export default function PublicItemPage() {
  const { id } = useParams()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      const supabase = getAnonSupabase()
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, brand, model, serial_number, category, condition, location, battery_status, last_checked_at, notes, photo_url')
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
      } else {
        setItem(data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg font-bold mb-2">Oggetto non trovato</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Questo QR code non corrisponde a nessun oggetto registrato in GearVault.
          </p>
        </div>
      </div>
    )
  }

  const statusCfg = CONDITION_CONFIG[item.condition] || CONDITION_CONFIG.active
  const catLabel  = CATEGORY_LABELS[item.category] || item.category
  const catIcon   = CATEGORY_ICONS[item.category] || '📦'

  return (
    <div className="dark min-h-screen bg-background text-foreground px-4 py-6 pb-12">
      <div className="max-w-sm mx-auto">

        {/* Logo */}
        <div className="flex justify-center mb-8 text-foreground">
          <CompanyLogo variant="light" width={120} />
        </div>

        {/* Main card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
          {/* Photo */}
          <div className="w-full aspect-video bg-muted flex items-center justify-center overflow-hidden">
            {item.photo_url ? (
              <img
                src={item.photo_url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center opacity-30">
                <div className="text-5xl mb-2">{catIcon}</div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{catLabel}</p>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <div>
              <h1 className="text-xl font-extrabold leading-tight">{item.name}</h1>
              {(item.brand || item.model) && (
                <p className="text-sm text-muted-foreground mt-1">{[item.brand, item.model].filter(Boolean).join(' · ')}</p>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {item.category && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  {catLabel}
                </span>
              )}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.className}`}>
                {statusCfg.label}
              </span>
            </div>

            <hr className="border-border" />

            {/* Fields grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {item.brand && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Brand</p>
                  <p className="font-semibold">{item.brand}</p>
                </div>
              )}
              {item.model && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Modello</p>
                  <p className="font-semibold">{item.model}</p>
                </div>
              )}
              {item.serial_number && (
                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Numero seriale</p>
                  <p className="font-mono text-xs font-semibold tracking-wide">{item.serial_number}</p>
                </div>
              )}
            </div>

            {/* Notes */}
            {item.notes && (
              <>
                <hr className="border-border" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Note</p>
                  <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {item.notes}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Return instructions */}
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5 mb-4">
          <p className="text-sm font-bold text-primary mb-2">📬 Hai trovato questo oggetto?</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            È attrezzatura professionale registrata su GearVault.
            Ti preghiamo di contattare il proprietario per organizzare la restituzione.
            Grazie per la tua collaborazione.
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-[10px] text-muted-foreground/40 leading-relaxed mt-6">
          Questa scheda è generata automaticamente da GearVault.<br />
          Le informazioni mostrate sono fornite dal proprietario dell&apos;attrezzatura.<br />
          Brain Digital non è responsabile per eventuali inesattezze.
        </p>

      </div>
    </div>
  )
}
