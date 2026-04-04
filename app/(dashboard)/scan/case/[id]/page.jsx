import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import { ArrowLeft, Box, Package, Layers, AlertTriangle, ChevronDown } from 'lucide-react'

export default async function ScanCasePage({ params }) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: caseData } = await supabase
    .from('cases')
    .select('*, case_items(*, equipment(id, name, brand, model, serial_number, category, market_value)), case_kits(*, kits(id, name, kit_items(*, equipment(id, name, brand, model, serial_number, category, market_value))))')
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

  const directValue = items.reduce((s, ci) => s + (parseFloat(ci.equipment?.market_value) || 0), 0)
  const kitsValue = kits.flatMap((ck) => ck.kits?.kit_items || []).reduce((s, ki) => s + (parseFloat(ki.equipment?.market_value) || 0), 0)
  const totalValue = directValue + kitsValue
  const totalItems = items.length + kits.flatMap((ck) => ck.kits?.kit_items || []).length

  const CATEGORY_LABELS = {
    camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
    lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
  }

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
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold">{totalItems}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Item totali</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold">{kits.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Kit</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-sm font-bold">
            {totalValue > 0 ? `€ ${totalValue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}` : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Valore</div>
        </div>
      </div>

      {/* Direct items */}
      {items.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">Attrezzatura diretta</h2>
            <span className="text-xs text-muted-foreground">{items.length}</span>
          </div>
          <div className="divide-y divide-border/50">
            {items.map((ci) => (
              <Link key={ci.id} href={`/scan/${ci.equipment?.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium group-hover:text-primary transition truncate">{ci.equipment?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[ci.equipment?.brand, ci.equipment?.model].filter(Boolean).join(' · ')}
                    {ci.equipment?.serial_number ? ` · ${ci.equipment.serial_number}` : ''}
                  </div>
                </div>
                {ci.equipment?.category && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {CATEGORY_LABELS[ci.equipment.category] || ci.equipment.category}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Kits with expanded contents */}
      {kits.length > 0 && (
        <div className="space-y-3">
          {kits.map((ck) => {
            const kitItems = ck.kits?.kit_items || []
            return (
              <div key={ck.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <Link
                  href={`/kit/${ck.kits?.id}`}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/30 transition group"
                >
                  <Layers className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold group-hover:text-primary transition truncate">{ck.kits?.name}</div>
                    <div className="text-xs text-muted-foreground">{kitItems.length} item</div>
                  </div>
                </Link>
                {kitItems.length > 0 && (
                  <div className="divide-y divide-border/50">
                    {kitItems.map((ki) => (
                      <Link key={ki.id} href={`/scan/${ki.equipment?.id}`} className="flex items-center gap-3 pl-10 pr-4 py-2.5 hover:bg-muted/30 transition group">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium group-hover:text-primary transition truncate">{ki.equipment?.name}</div>
                          {ki.equipment?.serial_number && (
                            <div className="text-[10px] text-muted-foreground font-mono">{ki.equipment.serial_number}</div>
                          )}
                        </div>
                        {ki.equipment?.category && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {CATEGORY_LABELS[ki.equipment.category] || ki.equipment.category}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {items.length === 0 && kits.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <Box className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Case vuoto</p>
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
