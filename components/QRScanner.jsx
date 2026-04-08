'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, AlertTriangle } from 'lucide-react'

export default function QRScanner({ onScan }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stopped = false
    let controls = null

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (stopped) return

        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader

        // Prefer rear camera
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const deviceId = devices.find((d) =>
          /back|rear|environment/i.test(d.label)
        )?.deviceId || devices[devices.length - 1]?.deviceId || undefined

        controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err) => {
            if (stopped) return
            if (result) {
              onScan(result.getText(), null)
            }
          }
        )
        if (!stopped) setReady(true)
      } catch (e) {
        if (!stopped) {
          setError(e?.message || 'Impossibile accedere alla camera')
          onScan(null, e)
        }
      }
    }

    start()

    return () => {
      stopped = true
      controls?.stop()
      if (readerRef.current) {
        try { readerRef.current.reset() } catch { /* ignore */ }
      }
    }
  }, [onScan])

  return (
    <div className="relative w-full bg-black overflow-hidden rounded-xl">
      <video
        ref={videoRef}
        className="w-full aspect-square object-cover"
        autoPlay
        muted
        playsInline
      />

      {/* Finder overlay */}
      {ready && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-56 h-56">
            <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-sm" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-sm" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-sm" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-sm" />
          </div>
        </div>
      )}

      {/* Loading */}
      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
          <p className="text-sm text-white/70">Avvio camera…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-white">{error}</p>
        </div>
      )}

      {/* Footer hint */}
      {ready && (
        <div className="absolute bottom-0 inset-x-0 px-4 py-2 bg-black/60 backdrop-blur-sm text-center">
          <p className="text-xs text-white/50">Punta la camera verso un QR code</p>
        </div>
      )}
    </div>
  )
}
