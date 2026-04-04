import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import { ArrowLeft, Layers, Package, AlertTriangle, Battery, BatteryLow, BatteryCharging, Minus } from 'lucide-react'

const CATEGORY_LABELS = {
  camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
  lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
}

const BATTERY_ICON = { charged: Battery, charging: BatteryCharging, low: BatteryLow, na: Minus }
const BATTERY_COLOR = { charged: 'text-emerald-400', charging: 'text-primary', low: 'text-red-400', na: 'text-muted-foreground' }

export default async function ScanKitPage({ params }) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: kit } = await supabase
    .from('kits')
    .select('*, kit_items(*, equipment(id, name, brand, model, serial_number, category, market_value, battery_status, condition))')
    .eq('id', id)
    .single()

  if (!kit) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-10 h-10 text-muted-foreground opacity-40 mb-3" />
        <p className="text-muted-foreground text-sm">Kit non trovato</p>
        <Link href="/kit" className="text-primary text-sm mt-4 hover:underline">← Kit</Link>
      </div>
    )
  }

  const items = kit.kit_items || []
  const totalValue = items.reduce((s, ki) => s + (parseFloat(ki.equipment?.market_value) || 0), 0)
  const lowBattery = items.filter((ki) => ki.equipment?.battery_status === 'low').length
  const inRepair = items.filter((ki) => ki.equipment?.condition === 'repair').length

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/kit" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <h1 className="text-base font-bold truncate">{kit.name}</h1>
          </div>
          {kit.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{kit.description}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold">{items.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Item totali</div>
        </div>
        <div className={`bg-card rounded-xl border p-4 text-center ${lowBattery > 0 ? 'border-red-500/30' : 'border-border'}`}>
          <div className={`text-2xl font-bold ${lowBattery > 0 ? 'text-red-400' : ''}`}>{lowBattery}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Batt. scariche</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-sm font-bold">
            {totalValue > 0 ? `€ ${totalValue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}` : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Valore</div>
        </div>
      </div>

      {/* Repair alert */}
      {inRepair > 0 && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">{inRepair} item {inRepair === 1 ? 'è' : 'sono'} in riparazione</p>
        </div>
      )}

      {/* Items list */}
      {items.length > 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">Attrezzatura</h2>
            <span className="text-xs text-muted-foreground">{items.length}</span>
          </div>
          <div className="divide-y divide-border/50">
            {items.map((ki) => {
              const eq = ki.equipment
              const BattIcon = BATTERY_ICON[eq?.battery_status] || Minus
              return (
                <Link
                  key={ki.id}
                  href={`/scan/${eq?.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition group"
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium group-hover:text-primary transition truncate ${eq?.condition === 'repair' ? 'text-amber-400' : ''}`}>
                      {eq?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[eq?.brand, eq?.model].filter(Boolean).join(' · ')}
                      {eq?.serial_number ? ` · ${eq.serial_number}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {eq?.battery_status && eq.battery_status !== 'na' && (
                      <BattIcon className={`w-3.5 h-3.5 ${BATTERY_COLOR[eq.battery_status]}`} />
                    )}
                    {eq?.category && (
                      <span className="text-[10px] text-muted-foreground">
                        {CATEGORY_LABELS[eq.category] || eq.category}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <Layers className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Kit vuoto</p>
        </div>
      )}

      <div className="text-center pb-4">
        <Link href={`/kit/${id}`} className="text-xs text-muted-foreground hover:text-primary transition">
          Apri dettaglio kit →
        </Link>
      </div>
    </div>
  )
}
