'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ScanLine, CheckCircle2, ArrowLeftRight, Loader2, RotateCcw,
  Package, MapPin, LogOut, LogIn, X, CameraOff, Smartphone, Plus,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

// Lazy-load scanner (needs window/document)
const QRScanner = dynamic(() => import('@/components/QRScanner'), { ssr: false })

const CONDITION_LABEL = {
  active:  { label: 'Disponibile',  color: 'text-emerald-400', dot: 'bg-emerald-400' },
  repair:  { label: 'In riparazione', color: 'text-amber-400', dot: 'bg-amber-400' },
  retired: { label: 'Ritirato',     color: 'text-slate-400',   dot: 'bg-slate-400' },
  sold:    { label: 'Venduto',      color: 'text-slate-500',   dot: 'bg-slate-500' },
}

const CATEGORY_LABELS = {
  camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
  lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
}

export default function ScanPage() {
  // STATE 1: scanning | STATE 2: found | STATE 3: confirmed
  const [phase, setPhase] = useState('scanning')
  const [scanError, setScanError] = useState(null) // camera permission error

  // Phase 2 data
  const [item, setItem] = useState(null)
  const [activeSets, setActiveSets] = useState([])
  const [selectedSetId, setSelectedSetId] = useState('none')
  const [loading, setLoading] = useState(false)

  // Phase 3 data
  const [confirmedAction, setConfirmedAction] = useState(null) // 'checkout' | 'checkin'
  const [confirmedSet, setConfirmedSet] = useState(null)

  // ── Handle QR scan result ─────────────────────────────────────────────────────
  const handleScan = useCallback(async (rawText, err) => {
    if (err) {
      // Camera permission denied
      setScanError('Accesso alla fotocamera negato. Controlla i permessi del browser.')
      setPhase('error')
      return
    }
    if (!rawText) return

    // Extract UUID from URL pattern https://.../item/[uuid]
    console.log('[QR] rawText:', rawText)
    const id = rawText.match(/item\/(?:(?:case|kit)\/)?([0-9a-f-]{36})/i)?.[1]
    console.log('[QR] extracted id:', id)
    if (!id) {
      toast.error('QR non riconosciuto — codice non valido')
      setPhase('scanning')
      return
    }

    setLoading(true)
    const supabase = getSupabase()

    const [{ data: equipment, error: eqErr }, { data: sets }] = await Promise.all([
      supabase.from('equipment').select('*').eq('id', id).single(),
      // Active sets: status 'out' or 'planned', job_date = today
      (async () => {
        const today = new Date().toISOString().slice(0, 10)
        return supabase.from('sets')
          .select('id, name, job_date, location, status')
          .in('status', ['out', 'planned'])
          .lte('job_date', today)
          .order('job_date', { ascending: false })
          .limit(10)
      })(),
    ])

    setLoading(false)

    if (eqErr || !equipment) {
      toast.error('Attrezzatura non trovata nel database')
      setPhase('scanning')
      return
    }

    setItem(equipment)
    setActiveSets(sets || [])
    setSelectedSetId('none')
    setPhase('found')
  }, [])

  // ── Log movement ──────────────────────────────────────────────────────────────
  async function handleAction(action) {
    if (!item) return
    setLoading(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    const setId = selectedSetId !== 'none' ? selectedSetId : null
    const setObj = activeSets.find((s) => s.id === setId) || null

    const { error } = await supabase.from('movement_log').insert({
      equipment_id: item.id,
      set_id: setId,
      action,
      performed_by: user?.id || null,
    })

    if (error) {
      toast.error('Errore nel registro movimenti')
      setLoading(false)
      return
    }

    setLoading(false)
    setConfirmedAction(action)
    setConfirmedSet(setObj)
    setPhase('confirmed')

    // Auto-reset after 2.5 s
    setTimeout(() => {
      setPhase('scanning')
      setItem(null)
      setActiveSets([])
      setConfirmedAction(null)
      setConfirmedSet(null)
    }, 2500)
  }

  function resetToScan() {
    setPhase('scanning')
    setItem(null)
    setActiveSets([])
    setScanError(null)
    setConfirmedAction(null)
    setConfirmedSet(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="-m-4 lg:-m-6 min-h-screen bg-[#0f172a] text-white flex flex-col">

      {/* PWA banner — mobile only */}
      <div className="md:hidden flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/20 text-amber-300 text-xs">
        <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Aggiungi GearVault alla schermata Home per accesso rapido</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <ScanLine className="w-4 h-4 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold leading-tight">Scansione QR</h1>
          <p className="text-xs text-slate-400">Inquadra il codice sull&apos;attrezzatura</p>
        </div>
        <Link
          href="/inventario/nuovo"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-orange-500/50 hover:bg-slate-700 text-xs font-medium text-slate-300 transition flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-orange-400" />
          Nuova
        </Link>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-6 gap-4">

        {/* ── PHASE: scanning ── */}
        {phase === 'scanning' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
              <QRScanner onScan={handleScan} />
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">Punta la fotocamera sul QR dell&apos;attrezzatura</p>
            </div>
            {loading && (
              <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Caricamento…
              </div>
            )}
          </div>
        )}

        {/* ── PHASE: error (camera denied) ── */}
        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
              <CameraOff className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-200 mb-1">Fotocamera non disponibile</p>
              <p className="text-sm text-slate-400">{scanError}</p>
            </div>
            <button
              onClick={resetToScan}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-medium transition"
            >
              <RotateCcw className="w-4 h-4" />
              Riprova
            </button>
          </div>
        )}

        {/* ── PHASE: found ── */}
        {phase === 'found' && item && (
          <div className="flex flex-col gap-3">
            {/* Item card */}
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
              <div className="flex gap-3 p-4">
                {item.photo_url ? (
                  <img src={item.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-slate-700" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-600">
                    <Package className="w-6 h-6 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="font-bold text-base leading-tight truncate">{item.name}</p>
                  {(item.brand || item.model) && (
                    <p className="text-sm text-slate-400 truncate mt-0.5">
                      {[item.brand, item.model].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${CONDITION_LABEL[item.condition]?.dot || 'bg-slate-400'}`} />
                    <span className={`text-xs font-medium ${CONDITION_LABEL[item.condition]?.color || 'text-slate-400'}`}>
                      {CONDITION_LABEL[item.condition]?.label || item.condition}
                    </span>
                    {item.category && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="text-xs text-slate-500">{CATEGORY_LABELS[item.category] || item.category}</span>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={resetToScan} className="self-start text-slate-500 hover:text-slate-300 transition p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {item.location && (
                <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="w-3 h-3" />
                  {item.location}
                </div>
              )}
            </div>

            {/* Set selection */}
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Set attivi
              </p>
              <div className="space-y-2">
                {activeSets.map((s) => (
                  <label key={s.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition border ${
                    selectedSetId === s.id
                      ? 'border-orange-500/50 bg-orange-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
                  }`}>
                    <input
                      type="radio"
                      name="set"
                      value={s.id}
                      checked={selectedSetId === s.id}
                      onChange={() => setSelectedSetId(s.id)}
                      className="accent-orange-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        {s.job_date ? format(new Date(s.job_date), 'd MMM', { locale: it }) : ''}
                        {s.location ? ` · ${s.location}` : ''}
                      </p>
                    </div>
                  </label>
                ))}
                <label className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition border ${
                  selectedSetId === 'none'
                    ? 'border-slate-500 bg-slate-700/40'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
                }`}>
                  <input
                    type="radio"
                    name="set"
                    value="none"
                    checked={selectedSetId === 'none'}
                    onChange={() => setSelectedSetId('none')}
                    className="accent-slate-500"
                  />
                  <p className="text-sm text-slate-400">Nessun set — movimento generico</p>
                </label>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => handleAction('checkout')}
                disabled={loading}
                className="flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600 font-bold text-base transition disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                Segna uscita
              </button>
              <button
                onClick={() => handleAction('checkin')}
                disabled={loading}
                className="flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-bold text-base transition disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                Segna rientro
              </button>
            </div>
          </div>
        )}

        {/* ── PHASE: confirmed ── */}
        {phase === 'confirmed' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              confirmedAction === 'checkout' ? 'bg-orange-500/20' : 'bg-emerald-500/20'
            }`}>
              <CheckCircle2 className={`w-9 h-9 ${
                confirmedAction === 'checkout' ? 'text-orange-400' : 'text-emerald-400'
              }`} />
            </div>
            <div>
              <p className="text-xl font-bold mb-1">
                {confirmedAction === 'checkout' ? 'Uscita registrata' : 'Rientro registrato'}
              </p>
              <p className="text-slate-300 font-medium">{item?.name}</p>
              {confirmedSet && (
                <p className="text-sm text-slate-400 mt-1">Set: {confirmedSet.name}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Scansione successiva in corso…
            </div>
            <button
              onClick={resetToScan}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-medium transition"
            >
              <ScanLine className="w-4 h-4" />
              Scansiona subito
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
