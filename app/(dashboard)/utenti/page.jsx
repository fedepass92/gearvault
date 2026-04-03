'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { Users, Mail, Loader2, ShieldCheck, Shield, Send, X, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

export default function UtentiPage() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  useEffect(() => {
    async function init() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { setLoading(false); return }
      setIsAdmin(true)

      // Fetch all profiles — join with auth.users via admin API not available client-side
      // We fetch profiles and use email from auth session for current user
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at')
      setProfiles(allProfiles || [])
      setLoading(false)
    }
    init()
  }, [])

  async function changeRole(profileId, newRole) {
    if (profileId === currentUserId) return // Can't change own role
    const supabase = getSupabase()
    await supabase.from('profiles').update({ role: newRole }).eq('id', profileId)
    setProfiles((prev) => prev.map((p) => p.id === profileId ? { ...p, role: newRole } : p))
  }

  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')

    const supabase = getSupabase()
    // Note: inviteUserByEmail requires admin key, not available client-side.
    // We use signUp with a magic link approach or show instructions.
    // For production, this should be a server action.
    const { error } = await supabase.auth.signUp({
      email: inviteEmail,
      password: Math.random().toString(36).slice(-12) + 'Aa1!', // temp password
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })

    if (error) {
      setInviteError(error.message)
    } else {
      setInviteSuccess(`Invito inviato a ${inviteEmail}`)
      setInviteEmail('')
      setShowInvite(false)
    }
    setInviting(false)
  }

  if (!isAdmin && !loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 text-sm">Accesso riservato agli amministratori</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Utenti</h1>
          <p className="text-slate-400 text-sm mt-0.5">{profiles.length} utenti registrati</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-blue-600/20"
        >
          <Send className="w-4 h-4" />
          Invita utente
        </button>
      </div>

      {inviteSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-300">
          {inviteSuccess}
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Utente</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Registrato il</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Ruolo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-slate-700/20 transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-slate-300">
                          {(profile.full_name || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-white">{profile.full_name || 'Utente'}</div>
                        <div className="text-xs text-slate-500">{profile.id}</div>
                      </div>
                    </div>
                    {profile.id === currentUserId && (
                      <span className="text-[10px] text-blue-400 ml-11">(tu)</span>
                    )}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-slate-400 text-xs">
                    {profile.created_at ? format(new Date(profile.created_at), 'd MMM yyyy', { locale: it }) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {profile.id === currentUserId ? (
                      <span className="flex items-center gap-1.5 text-sm">
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-300 font-medium">Admin</span>
                      </span>
                    ) : (
                      <div className="relative inline-block">
                        <select
                          value={profile.role}
                          onChange={(e) => changeRole(profile.id, e.target.value)}
                          className="appearance-none bg-slate-700 border border-slate-600 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
                        >
                          <option value="admin">Admin</option>
                          <option value="operator">Operatore</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
              <h2 className="text-base font-semibold text-white">Invita nuovo utente</h2>
              <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="utente@braindigital.it"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>
              {inviteError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{inviteError}</div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowInvite(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition">
                  Annulla
                </button>
                <button type="submit" disabled={inviting} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Invita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
