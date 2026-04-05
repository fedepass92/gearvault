'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { getSupabase } from '@/lib/supabase'
import {
  Camera, LayoutDashboard, Package, Tag, Briefcase, FileText,
  Users, LogOut, Menu, X, Box, History, Layers, Settings, Loader2,
  Search, Wrench, BarChart2, Moon, Sun, Plus, Upload, Eye, EyeOff,
  Calendar, ChevronRight,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import CommandPalette from '@/components/CommandPalette'
import { toast } from 'sonner'

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    id: 'main',
    label: null, // no section label for top items
    items: [
      { href: '/',           icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/calendario', icon: Calendar,         label: 'Calendario' },
    ],
  },
  {
    id: 'attrezzatura',
    label: 'Attrezzatura',
    items: [
      { href: '/inventario', icon: Package, label: 'Inventario' },
      { href: '/case',       icon: Box,     label: 'Case' },
      { href: '/kit',        icon: Layers,  label: 'Kit' },
    ],
  },
  {
    id: 'set',
    label: 'Set',
    items: [
      { href: '/set',     icon: Briefcase, label: 'Set Manager',      badgeKey: 'overdueSets' },
      { href: '/storico', icon: History,   label: 'Storico movimenti' },
    ],
  },
  {
    id: 'documenti',
    label: 'Documenti',
    items: [
      { href: '/etichette', icon: Tag,      label: 'Etichette' },
      { href: '/report',    icon: FileText, label: 'Report Assicurativo' },
    ],
  },
  {
    id: 'analisi',
    label: 'Analisi',
    items: [
      { href: '/statistiche', icon: BarChart2, label: 'Statistiche' },
      { href: '/manutenzione',icon: Wrench,    label: 'Manutenzione', badgeKey: 'maintenance' },
    ],
  },
]

