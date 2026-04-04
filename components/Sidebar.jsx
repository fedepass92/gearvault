'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  Camera, LayoutDashboard, Package, Tag, Briefcase, FileText,
  Users, LogOut, Menu, X, ChevronRight, Box, History, Layers, Settings, Loader2, Search, Wrench, BarChart2,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CommandPalette from '@/components/CommandPalette'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/inventario', icon: Package, label: 'Inventario' },
  { href: '/set', icon: Briefcase, label: 'Set Manager', badgeKey: 'overdueSets' },
  { href: '/case', icon: Box, label: 'Case' },
  { href: '/kit', icon: Layers, label: 'Kit' },
  { href: '/etichette', icon: Tag, label: 'Etichette' },
  { href: '/report', icon: FileText, label: 'Report Assicurativo' },
  { href: '/storico', icon: History, label: 'Storico movimenti' },
  { href: '/manutenzione', icon: Wrench, label: 'Manutenzione', badgeKey: 'maintenance' },
  { href: '/statistiche', icon: BarChart2, label: 'Statistiche' },
  { href: '/utenti', icon: Users, label: 'Utenti', adminOnly: true },
]

export default function Sidebar({ user, profile }) {
  const pathname = usePathname()
  const router = useRouter()
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
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
          active
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
        <span className="flex-1">{item.label}</span>
        {badgeCount > 0 && !active && (
          <span className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
        {active && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
      </Link>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary shadow-lg shadow-primary/30">
          <Camera className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <div className="text-sm font-bold leading-tight">GearVault</div>
          <div className="text-xs text-muted-foreground leading-tight">Brain Digital</div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition border border-border/60"
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 text-left text-xs">Cerca…</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-border px-3 py-4">
        <button
          onClick={() => { setProfileName(profile?.full_name || ''); setProfileError(''); setProfileOpen(true) }}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition group"
        >
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">
              {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs font-medium truncate">
              {profile?.full_name || user?.email?.split('@')[0] || 'Utente'}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                isAdmin ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {isAdmin ? 'Admin' : 'Operatore'}
              </span>
            </div>
          </div>
          <Settings className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
        </button>
        <button
          onClick={handleLogout}
          className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Esci</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-card border-r border-border h-screen sticky top-0 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Camera className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold">GearVault</span>
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-card h-full shadow-2xl border-r border-border">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <X className="w-5 h-5" />
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
                isAdmin ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {isAdmin ? 'Amministratore' : 'Operatore'}
              </div>
            </div>
            {profileError && <p className="text-xs text-red-400">{profileError}</p>}
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
