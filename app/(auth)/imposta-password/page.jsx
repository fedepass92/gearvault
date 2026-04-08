'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Inline Brain Digital logo SVG
function BrainLogo({ width = 120 }) {
  return (
    <svg width={width} viewBox="0 0 723.29 271.79" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <g fill="#ffffff">
        <polygon points="16.75 238.09 16.75 256.69 33.22 256.69 35.34 254.61 35.34 240.22 33.22 238.09 16.75 238.09"/>
        <rect x="568.6" y="238.09" width="18.55" height="6.18"/>
        <path d="M0,223.49v48.3h723.29v-48.3H0ZM41.48,256.64l-6.18,6.18H10.56v-30.91h24.73l6.18,6.18v18.55ZM137.02,262.82h-6.18v-30.91h6.18v30.91ZM257.27,238.09h-24.73v18.55h18.55v-6.18h-12.36v-6.18h18.55v18.55h-30.91v-30.91h30.91v6.18ZM352.81,262.82h-6.18v-30.91h6.18v30.91ZM473.06,238.09h-12.36v24.73h-6.18v-24.73h-12.36v-6.18h30.91v6.18ZM593.33,262.82h-6.18v-12.36h-18.55v12.36h-6.18v-30.91h30.91v30.91ZM713.6,262.82h-30.91v-30.91h6.18v24.73h24.73v6.18Z"/>
        <path d="M89.49,0c13.11,0,24.3,4.63,33.57,13.9s13.9,20.46,13.9,33.57v16.01c0,13.11-4.63,24.3-13.9,33.57-.94.94-1.87,1.78-2.81,2.53v.14c2.71,1.78,5.29,3.84,7.72,6.18,9.27,9.18,13.9,20.46,13.9,33.85v23.46c0,13.11-4.63,24.3-13.9,33.57-9.27,9.27-20.46,13.9-33.57,13.9H5.08c-3.37,0-5.06-1.69-5.06-5.06V5.06C.02,1.69,1.71,0,5.08,0h84.41ZM50.58,45.51v35.39c0,2.25,1.12,3.37,3.37,3.37h22.61c6.55,0,9.83-3.28,9.83-9.83v-22.47c0-6.55-3.28-9.83-9.83-9.83h-22.61c-2.25,0-3.37,1.12-3.37,3.37ZM50.58,129.78v35.39c0,2.25,1.12,3.37,3.37,3.37h24.02c8.89,0,13.34-3.74,13.34-11.24v-19.66c0-7.49-3.75-11.24-11.24-11.24h-26.12c-2.25,0-3.37,1.12-3.37,3.37Z"/>
        <path d="M287.38,105.2c7.87,8.8,11.8,19.24,11.8,31.32v69.1c0,3.37-1.69,5.06-5.06,5.06h-41.15c-3.37,0-5.06-1.69-5.06-5.06v-67.98c0-7.49-3.75-11.24-11.24-11.24h-20.37c-1.87,0-2.81,1.12-2.81,3.37v75.84c0,3.37-1.69,5.06-5.06,5.06h-40.45c-3.37,0-5.06-1.69-5.06-5.06V5.06c0-3.37,1.69-5.06,5.06-5.06h83.01c13.11,0,24.3,4.63,33.57,13.9,9.27,9.27,13.9,20.46,13.9,33.57v26.97c0,11.7-3.7,21.91-11.1,30.62v.14ZM213.51,45.51v35.39c0,2.25,1.12,3.37,3.37,3.37h21.21c6.55,0,9.83-3.28,9.83-9.83v-22.47c0-6.55-3.28-9.83-9.83-9.83h-21.21c-2.25,0-3.37,1.12-3.37,3.37Z"/>
        <path d="M375.72,160.81l-7.16,44.8c-.56,3.37-2.53,5.06-5.9,5.06h-42.28c-2.81,0-4.21-1.17-4.21-3.51,0-.47.05-.98.14-1.54L354.8,5.06c.65-3.37,2.67-5.06,6.04-5.06h67.7c3.37,0,5.38,1.69,6.04,5.06l38.48,200.56c.09.56.14,1.08.14,1.54,0,2.34-1.4,3.51-4.21,3.51h-42.28c-3.37,0-5.34-1.69-5.9-5.06l-7.16-44.8h-37.92ZM394.69,45.22l-12.64,76.97h25.28l-12.64-76.97Z"/>
        <path d="M540.75,205.62c0,3.37-1.64,5.06-4.92,5.06h-40.59c-3.37,0-5.06-1.69-5.06-5.06V5.06c0-3.37,1.69-5.06,5.06-5.06h40.59c3.28,0,4.92,1.69,4.92,5.06v200.56Z"/>
        <path d="M672.63,125.56V5.06c0-3.37,1.69-5.06,5.06-5.06h40.59c3.28,0,4.92,1.69,4.92,5.06v200.56c0,3.37-1.64,5.06-4.92,5.06h-58.15c-3.37,0-5.62-1.69-6.74-5.06l-41.01-121.35v121.35c0,3.37-1.64,5.06-4.92,5.06h-40.59c-3.37,0-5.06-1.69-5.06-5.06V5.06c0-3.37,1.69-5.06,5.06-5.06h58.43c3.37,0,5.62,1.69,6.74,5.06l40.59,120.51Z"/>
      </g>
    </svg>
  )
}

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

    // onAuthStateChange picks up the recovery token from the URL hash automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAuthUser(session.user)
        // Pre-fill name from profile if it exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .single()
        setFullName(profile?.full_name || '')
        setLoading(false)
      }
    })

    // Also try existing session (e.g. user reloads the page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user)
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setFullName(profile?.full_name || '')
            setLoading(false)
          })
      } else {
        // No session yet — try to extract tokens from URL hash manually
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          }).then(({ data, error: sessionErr }) => {
            if (data?.session?.user) {
              setAuthUser(data.session.user)
              supabase
                .from('profiles')
                .select('full_name')
                .eq('id', data.session.user.id)
                .single()
                .then(({ data: profile }) => {
                  setFullName(profile?.full_name || '')
                  setLoading(false)
                })
            } else {
              console.warn('[imposta-password] setSession failed:', sessionErr)
              setLoading(false)
            }
          })
        } else {
          // No token in hash either — wait for onAuthStateChange, then timeout
          setTimeout(() => setLoading(false), 5000)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!password) { setError('Inserisci una password'); return }
    if (password.length < 8) { setError('La password deve essere di almeno 8 caratteri'); return }
    if (password !== confirmPassword) { setError('Le password non coincidono'); return }

    setSaving(true)
    const supabase = getSupabase()

    // Set password
    const { error: pwdError } = await supabase.auth.updateUser({ password })
    if (pwdError) {
      setError(pwdError.message)
      setSaving(false)
      return
    }

    // Save full name on profile
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f172a' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <BrainLogo width={140} />
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 32 }}>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#2563eb' }} />
              <p style={{ color: '#94a3b8', fontSize: 14 }}>Verifica del link in corso…</p>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-10 h-10" style={{ color: '#10b981' }} />
              <p style={{ color: '#ffffff', fontWeight: 700, fontSize: 18 }}>Password impostata!</p>
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Accesso in corso…</p>
            </div>
          ) : !authUser ? (
            <div className="text-center py-6">
              <p style={{ color: '#f87171', fontSize: 14 }}>
                Link non valido o scaduto. Contatta un amministratore per ricevere un nuovo invito.
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ color: '#ffffff', fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>
                  Imposta la tua password
                </h1>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                  Benvenuto in GearVault. Completa il tuo profilo per accedere.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Email — read only */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={authUser.email || ''}
                    disabled
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#64748b', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>

                {/* Full name */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Mario Rossi"
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#ffffff', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                    onFocus={(e) => { e.target.style.borderColor = '#2563eb' }}
                    onBlur={(e) => { e.target.style.borderColor = '#334155' }}
                  />
                </div>

                {/* Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Nuova password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Minimo 8 caratteri"
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 40px 8px 12px', color: '#ffffff', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                      onFocus={(e) => { e.target.style.borderColor = '#2563eb' }}
                      onBlur={(e) => { e.target.style.borderColor = '#334155' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Conferma password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Ripeti la password"
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 40px 8px 12px', color: '#ffffff', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                      onFocus={(e) => { e.target.style.borderColor = '#2563eb' }}
                      onBlur={(e) => { e.target.style.borderColor = '#334155' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ background: '#ef444420', border: '1px solid #ef444440', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    width: '100%',
                    background: saving ? '#1d4ed8' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                  {saving ? 'Salvataggio…' : 'Accedi a GearVault →'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#334155', marginTop: 20 }}>
          GearVault · Brain Digital
        </p>
      </div>
    </div>
  )
}
