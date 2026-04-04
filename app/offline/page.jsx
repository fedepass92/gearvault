'use client'

import Link from 'next/link'
import { WifiOff, Camera, RefreshCw } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
        <Camera className="w-8 h-8 text-primary" />
      </div>

      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border mb-4">
          <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Nessuna connessione</span>
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">GearVault è offline</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Controlla la connessione internet e riprova. Le pagine visitate di recente potrebbero essere disponibili dalla cache.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Riprova
        </button>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-muted text-muted-foreground rounded-xl text-sm font-medium hover:bg-muted/70 hover:text-foreground transition"
        >
          Vai alla home
        </Link>
      </div>

      <p className="text-xs text-muted-foreground/50 mt-8">GearVault · Brain Digital</p>
    </div>
  )
}
