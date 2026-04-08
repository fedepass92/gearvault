'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { Users, Mail, Loader2, ShieldCheck, Send, Trash2 } from 'lucide-react'
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
  const [authData, setAuthData] = useState({}) // { userId: { last_sign_in_at, email_confirmed_at } }
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Invite state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('operator')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null) // profile to delete
  const [deleting, setDeleting] = useState(false)

  // Store current user's name for invite emails
  const [myName, setMyName] = useState(null)

  async function fetchUsers(supabase, token) {
    const [{ data: allProfiles }, { data: movLogs }, authUsersRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('movement_log').select('user_id'),
      fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
    ])
    setProfiles(allProfiles || [])
    const counts = {}
    ;(movLogs || []).forEach((m) => { if (m.user_id) counts[m.user_id] = (counts[m.user_id] || 0) + 1 })
    setActivityCounts(counts)
    if (authUsersRes.ok) {
      const authUsers = await authUsersRes.json()
      const map = {}
      authUsers.forEach((u) => { map[u.id] = u })
      setAuthData(map)
    }
  }

  useEffect(() => {
    async function init() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (profile?.role !== 'admin') { setLoading(false); return }
      setIsAdmin(true)
      setMyName(profile?.full_name || null)

      const { data: { session } } = await supabase.auth.getSession()
      await fetchUsers(supabase, session?.access_token || '')
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

    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'invite',
        to: inviteEmail,
        role: inviteRole,
        inviterName: myName,
        loginUrl: `${window.location.origin}/login`,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      setInviteError(json.error || 'Errore durante l\'invito')
      setInviting(false)
      return
    }

    setInviteSuccess(`Invito inviato a ${inviteEmail}`)
    setInviteEmail('')
    setInviteRole('operator')
    setShowInvite(false)
    setInviting(false)

    // Reload user list so the new invite appears immediately
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    await fetchUsers(supabase, session?.access_token || '')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    const res = await fetch('/api/admin/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: deleteTarget.id }),
    })

    if (res.ok) {
      setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    }
    setDeleting(false)
    setDeleteTarget(null)
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
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Stato</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ruolo</th>
                <th className="w-10" />
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
                    {(() => {
                      const auth = authData[profile.id]
                      if (!auth) return <span className="text-xs text-muted-foreground/40">—</span>
                      if (auth.last_sign_in_at) {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Attivo
                          </span>
                        )
                      }
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Invitato
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-5 py-4">
                    {profile.id === currentUserId ? (
                      <span className="flex items-center gap-1.5 text-sm">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-primary font-medium">Admin</span>
                      </span>
                    ) : (
                      <Select value={profile.role || 'operator'} onValueChange={(v) => changeRole(profile.id, v)}>
                        <SelectTrigger className="w-[130px] h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operator">Operatore</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    {profile.id !== currentUserId && (
                      <button
                        onClick={() => setDeleteTarget(profile)}
                        className="p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition"
                        title="Elimina utente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={(o) => { if (!o) { setShowInvite(false); setInviteError(''); setInviteRole('operator') } }}>
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
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Ruolo</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operatore</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" />
              Elimina utente
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler eliminare{' '}
            <strong className="text-foreground">{deleteTarget?.full_name || deleteTarget?.id}</strong>?
            {' '}Questa azione è irreversibile.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
