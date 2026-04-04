import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { ArrowLeft, Box, Package, Layers, AlertTriangle } from 'lucide-react'

export default async function ScanCasePage({ params }) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: caseData } = await supabase
    .from('cases')
    .select('*, case_items(*, equipment(*)), case_kits(*, kits(*, kit_items(count)))')
    .eq('id', id)
    .single()

  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-10 h-10 text-muted-foreground opacity-40 mb-3" />
        <p className="text-muted-foreground text-sm">Case non trovato</p>
        <Link href="/case" className="text-primary text-sm mt-4 hover:underline">← Case</Link>
      </div>
    )
  }

  const items = caseData.case_items || []
  const kits = caseData.case_kits || []

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/case" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-primary flex-shrink-0" />
            <h1 className="text-base font-bold truncate">{caseData.name}</h1>
          </div>
          {caseData.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{caseData.description}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold">{items.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Attrezzature</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold">{kits.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Kit</div>
        </div>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attrezzatura</h2>
          </div>
          <div className="divide-y divide-border/50">
            {items.map((ci) => (
              <Link key={ci.id} href={`/scan/${ci.equipment?.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium group-hover:text-primary transition truncate">{ci.equipment?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[ci.equipment?.brand, ci.equipment?.model].filter(Boolean).join(' · ')}
                    {ci.equipment?.serial_number ? ` · S/N: ${ci.equipment.serial_number}` : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Kits */}
      {kits.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kit</h2>
          </div>
          <div className="divide-y divide-border/50">
            {kits.map((ck) => (
              <Link key={ck.id} href={`/kit/${ck.kits?.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition group">
                <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm font-medium group-hover:text-primary transition truncate">{ck.kits?.name}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="text-center pb-4">
        <Link href={`/case/${id}`} className="text-xs text-muted-foreground hover:text-primary transition">
          Apri dettaglio case →
        </Link>
      </div>
    </div>
  )
}
