'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  Camera,
  LayoutDashboard,
  Package,
  Tag,
  Briefcase,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Box,
  History,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/inventario', icon: Package, label: 'Inventario' },
  { href: '/set', icon: Briefcase, label: 'Set Manager' },
  { href: '/case', icon: Box, label: 'Case / Kit' },
  { href: '/etichette', icon: Tag, label: 'Etichette' },
  { href: '/report', icon: FileText, label: 'Report Assicurativo' },
  { href: '/storico', icon: History, label: 'Storico movimenti' },
  { href: '/utenti', icon: Users, label: 'Utenti', adminOnly: true },
]

export default function Sidebar({ user, profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isAdmin = profile?.role === 'admin'

  async function handleLogout() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const NavLink = ({ item }) => {
    if (item.adminOnly && !isAdmin) return null
    const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
          active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }`}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span>{item.label}</span>
        {active && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
      </Link>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
          <Camera className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-white leading-tight">GearVault</div>
          <div className="text-xs text-slate-500 leading-tight">Brain Digital</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-700/50 px-3 py-4">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-slate-300">
              {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">
              {profile?.full_name || user?.email?.split('@')[0] || 'Utente'}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                isAdmin ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-400'
              }`}>
                {isAdmin ? 'Admin' : 'Operatore'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 transition"
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
      <aside className="hidden lg:flex flex-col w-56 bg-slate-800 border-r border-slate-700/50 h-screen sticky top-0 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-800 border-b border-slate-700/50 flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-bold text-white">GearVault</span>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-slate-800 h-full shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
