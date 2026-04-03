'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { Plus, Briefcase, MapPin, Calendar, Loader2, ChevronRight, X } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const STATUS_STYLES = {
  planned: 'bg-slate-700 text-slate-300',
  out: 'bg-amber-500/20 text-amber-300',
  returned: 'bg-emerald-500/20 text-emerald-300',
  incomplete: 'bg-red-500/20 text-red-300',
}
const STATUS_LABELS = {
  planned: 'Pianificato',
  out: 'In uscita',
  returned: 'Rientrato',
  incomplete: 'Incompleto',
}

const EMPTY_SET = { name: '', job_date: '', location: '', notes: '', status: 'planned' }

export default function SetPage() {
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_SET)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSets()
  }, [])

  async function fetchSets() {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('sets')
      .select('*, set_items(count)')
      .order('created_at', { ascending: false })
    setSets(data || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = getSupabase()
    const { error: err } = await supabase.from('sets').insert({
      name: form.name,
      job_date: form.job_date || null,
      location: form.location || null,
      notes: form.notes || null,
      status: 'planned',
    })
    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      setShowModal(false)
      setForm(EMPTY_SET)
      fetchSets()
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Set Manager</h1>
          <p className="text-slate-400 text-sm mt-0.5">{sets.length} set creati</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuovo set</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      ) : sets.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-12 text-center">
          <Briefcase className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 text-sm">Nessun set creato ancora</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            Crea il primo set
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sets.map((set) => (
            <Link
              key={set.id}
              href={`/set/${set.id}`}
              className="flex items-center gap-4 bg-slate-800 rounded-xl border border-slate-700/50 px-5 py-4 hover:bg-slate-700/50 transition group"
            >
              <div className="p-2.5 rounded-xl bg-slate-700/50">
                <Briefcase className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white group-hover:text-blue-300 transition truncate">
                    {set.name}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[set.status] || 'bg-slate-700 text-slate-300'}`}>
                    {STATUS_LABELS[set.status] || set.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                  {set.job_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(set.job_date), 'd MMM yyyy', { locale: it })}
                    </span>
                  )}
                  {set.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {set.location}
                    </span>
                  )}
                  <span>{set.set_items?.[0]?.count ?? 0} item</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* New Set Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
              <h2 className="text-base font-semibold text-white">Nuovo set</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome set *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Es. Shooting Milano 2024"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Data lavoro</label>
                  <input
                    type="date"
                    value={form.job_date}
                    onChange={(e) => setForm((f) => ({ ...f, job_date: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="Es. Studio Roma"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Note</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Note sul set…"
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
                  Crea set
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
