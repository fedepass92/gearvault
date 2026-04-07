'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import LabelCard, { LABEL_FORMATS } from '@/components/LabelCard'
import { Search, Printer, CheckSquare, Square, Loader2, Package, Box, Layers, ChevronDown, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const TABS = [
  { id: 'equipment', label: 'Attrezzatura', icon: Package },
  { id: 'cases',     label: 'Case',         icon: Box },
  { id: 'kits',      label: 'Kit',          icon: Layers },
]

// Print columns per format (on A4)
const FORMAT_PRINT_COLS = {
  keytag:  4,
  dot:     8,
  baby:    5,
  barcode: 3,
  cable:   2,
}

// Preview grid min-width per format
const FORMAT_MIN_WIDTH = {
  keytag:  '55mm',
  dot:     '30mm',
  baby:    '43mm',
  barcode: '65mm',
  cable:   '85mm',
}

// Format accent colors for the pill badge
const FORMAT_COLORS = {
  keytag:  { bg: '#0f172a', text: '#ffffff' },
  dot:     { bg: '#7c3aed', text: '#ffffff' },
  baby:    { bg: '#0369a1', text: '#ffffff' },
  barcode: { bg: '#166534', text: '#ffffff' },
  cable:   { bg: '#9f1239', text: '#ffffff' },
}

export default function EtichettePage() {
  const [tab, setTab]           = useState('equipment')
  const [equipment, setEquipment] = useState([])
  const [cases, setCases]       = useState([])
  const [kits, setKits]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(new Set())
  const [itemFormats, setItemFormats] = useState({})
  const [globalFormat, setGlobalFormat] = useState('keytag')

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

  const items  = tab === 'equipment' ? equipment : tab === 'kits' ? kits : cases
  const isCase = tab === 'cases'
  const isKit  = tab === 'kits'

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        setItemFormats((f) => ({ ...f, [id]: f[id] || globalFormat }))
      }
      return next
    })
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map((e) => e.id)))
      setItemFormats((f) => {
        const next = { ...f }
        items.forEach((e) => { if (!next[e.id]) next[e.id] = globalFormat })
        return next
      })
    }
  }

  function setItemFormat(id, fmt) {
    setItemFormats((prev) => ({ ...prev, [id]: fmt }))
  }

  function applyGlobalFormat(fmt) {
    setGlobalFormat(fmt)
    setItemFormats((prev) => {
      const next = { ...prev }
      selected.forEach((id) => { next[id] = fmt })
      return next
    })
  }

  function getFormat(id) {
    return itemFormats[id] || globalFormat
  }

  const selectedItems = items.filter((e) => selected.has(e.id))
  const globalFmtInfo = LABEL_FORMATS.find((f) => f.id === globalFormat)

  function handlePrint() {
    setTimeout(() => window.print(), 100)
  }

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Etichette</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {selected.size > 0
              ? `${selected.size} element${selected.size === 1 ? 'o' : 'i'} selezionat${selected.size === 1 ? 'o' : 'i'}`
              : 'Seleziona gli elementi da etichettare'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Global format picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8">
                <Tag className="w-3.5 h-3.5" />
                <span className="font-medium">{globalFmtInfo?.label}</span>
                <span className="text-muted-foreground text-xs hidden sm:inline">{globalFmtInfo?.size}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {LABEL_FORMATS.map((f) => {
                const col = FORMAT_COLORS[f.id]
                return (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => applyGlobalFormat(f.id)}
                    className={`gap-2 ${globalFormat === f.id ? 'font-semibold' : ''}`}
                  >
                    <span
                      style={{ background: col.bg, color: col.text }}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    >
                      {f.label}
                    </span>
                    <span className="flex-1">{f.size}</span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="h-8" onClick={handlePrint} disabled={selected.size === 0}>
            <Printer className="w-4 h-4" />
            Stampa {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
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

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Cerca ${isCase ? 'case' : isKit ? 'kit' : 'attrezzatura'}…`}
          className="pl-8"
        />
      </div>

      {/* ── Item list ──────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Select-all row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition">
            {selected.size === items.length && items.length > 0
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4" />}
          </button>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex-1">
            Seleziona tutto ({items.length})
          </span>
          {selected.size > 0 && (
            <span className="text-xs text-muted-foreground">
              Formato: <span className="font-medium text-foreground">{globalFmtInfo?.label}</span> applicato a {selected.size}
            </span>
          )}
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
              const fmt        = getFormat(item.id)
              const fmtInfo    = LABEL_FORMATS.find((f) => f.id === fmt)
              const col        = FORMAT_COLORS[fmt]
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-2.5 transition ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                >
                  <button
                    onClick={() => toggleSelect(item.id)}
                    className="text-muted-foreground hover:text-foreground transition flex-shrink-0"
                  >
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-primary" />
                      : <Square className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleSelect(item.id)}>
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {isCase || isKit
                        ? (item.description || 'Nessuna descrizione')
                        : [item.brand, item.model].filter(Boolean).join(' · ') +
                          (item.serial_number ? ` · ${item.serial_number}` : '')}
                    </div>
                  </div>

                  {/* Per-item format selector */}
                  {isSelected && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-border bg-card hover:bg-muted transition flex-shrink-0"
                          style={{ minWidth: '80px' }}
                        >
                          <span
                            style={{ background: col.bg, color: col.text }}
                            className="text-[8px] font-bold px-1 py-0.5 rounded"
                          >
                            {fmtInfo?.label}
                          </span>
                          <span className="text-muted-foreground hidden sm:inline text-[10px]">{fmtInfo?.size}</span>
                          <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {LABEL_FORMATS.map((f) => {
                          const c = FORMAT_COLORS[f.id]
                          return (
                            <DropdownMenuItem
                              key={f.id}
                              onClick={() => setItemFormat(item.id, f.id)}
                              className={`gap-2 ${fmt === f.id ? 'font-semibold' : ''}`}
                            >
                              <span
                                style={{ background: c.bg, color: c.text }}
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                              >
                                {f.label}
                              </span>
                              <span className="flex-1">{f.size}</span>
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Preview + print area ───────────────────────────────────────────── */}
      {selectedItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Anteprima ({selectedItems.length})
            </h2>
          </div>

          <div id="print-area">
            {LABEL_FORMATS.map((f) => {
              const group = selectedItems.filter((it) => getFormat(it.id) === f.id)
              if (group.length === 0) return null
              const col = FORMAT_COLORS[f.id]
              return (
                <div key={f.id} className="mb-8 print:mb-0">
                  {/* Format header — screen only */}
                  <div className="flex items-center gap-2 mb-3 print:hidden">
                    <span
                      style={{ background: col.bg, color: col.text }}
                      className="text-[10px] font-bold px-2 py-1 rounded"
                    >
                      {f.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{f.size}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {group.length} etichett{group.length === 1 ? 'a' : 'e'}
                    </span>
                  </div>

                  {/* Grid */}
                  <div
                    className={`print:grid-cols-[repeat(${FORMAT_PRINT_COLS[f.id]},auto)]`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(auto-fill, minmax(${FORMAT_MIN_WIDTH[f.id]}, auto))`,
                      gap: f.id === 'dot' ? '8px' : f.id === 'keytag' ? '12px' : '8px',
                      alignItems: 'start',
                    }}
                  >
                    {group.map((item) => (
                      <LabelCard
                        key={item.id}
                        item={item}
                        format={f.id}
                        isCase={isCase}
                        isKit={isKit}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
