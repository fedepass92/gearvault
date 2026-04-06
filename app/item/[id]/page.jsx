'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Package, AlertTriangle, Mail } from 'lucide-react'

// ── Supabase anon client (no auth) ────────────────────────────────────────────
function getAnonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// ── Brain Digital logo SVG ─────────────────────────────────────────────────────
function BrainLogo({ width = 130 }) {
  return (
    <svg width={width} viewBox="0 0 723.29 271.79" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <g fill="#ffffff">
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

// Maps equipment.condition values
const CONDITION_CONFIG = {
  active:  { label: 'Attivo',        bg: '#10b98120', color: '#10b981', border: '#10b98140' },
  repair:  { label: 'Manutenzione',  bg: '#f59e0b20', color: '#f59e0b', border: '#f59e0b40' },
  retired: { label: 'Ritirato',      bg: '#64748b20', color: '#64748b', border: '#64748b40' },
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
        .from('public_equipment')
        .select('*')
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

  const s = {
    page: {
      minHeight: '100vh',
      background: '#0f172a',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#f1f5f9',
      padding: '24px 16px 48px',
    },
    maxW: {
      maxWidth: 480,
      margin: '0 auto',
    },
    logoBar: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 32,
    },
    card: {
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
    },
    photoBox: {
      width: '100%',
      aspectRatio: '16/9',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    body: {
      padding: '20px 24px',
    },
    name: {
      fontSize: 22,
      fontWeight: 800,
      color: '#ffffff',
      margin: '0 0 4px',
      lineHeight: 1.2,
    },
    sub: {
      fontSize: 14,
      color: '#94a3b8',
      margin: '0 0 16px',
    },
    badgeRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    badge: (cfg) => ({
      display: 'inline-block',
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 10px',
    }),
    catBadge: {
      display: 'inline-block',
      background: '#2563eb20',
      color: '#93c5fd',
      border: '1px solid #2563eb40',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 10px',
    },
    separator: {
      height: 1,
      background: '#334155',
      margin: '16px 0',
    },
    fieldLabel: {
      fontSize: 10,
      fontWeight: 700,
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 3,
    },
    fieldValue: {
      fontSize: 14,
      fontWeight: 600,
      color: '#e2e8f0',
    },
    grid2: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16,
      marginBottom: 16,
    },
    notesBox: {
      background: '#0f172a',
      border: '1px solid #334155',
      borderRadius: 10,
      padding: '12px 16px',
      fontSize: 13,
      color: '#94a3b8',
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
    },
    ownerCard: {
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 16,
    },
    ownerLabel: {
      fontSize: 11,
      fontWeight: 700,
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 6,
    },
    ownerName: {
      fontSize: 16,
      fontWeight: 700,
      color: '#ffffff',
      margin: '0 0 2px',
    },
    returnBox: {
      background: '#1e3a5f',
      border: '1px solid #2563eb60',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 16,
    },
    returnTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 14,
      fontWeight: 700,
      color: '#93c5fd',
      marginBottom: 10,
    },
    returnText: {
      fontSize: 13,
      color: '#cbd5e1',
      lineHeight: 1.65,
      margin: 0,
    },
    emailLink: {
      color: '#60a5fa',
      fontWeight: 600,
      textDecoration: 'none',
    },
    disclaimer: {
      textAlign: 'center',
      fontSize: 10,
      color: '#334155',
      lineHeight: 1.6,
      marginTop: 32,
    },
  }

  if (loading) {
    return (
      <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #334155', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: 14 }}>Caricamento…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <p style={{ fontWeight: 700, fontSize: 18, color: '#f1f5f9', marginBottom: 8 }}>Oggetto non trovato</p>
          <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
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
    <div style={s.page}>
      <div style={s.maxW}>

        {/* Logo */}
        <div style={s.logoBar}>
          <BrainLogo width={120} />
        </div>

        {/* Main card */}
        <div style={s.card}>
          {/* Photo */}
          <div style={s.photoBox}>
            {item.photo_url ? (
              <img
                src={item.photo_url}
                alt={item.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.3 }}>
                <div style={{ fontSize: 56, marginBottom: 8 }}>{catIcon}</div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {catLabel}
                </p>
              </div>
            )}
          </div>

          {/* Body */}
          <div style={s.body}>
            <h1 style={s.name}>{item.name}</h1>
            {(item.brand || item.model) && (
              <p style={s.sub}>{[item.brand, item.model].filter(Boolean).join(' · ')}</p>
            )}

            {/* Badges */}
            <div style={s.badgeRow}>
              {item.category && (
                <span style={s.catBadge}>{catLabel}</span>
              )}
              <span style={s.badge(statusCfg)}>{statusCfg?.label}</span>
            </div>

            <div style={s.separator} />

            {/* Fields */}
            <div style={s.grid2}>
              {item.brand && (
                <div>
                  <p style={s.fieldLabel}>Brand</p>
                  <p style={s.fieldValue}>{item.brand}</p>
                </div>
              )}
              {item.model && (
                <div>
                  <p style={s.fieldLabel}>Modello</p>
                  <p style={s.fieldValue}>{item.model}</p>
                </div>
              )}
              {item.serial_number && (
                <div>
                  <p style={s.fieldLabel}>Numero seriale</p>
                  <p style={{ ...s.fieldValue, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.05em' }}>
                    {item.serial_number}
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            {item.notes && (
              <>
                <div style={s.separator} />
                <p style={s.fieldLabel}>Note</p>
                <div style={s.notesBox}>{item.notes}</div>
              </>
            )}
          </div>
        </div>

        {/* Return instructions box */}
        <div style={s.returnBox}>
          <div style={s.returnTitle}>
            <span style={{ fontSize: 18 }}>📬</span>
            Hai trovato questo oggetto?
          </div>
          <p style={s.returnText}>
            È attrezzatura professionale registrata su GearVault.
            Ti preghiamo di contattare il proprietario per organizzare la restituzione.
            Grazie per la tua collaborazione.
          </p>
        </div>

        {/* Disclaimer */}
        <p style={s.disclaimer}>
          Questa scheda è generata automaticamente da GearVault.<br />
          Le informazioni mostrate sono fornite dal proprietario dell&apos;attrezzatura.<br />
          Brain Digital non è responsabile per eventuali inesattezze.
        </p>

      </div>
    </div>
  )
}
