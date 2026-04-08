'use client'

import { useEffect, useRef } from 'react'

// html5-qrcode must be dynamically imported client-side (uses window/document)
export default function QRScanner({ onScan }) {
  const scannerRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let scanner

    async function start() {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!mountedRef.current) return

      scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (!mountedRef.current) return
            scanner.stop().catch(() => {})
            onScan(decodedText)
          },
          () => {} // ignore per-frame scan errors
        )
      } catch (err) {
        // Camera permission denied or not available
        if (mountedRef.current) onScan(null, err)
      }
    }

    start()

    return () => {
      mountedRef.current = false
      scannerRef.current?.stop().catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full">
      <div id="qr-reader" className="w-full overflow-hidden rounded-xl" />
    </div>
  )
}
