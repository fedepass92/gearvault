'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, Loader2, AlertTriangle } from 'lucide-react'

export default function CameraScanner({ onDetected, onClose }) {
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
              onDetected(result.getText())
            }
          }
        )
        if (!stopped) setReady(true)
      } catch (e) {
        if (!stopped) setError(e?.message || 'Impossibile accedere alla camera')
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
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-4 h-4" />
          <span className="text-sm font-medium">Scansiona codice</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Video area */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />

        {/* Finder overlay */}
        {ready && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-56 h-56">
              {/* Corner brackets */}
              <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-sm" />
              <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-sm" />
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-sm" />
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-sm" />
              {/* Scan line animation */}
              <div className="absolute inset-x-2 h-px bg-primary/80 animate-scan-line" />
            </div>
          </div>
        )}

        {/* Loading state */}
        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
            <p className="text-sm text-white/70">Avvio camera…</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-white">{error}</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition"
            >
              Chiudi
            </button>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {ready && (
        <div className="px-4 py-3 bg-black/80 backdrop-blur-sm text-center">
          <p className="text-xs text-white/50">Punta la camera verso un QR code o barcode</p>
        </div>
      )}
    </div>
  )
}
