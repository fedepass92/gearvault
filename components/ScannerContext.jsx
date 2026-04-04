'use client'

import { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react'

const ScannerContext = createContext(null)

const SCANNER_SPEED_THRESHOLD_MS = 50
const MIN_SCAN_LENGTH = 6

function parseScanResult(raw) {
  // Legacy format: GEARVAULT:id:serial:name
  if (raw.startsWith('GEARVAULT:')) {
    const parts = raw.split(':')
    return { type: 'gearvault', id: parts[1] || null, serial: parts[2] || null, name: parts.slice(3).join(':') || null, raw }
  }
  // URL format: https://host/scan/{id} or /scan/{id}
  const urlMatch = raw.match(/\/scan\/([0-9a-f-]{36})$/)
  if (urlMatch) {
    return { type: 'gearvault', id: urlMatch[1], serial: null, name: null, raw }
  }
  // URL format case: /scan/case/{id}
  const caseMatch = raw.match(/\/scan\/case\/([0-9a-f-]{36})$/)
  if (caseMatch) {
    return { type: 'gearvault-case', id: caseMatch[1], serial: null, name: null, raw }
  }
  return { type: 'serial', serial: raw, raw }
}

function playBeep(frequency = 880, duration = 80, volume = 0.3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.type = 'square'
    oscillator.frequency.value = frequency
    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration / 1000)
  } catch {
    // AudioContext not available
  }
}

export function ScannerProvider({ children }) {
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const listenersRef = useRef([])
  const [lastScan, setLastScan] = useState(null)
  const activeRef = useRef(true)

  const subscribe = useCallback((fn) => {
    listenersRef.current.push(fn)
    return () => {
      listenersRef.current = listenersRef.current.filter((l) => l !== fn)
    }
  }, [])

  const emit = useCallback((result) => {
    setLastScan(result)
    listenersRef.current.forEach((fn) => fn(result))
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if (!activeRef.current) return

      // Ignore if typing in an input/textarea (unless it's our hidden scanner input)
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') {
        // Only intercept if the focused element has data-scanner="true"
        if (document.activeElement?.dataset?.scanner !== 'true') return
      }

      const now = Date.now()
      const timeDelta = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      if (e.key === 'Enter') {
        const raw = bufferRef.current.trim()
        bufferRef.current = ''
        if (raw.length >= MIN_SCAN_LENGTH) {
          // It was a scanner if chars came in fast enough (heuristic: treat Enter as scanner-triggered)
          const result = parseScanResult(raw)
          playBeep()
          emit(result)
        }
        return
      }

      if (e.key.length === 1) {
        // If inter-keystroke time is > threshold, it's keyboard → start fresh
        if (timeDelta > 500 && bufferRef.current.length > 0) {
          bufferRef.current = ''
        }
        bufferRef.current += e.key
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [emit])

  return (
    <ScannerContext.Provider value={{ subscribe, lastScan, playBeep }}>
      {children}
    </ScannerContext.Provider>
  )
}

export function useScanner() {
  const ctx = useContext(ScannerContext)
  if (!ctx) throw new Error('useScanner must be used within ScannerProvider')
  return ctx
}

export function useScannerListener(callback, enabled = true) {
  const { subscribe } = useScanner()
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    const unsub = subscribe((result) => callbackRef.current(result))
    return unsub
  }, [subscribe, enabled])
}
