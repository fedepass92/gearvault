'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { Users, Mail, Loader2, ShieldCheck, Send, Activity } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export default function UtentiPage() {
  const [profiles, setProfiles] = useState([])
  const [activityCounts, setActivityCounts] = useState({})
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

      const [{ data: allProfiles }, { data: movLogs }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at'),
        supabase.from('movement_log').select('user_id'),
      ])
      setProfiles(allProfiles || [])
      const counts = {}
      ;(movLogs || []).forEach((m) => { if (m.user_id) counts[m.user_id] = (counts[m.user_id] || 0) + 1 })
      setActivityCounts(counts)
      setLoading(false)
    }
    init()
  }, [])

  async function changeRole(profileId, newRole) {
    if (profileId === currentUserId) return
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
    const { error } = await supabase.auth.signUp({
      email: inviteEmail,
      password: Math.random().toString(36).slice(-12) + 'Aa1!',
      options: { emailRedirectTo: `${window.location.origin}/login` },
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
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">Accesso riservato agli amministratori</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Utenti</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{profiles.length} utenti registrati</p>
        </div>
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <Send className="w-4 h-4" />
          Invita utente
        </Button>
      </div>

      {inviteSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-300">
          {inviteSuccess}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Utente</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Registrato il</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Attività</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ruolo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-muted/30 transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {(profile.full_name || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">
                          {profile.full_name || 'Utente'}
                          {profile.id === currentUserId && <span className="text-[10px] text-primary ml-2">(tu)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{profile.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-muted-foreground text-xs">
                    {profile.created_at ? format(new Date(profile.created_at), 'd MMM yyyy', { locale: it }) : '—'}
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    {activityCounts[profile.id] > 0 ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Activity className="w-3.5 h-3.5" />
                        {activityCounts[profile.id]} mov.
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {profile.id === currentUserId ? (
                      <span className="flex items-center gap-1.5 text-sm">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-primary font-medium">Admin</span>
                      </span>
                    ) : (
                      <Select value={profile.role} onValueChange={(v) => changeRole(profile.id, v)}>
                        <SelectTrigger className="w-[130px] h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operator">Operatore</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={showInvite} onOpenChange={(o) => { if (!o) { setShowInvite(false); setInviteError('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invita nuovo utente</DialogTitle></DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="utente@braindigital.it"
                  className="pl-8"
                />
              </div>
            </div>
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Annulla</Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                Invita
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
