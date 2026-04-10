'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Package, Loader2 } from 'lucide-react'

// ── Supabase anon client (no auth) ────────────────────────────────────────────
function getAnonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// ── Brain Digital logo SVG ─────────────────────────────────────────────────────
function BrainLogo({ width = 120 }) {
  return (
    <svg width={width} viewBox="0 0 723.29 271.79" xmlns="http://www.w3.org/2000/svg" className="block">
      <g fill="currentColor">
        <polygon points="16.75 238.09 16.75 256.69 33.22 256.69 35.34 254.61 35.34 240.22 33.22 238.09 16.75 238.09"/>
        <rect x="568.6" y="238.09" width="18.55" height="6.18"/>
        <path d="M0,223.49v48.3h723.29v-48.3H0ZM41.48,256.64l-6.18,6.18H10.56v-30.91h24.73l6.18,6.18v18.55ZM137.02,262.82h-6.18v-30.91h6.18v30.91ZM257.27,238.09h-24.73v18.55h18.55v-6.18h-12.36v-6.18h18.55v18.55h-30.91v-30.91h30.91v6.18ZM352.81,262.82h-6.18v-30.91h6.18v30.91ZM473.06,238.09h-12.36v24.73h-6.18v-24.73h-12.36v-6.18h30.91v6.18ZM593.33,262.82h-6.18v-12.36h-18.55v12.36h-6.18v-30.91h30.91v30.91ZM713.6,262.82h-30.91v-30.91h6.18v24.73h24.73v6.18Z"/>
        <path d="M89.49,0c13.11,0,24.3,4.63,33.57,13.9s13.9,20.46,13.9,33.57v16.01c0,13.11-4.63,24.3-13.9,33.57-.94.94-1.87,1.78-2.81,2.53v.14c2.71,1.78,5.29,3.84,7.72,6.18,9.27,9.18,13.9,20.46,13.9,33.85v23.46c0,13.11-4.63,24.3-13.9,33.57-9.27,9.27-20.46,13.9-33.57,13.9H5.08c-3.37,0-5.06-1.69-5.06-5.06V5.06C.02,1.69,1.71,0,5.08,0h84.41ZM50.58,45.51v35.39c0,2.25,1.12,3.37,3.37,3.37h22.61c6.55,0,9.83-3.28,9.83-9.83v-22.47c0-6.55-3.28-9.83-9.83-9.83h-22.61c-2.25,0-3.37,1.12-3.37,3.37ZM50.58,129.78v35.39c0,2.25,1.12,3.37,3.37,3.37h24.02c8.89,0,13.34-3.74,13.34-11.24v-19.66c0-7.49-3.75-11.24-11.24-11.24h-26.12c-2.25,0-3.37,1.12-3.37,3.37Z"/>
        <path d="M287.38,105.2c7.87,8.8,11.8,19.24,11.8,31.32v69.1c0,3.37-1.69,5.06-5.06,5.06h-41.15c-3.37,0-5.06-1.69-5.06-5.06v-67.98c0-7.49-3.75-11.24-11.24-11.24h-20.37c-1.87,0-2.81,1.12-2.81,3.37v75.84c0,3.37-1.69,5.06-5.06,5.06h-40.45c-3.37,0-5.06-1.69-5.06-5.06V5.06c0-3.37,1.69-5.06,5.06-5.06h83.01c13.11,0,24.3,4.63,33.57,13.9,9.27,9.27,13.9,20.46,13.9,33.57v26.97c0,11.7-3.7,21.91-11.1,30.62v.14ZM213.51,45.51v35.39c0,2.25,1.12,3.37,3.37,3.37h21.21c6.55,0,9.83-3.28,9.83-9.83v-22.47c0-6.55-3.28-9.83-9.83-9.83h-21.21c-2.25,0-3.37,1.12-3.37,3.37Z"/>
        <path d="M375.72,160.81l-7.16,44.8c-.56,3.37-2.53,5.06-5.9,5.06h-42.28c-2.81,0-4.21-1.17-4.21-3.51,0-.47.05-.98.14-1.54L354.8,5.06c.65-3.37,2.67-5.06,6.04-5.06h67.7c3.37,0,5.38,1.69,6.04,5.06l38.48,200.56c.09.56.14,1.08.14,1.54,0,2.34-1.4,3.51-4.21,3.51h-42.28c-3.37,0-5.34-1.69-5.9-5.06l-7.16-44.8h-37.92ZM394.69,45.22l-12.64,76.97h25.28l-12.64-76.97Z"/>
        <path d="M540.75,205.62c0,3.37-1.64,5.06-4.92,5.06h-40.59c-3.37,0-5.06-1.69-5.06-5.06V5.06c0-3.37,1.69-5.06,5.06-5.06h40.59c3.28,0,4.92,1.69,4.92,5.06v200.56Z"/>
        <path d="M672.63,125.56V5.06c0-3.37,1.69-5.06,5.06-5.06h40.59c3.28,0,4.92,1.69,4.92,5.06v200.56c0,3.37-1.64,5.06-4.92,5.06h-58.15c-3.37,0-5.62-1.69-6.74-5.06l-41.01-121.35v121.35c0,3.37-1.64,5.06-4.92,5.06h-40.59c-3.37,0-5.06-1.69-5.06-5.06V5.06c0-3.37,1.69-5.06,5.06-5.06h58.43c3.37,0,5.62,1.69,6.74,5.06l40.59,120.51Z"/>
      </g>
    </svg>
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
          <BrainLogo width={120} />
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