const NAV_ADMIN = [
  { href: '/utenti',       icon: Users,    label: 'Utenti' },
  { href: '/impostazioni', icon: Settings, label: 'Impostazioni' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar({ user, profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState(profile?.full_name || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [badges, setBadges] = useState({ maintenance: 0, overdueSets: 0 })
  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef(null)
  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    async function fetchBadges() {
      const supabase = getSupabase()
      const today = new Date().toISOString().slice(0, 10)
      const [{ data: equipment }, { data: overdue }] = await Promise.all([
        supabase.from('equipment').select('last_checked_at').neq('condition', 'retired'),
        supabase.from('sets').select('id', { count: 'exact', head: false })
          .eq('status', 'out').lt('job_date', today),
      ])
      const maintenanceCount = (equipment || []).filter((e) => {
        if (!e.last_checked_at) return true
        return Math.floor((Date.now() - new Date(e.last_checked_at).getTime()) / 86400000) > 90
      }).length
      setBadges({ maintenance: maintenanceCount, overdueSets: (overdue || []).length })
    }
    fetchBadges()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function handleLogout() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Seleziona un file immagine'); return }
    setAvatarUploading(true)
    const supabase = getSupabase()
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { toast.error('Errore upload avatar'); setAvatarUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
    setAvatarUrl(url)
    setAvatarUploading(false)
    toast.success('Avatar aggiornato')
    router.refresh()
  }

  async function handleProfileSave() {
    if (!profileName.trim()) { setProfileError('Il nome non può essere vuoto'); return }
    setProfileSaving(true)
    setProfileError('')
    const supabase = getSupabase()
    const { error } = await supabase.from('profiles').update({ full_name: profileName.trim() }).eq('id', user.id)
    setProfileSaving(false)
    if (error) { setProfileError('Errore nel salvataggio'); return }
    setProfileOpen(false)
    toast.success('Profilo aggiornato')
    router.refresh()
  }

  async function handlePasswordSave() {
    if (!newPassword) return
    if (newPassword.length < 6) { toast.error('Password minimo 6 caratteri'); return }
    if (newPassword !== confirmPassword) { toast.error('Le password non coincidono'); return }
    setPwdSaving(true)
    const supabase = getSupabase()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwdSaving(false)
    if (error) { toast.error('Errore nel cambio password'); return }
    setNewPassword(''); setConfirmPassword('')
    toast.success('Password aggiornata')
  }

  function openProfile() {
    setProfileName(profile?.full_name || '')
    setProfileError('')
    setNewPassword('')
    setConfirmPassword('')
    setProfileOpen(true)
  }

  // ── NavLink ──────────────────────────────────────────────────────────────────
  const NavLink = ({ item }) => {
    const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
    const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
          active
            ? 'bg-primary text-primary-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {badgeCount > 0 && (
          <span className={`flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1 ${
            active ? 'bg-white/20 text-white' : 'bg-destructive text-white'
          }`}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </Link>
    )
  }

  // ── Sidebar content ───────────────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">

      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-foreground">
          <Camera className="w-3.5 h-3.5 text-background" />
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground">GearVault</span>
      </div>

      {/* Quick search */}
      <div className="px-3 py-3 border-b border-sidebar-border flex-shrink-0">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Quick Search
          <kbd className="ml-auto hidden sm:inline-flex items-center text-[10px] opacity-60 font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id}>
            {section.label && (
              <p className="px-2 pb-1.5 text-[10px] font-semibold text-sidebar-muted uppercase tracking-widest">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <div>
            <div className="flex items-center gap-2 px-2 pb-1.5">
              <div className="flex-1 h-px bg-sidebar-border" />
              <p className="text-[10px] font-semibold text-sidebar-muted uppercase tracking-widest whitespace-nowrap">
                Admin
              </p>
              <div className="flex-1 h-px bg-sidebar-border" />
            </div>
            <div className="space-y-0.5">
              {NAV_ADMIN.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom: theme + logout */}
      <div className="px-3 py-2 border-t border-sidebar-border space-y-0.5 flex-shrink-0">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Esci</span>
        </button>
      </div>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-sidebar-border flex-shrink-0">
        <button
          onClick={openProfile}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent transition group"
        >
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border border-border overflow-hidden">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="avatar" width={28} height={28} className="object-cover w-full h-full" />
            ) : (
              <span className="text-xs font-semibold text-foreground">
                {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs font-medium truncate text-sidebar-foreground">
              {profile?.full_name || user?.email?.split('@')[0] || 'Utente'}
            </div>
            <div className="text-[10px] truncate text-sidebar-muted">{user?.email}</div>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
            isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {isAdmin ? 'Admin' : 'Op'}
          </span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 h-screen sticky top-0 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar border-b border-sidebar-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-foreground">
            <Camera className="w-3 h-3 text-background" />
          </div>
          <span className="text-sm font-semibold">GearVault</span>
        </div>
        <button onClick={() => setSearchOpen(true)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition">
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full shadow-2xl">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition z-10">
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Command palette */}
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Profile modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Profilo</DialogTitle></DialogHeader>
          <div className="space-y-5 py-1">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-20 h-20 rounded-full bg-muted border-2 border-border overflow-hidden cursor-pointer group" onClick={() => avatarInputRef.current?.click()}>
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="avatar" fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  {avatarUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
                </div>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <p className="text-xs text-muted-foreground">Clicca per cambiare foto</p>
            </div>

            <Separator />

            {/* Info */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="bg-muted/50 h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Mario Rossi" className="h-8 text-sm" onKeyDown={(e) => e.key === 'Enter' && handleProfileSave()} />
              </div>
              <div className="space-y-1.5">
                <Label>Ruolo</Label>
                <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {isAdmin ? 'Amministratore' : 'Operatore'}
                </div>
              </div>
              {profileError && <p className="text-xs text-destructive">{profileError}</p>}
              <div className="flex justify-end">
                <Button size="sm" onClick={handleProfileSave} disabled={profileSaving}>
                  {profileSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Salva nome
                </Button>
              </div>
            </div>

            <Separator />

            {/* Password */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cambia password</p>
              <div className="space-y-1.5">
                <Label>Nuova password</Label>
                <div className="relative">
                  <Input type={showNewPwd ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimo 6 caratteri" className="h-8 text-sm pr-8" />
                  <button type="button" onClick={() => setShowNewPwd((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Conferma password</Label>
                <div className="relative">
                  <Input type={showConfirmPwd ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ripeti la nuova password" className="h-8 text-sm pr-8" />
                  <button type="button" onClick={() => setShowConfirmPwd((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirmPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={handlePasswordSave} disabled={pwdSaving || !newPassword}>
                  {pwdSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Aggiorna password
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setProfileOpen(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
