'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import LabelCard from '@/components/LabelCard'
import { Search, Printer, QrCode, Barcode, CheckSquare, Square, Loader2, Package, Box, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const TABS = [
  { id: 'equipment', label: 'Attrezzatura', icon: Package },
  { id: 'cases', label: 'Case', icon: Box },
  { id: 'kits', label: 'Kit', icon: Layers },
]

export default function EtichettePage() {
  const [tab, setTab] = useState('equipment')
  const [equipment, setEquipment] = useState([])
  const [cases, setCases] = useState([])
  const [kits, setKits] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [labelTypes, setLabelTypes] = useState({})

  useEffect(() => {
    setSelected(new Set())
    setSearch('')
  }, [tab])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const supabase = getSupabase()
      if (tab === 'equipment') {
        let q = supabase.from('equipment').select('id, name, brand, model, serial_number').order('name')
        if (search) q = q.or(`name.ilike.%${search}%,serial_number.ilike.%${search}%,brand.ilike.%${search}%`)
        const { data } = await q
        setEquipment(data || [])
      } else if (tab === 'kits') {
        let q = supabase.from('kits').select('id, name, description').order('name')
        if (search) q = q.ilike('name', `%${search}%`)
        const { data } = await q
        setKits(data || [])
      } else {
        let q = supabase.from('cases').select('id, name, description').order('name')
        if (search) q = q.ilike('name', `%${search}%`)
        const { data } = await q
        setCases(data || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [tab, search])

  const items = tab === 'equipment' ? equipment : tab === 'kits' ? kits : cases

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(selected.size === items.length ? new Set() : new Set(items.map((e) => e.id)))
  }

  function setLabelType(id, type) {
    setLabelTypes((prev) => ({ ...prev, [id]: type }))
  }

  const selectedItems = items.filter((e) => selected.has(e.id))
  const isCase = tab === 'cases'
  const isKit = tab === 'kits'

  function handlePrint() {
    setTimeout(() => window.print(), 100)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Etichette</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {selected.size > 0 ? `${selected.size} selezionati` : 'Seleziona gli elementi da etichettare'}
          </p>
        </div>
        <Button size="sm" onClick={handlePrint} disabled={selected.size === 0}>
          <Printer className="w-4 h-4" />
          Stampa {selected.size > 0 ? `(${selected.size})` : ''}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Cerca ${isCase ? 'case' : 'attrezzatura'}…`}
          className="pl-8"
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition">
            {selected.size === items.length && items.length > 0
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4" />}
          </button>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Seleziona tutto ({items.length})
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nessun elemento trovato</p>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item) => {
              const isSelected = selected.has(item.id)
              const labelType = labelTypes[item.id] || 'qr'
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 px-4 py-3 transition ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                >
                  <button onClick={() => toggleSelect(item.id)} className="text-muted-foreground hover:text-foreground transition flex-shrink-0">
                    {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleSelect(item.id)}>
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {isCase || isKit
                        ? (item.description || 'Nessuna descrizione')
                        : [item.brand, item.model].filter(Boolean).join(' · ') + (item.serial_number ? ` · S/N: ${item.serial_number}` : '')
                      }
                    </div>
                  </div>
                  {!isCase && !isKit && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setLabelType(item.id, 'qr')}
                        title="QR Code"
                        className={`p-1.5 rounded-lg transition ${labelType === 'qr' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setLabelType(item.id, 'barcode')}
                        title="Barcode"
                        className={`p-1.5 rounded-lg transition ${labelType === 'barcode' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                      >
                        <Barcode className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Anteprima etichette
          </h2>
          <div id="print-area">
            <div className="grid gap-4 print:grid-cols-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90mm, 1fr))' }}>
              {selectedItems.map((item) => (
                <LabelCard key={item.id} item={item} type={(isCase || isKit) ? 'qr' : (labelTypes[item.id] || 'qr')} isCase={isCase} isKit={isKit} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
