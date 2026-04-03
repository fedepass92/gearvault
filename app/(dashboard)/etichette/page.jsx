'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import LabelCard from '@/components/LabelCard'
import { Search, Printer, QrCode, Barcode, CheckSquare, Square, Loader2 } from 'lucide-react'

export default function EtichettePage() {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [labelTypes, setLabelTypes] = useState({}) // id → 'qr' | 'barcode'
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    async function fetchEquipment() {
      const supabase = getSupabase()
      let q = supabase.from('equipment').select('id, name, brand, model, serial_number').order('name')
      if (search) q = q.or(`name.ilike.%${search}%,serial_number.ilike.%${search}%,brand.ilike.%${search}%`)
      const { data } = await q
      setEquipment(data || [])
      setLoading(false)
    }
    fetchEquipment()
  }, [search])

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === equipment.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(equipment.map((e) => e.id)))
    }
  }

  function setLabelType(id, type) {
    setLabelTypes((prev) => ({ ...prev, [id]: type }))
  }

  const selectedItems = equipment.filter((e) => selected.has(e.id))

  function handlePrint() {
    setShowPreview(true)
    setTimeout(() => window.print(), 300)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Etichette</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {selected.size > 0 ? `${selected.size} selezionati` : 'Seleziona le attrezzature da etichettare'}
          </p>
        </div>
        <button
          onClick={handlePrint}
          disabled={selected.size === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition shadow-lg shadow-blue-600/20"
        >
          <Printer className="w-4 h-4" />
          Stampa {selected.size > 0 ? `(${selected.size})` : ''}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca attrezzatura…"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* Equipment list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/50">
          <button onClick={toggleAll} className="text-slate-400 hover:text-white transition">
            {selected.size === equipment.length && equipment.length > 0
              ? <CheckSquare className="w-4 h-4 text-blue-400" />
              : <Square className="w-4 h-4" />}
          </button>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Seleziona tutto ({equipment.length})
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {equipment.map((item) => {
              const isSelected = selected.has(item.id)
              const labelType = labelTypes[item.id] || 'qr'
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 px-4 py-3 transition ${isSelected ? 'bg-blue-600/5' : 'hover:bg-slate-700/20'}`}
                >
                  <button onClick={() => toggleSelect(item.id)} className="text-slate-400 hover:text-white transition flex-shrink-0">
                    {isSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0" onClick={() => toggleSelect(item.id)} role="button" tabIndex={0}>
                    <div className="text-sm font-medium text-white truncate">{item.name}</div>
                    <div className="text-xs text-slate-500">
                      {[item.brand, item.model].filter(Boolean).join(' · ')}
                      {item.serial_number ? ` · S/N: ${item.serial_number}` : ''}
                    </div>
                  </div>
                  {/* Label type toggle */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setLabelType(item.id, 'qr')}
                      title="QR Code"
                      className={`p-1.5 rounded-lg transition ${labelType === 'qr' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setLabelType(item.id, 'barcode')}
                      title="Barcode"
                      className={`p-1.5 rounded-lg transition ${labelType === 'barcode' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`}
                    >
                      <Barcode className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Print area (visible on screen as preview + for print) */}
      {selectedItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Anteprima etichette
          </h2>
          <div id="print-area">
            <div className="grid gap-4 print:grid-cols-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90mm, 1fr))' }}>
              {selectedItems.map((item) => (
                <LabelCard key={item.id} item={item} type={labelTypes[item.id] || 'qr'} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
