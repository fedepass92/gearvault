'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { getSupabase } from '@/lib/supabase'
import {
  Camera, LayoutDashboard, Package, Tag, Briefcase, FileText,
  Users, LogOut, Menu, X, Box, History, Layers, Settings, Loader2,
  Search, Wrench, BarChart2, HelpCircle, Moon, Sun, Plus,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CommandPalette from '@/components/CommandPalette'
import { toast } from 'sonner'

const NAV_MAIN = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/inventario', icon: Package, label: 'Inventario' },
  { href: '/set', icon: Briefcase, label: 'Set Manager', badgeKey: 'overdueSets' },
  { href: '/case', icon: Box, label: 'Case' },
  { href: '/kit', icon: Layers, label: 'Kit' },
  { href: '/statistiche', icon: BarChart2, label: 'Statistiche' },
]

const NAV_DOCS = [
  { href: '/etichette', icon: Tag, label: 'Etichette' },
  { href: '/report', icon: FileText, label: 'Report Assicurativo' },
  { href: '/storico', icon: History, label: 'Storico movimenti' },
  { href: '/manutenzione', icon: Wrench, label: 'Manutenzione', badgeKey: 'maintenance' },
]

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
        const days = Math.floor((Date.now() - new Date(e.last_checked_at).getTime()) / 86400000)
        return days > 90
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

  async function handleProfileSave() {
    if (!profileName.trim()) { setProfileError('Il nome non può essere vuoto'); return }
    setProfileSaving(true)
    setProfileError('')
    const supabase = getSupabase()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profileName.trim() })
      .eq('id', user.id)
    setProfileSaving(false)
    if (error) { setProfileError('Errore nel salvataggio'); return }
    setProfileOpen(false)
    toast.success('Profilo aggiornato')
    router.refresh()
  }

  const NavLink = ({ item }) => {
    if (item.adminOnly && !isAdmin) return null
    const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
    const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors group ${
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-foreground">
          <Camera className="w-3.5 h-3.5 text-background" />
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground">GearVault</span>
      </div>

      {/* Quick create + search */}
      <div className="px-3 py-3 space-y-1 border-b border-sidebar-border">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Quick Search
          <kbd className="ml-auto hidden sm:inline-flex items-center text-[10px] opacity-60 font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Nav main */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <div className="space-y-0.5">
          {NAV_MAIN.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        <div>
          <p className="px-2 pb-1 text-xs font-medium text-sidebar-muted uppercase tracking-wider">
            Documenti
          </p>
          <div className="space-y-0.5">
            {NAV_DOCS.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>

        {isAdmin && (
          <div>
            <p className="px-2 pb-1 text-xs font-medium text-sidebar-muted uppercase tracking-wider">
              Admin
            </p>
            <NavLink item={{ href: '/utenti', icon: Users, label: 'Utenti' }} />
          </div>
        )}
      </nav>

      {/* Bottom links */}
      <div className="px-3 py-2 border-t border-sidebar-border space-y-0.5">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}</span>
        </button>
        <button
          onClick={() => { setProfileName(profile?.full_name || ''); setProfileError(''); setProfileOpen(true) }}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <Settings className="w-4 h-4" />
          <span>Impostazioni</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Esci</span>
        </button>
      </div>

      {/* User */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <button
          onClick={() => { setProfileName(profile?.full_name || ''); setProfileError(''); setProfileOpen(true) }}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent transition group"
        >
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border border-border">
            <span className="text-xs font-semibold text-foreground">
              {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs font-medium truncate text-sidebar-foreground">
              {profile?.full_name || user?.email?.split('@')[0] || 'Utente'}
            </div>
            <div className="text-[10px] truncate text-sidebar-muted">
              {user?.email}
            </div>
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
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-foreground">
            <Camera className="w-3 h-3 text-background" />
          </div>
          <span className="text-sm font-semibold">GearVault</span>
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition z-10"
            >
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
          <DialogHeader>
            <DialogTitle>Profilo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={user?.email || ''} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Nome completo</Label>
              <Input
                id="profile-name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Mario Rossi"
                onKeyDown={(e) => e.key === 'Enter' && handleProfileSave()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ruolo</Label>
              <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {isAdmin ? 'Amministratore' : 'Operatore'}
              </div>
            </div>
            {profileError && <p className="text-xs text-destructive">{profileError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)} disabled={profileSaving}>Annulla</Button>
            <Button onClick={handleProfileSave} disabled={profileSaving}>
              {profileSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
