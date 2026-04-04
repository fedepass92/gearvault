'use client'

import { useState } from 'react'
import { QrCode, Printer, ChevronDown } from 'lucide-react'
import LabelCard from '@/components/LabelCard'

export default function QuickPrintLabel({ item }) {
  const [open, setOpen] = useState(false)

  function handlePrint() {
    setTimeout(() => window.print(), 100)
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition"
      >
        <QrCode className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium flex-1 text-left">Stampa etichetta</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <div id="quick-print-area" className="flex justify-center mb-4">
            <LabelCard item={item} type="qr" isCase={false} />
          </div>
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition"
          >
            <Printer className="w-4 h-4" />
            Stampa etichetta
          </button>
        </div>
      )}
    </div>
  )
}
