'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CompanyLogo from '@/components/CompanyLogo'

export default function ImpostaPasswordPage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = getSupabase()
    let cancelled = false

    async function loadProfile(client, user) {
      setAuthUser(user)
      const { data: profile } = await client
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      if (!cancelled) {
        setFullName(profile?.full_name || '')
        setLoading(false)
      }
    }

    async function init() {
      // 1. Try existing session first (page reload case)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user && !cancelled) {
        await loadProfile(supabase, session.user)
        return
      }

      // 2. Extract token from URL hash (invite link case)
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken && !cancelled) {
        const { data } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        })
        if (data?.session?.user && !cancelled) {
          await loadProfile(supabase, data.session.user)
          return
        }
      }

      // 3. Nothing worked — show error after short delay
      if (!cancelled) {
        setTimeout(() => { if (!cancelled) setLoading(false) }, 3000)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!password) { setError('Inserisci una password'); return }
    if (password.length < 8) { setError('La password deve essere di almeno 8 caratteri'); return }
    if (password !== confirmPassword) { setError('Le password non coincidono'); return }

    setSaving(true)
    const supabase = getSupabase()

    // Set password — wrap in timeout to handle cases where the promise never resolves
    let pwdError = null
    try {
      const result = await Promise.race([
        supabase.auth.updateUser({ password }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ])
      pwdError = result.error
    } catch (e) {
      if (e.message !== 'timeout') pwdError = e
    }

    if (pwdError) {
      setError(pwdError.message)
      setSaving(false)
      return
    }

    // Save full name on profile (do not touch role — it was set by the admin during invite)
    if (fullName.trim()) {
      await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', authUser.id)
    }

    setSaving(false)
    setDone(true)

    setTimeout(() => router.push('/'), 2000)
  }

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4 text-foreground">
            <CompanyLogo variant="light" width={140} />
          </div>
          <p className="text-muted-foreground text-sm mt-1">Gestione Attrezzatura</p>
        </div>

        <div className="bg-card rounded-2xl shadow-2xl border border-border p-8">

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifica del link in corso…</p>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <p className="text-lg font-bold">Password impostata!</p>
              <p className="text-sm text-muted-foreground">Accesso in corso…</p>
            </div>
          ) : !authUser ? (
            <div className="text-center py-6">
              <p className="text-sm text-destructive">
                Link non valido o scaduto. Contatta un amministratore per ricevere un nuovo invito.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Imposta la tua password</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Benvenuto in GearVault. Completa il tuo profilo per accedere.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Email — readonly */}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      value={authUser.email || ''}
                      disabled
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Full name */}
                <div className="space-y-1.5">
                  <Label htmlFor="fullname">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Mario Rossi"
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password">Nuova password</Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Minimo 8 caratteri"
                      className="pl-8 pr-9"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Conferma password</Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Ripeti la password"
                      className="pl-8 pr-9"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={saving} className="w-full mt-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Salvataggio…' : 'Accedi a GearVault →'}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          GearVault v1.0 · Brain Digital © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
