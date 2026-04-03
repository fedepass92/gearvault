'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { Plus, Box, Loader2, ChevronRight, X } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const EMPTY = { name: '', description: '' }

export default function CasePage() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchCases() }, [])

  async function fetchCases() {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('cases')
      .select('*, case_items(count)')
      .order('created_at', { ascending: false })
    setCases(data || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = getSupabase()
    const { error: err } = await supabase.from('cases').insert({
      name: form.name,
      description: form.description || null,
    })
    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      setShowModal(false)
      setForm(EMPTY)
      fetchCases()
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Case / Kit</h1>
          <p className="text-slate-400 text-sm mt-0.5">{cases.length} case creati</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuovo case</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      ) : cases.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-12 text-center">
          <Box className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 text-sm">Nessun case creato ancora</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            Crea il primo case
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/case/${c.id}`}
              className="flex items-center gap-4 bg-slate-800 rounded-xl border border-slate-700/50 px-5 py-4 hover:bg-slate-700/50 transition group"
            >
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Box className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition truncate">
                  {c.name}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                  {c.description && <span className="truncate max-w-xs">{c.description}</span>}
                  <span>{c.case_items?.[0]?.count ?? 0} item</span>
                  <span>{format(new Date(c.created_at), 'd MMM yyyy', { locale: it })}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
              <h2 className="text-base font-semibold text-white">Nuovo case</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome case *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Es. Case telecamere"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Descrizione</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Descrizione del contenuto del case…"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                />
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">
                  Annulla
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Crea case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
