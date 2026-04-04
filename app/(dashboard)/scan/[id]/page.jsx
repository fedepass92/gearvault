import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createServerSupabase } from '@/lib/supabase-server'
import { differenceInDays } from 'date-fns'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  ArrowLeft, Battery, BatteryLow, BatteryCharging, Minus,
  MapPin, Tag, Wrench, Briefcase, Box, Layers, AlertTriangle,
  CheckCircle2, Clock, ArrowUpRight, RotateCcw,
} from 'lucide-react'
import MarkCheckedButton from '@/components/MarkCheckedButton'
import MarkRepairedButton from '@/components/MarkRepairedButton'
import MarkForRepairButton from '@/components/MarkForRepairButton'
import QuickNote from '@/components/QuickNote'
import QuickLocation from '@/components/QuickLocation'
import QuickAddToSet from '@/components/QuickAddToSet'
import QuickPrintLabel from '@/components/QuickPrintLabel'

const CATEGORY_LABELS = {
  camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
  lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
}
const CONDITION_LABELS = { active: 'Attivo', repair: 'In riparazione', retired: 'Ritirato' }
const CONDITION_STYLES = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  repair: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  retired: 'bg-red-500/15 text-red-400 border-red-500/30',
}
const LOCATION_LABELS = { studio: 'Studio', campo: 'Campo', prestito: 'In prestito' }
const BATTERY_ICON = { charged: Battery, charging: BatteryCharging, low: BatteryLow, na: Minus }
const BATTERY_COLOR = { charged: 'text-emerald-400', charging: 'text-primary', low: 'text-red-400', na: 'text-muted-foreground' }
const BATTERY_LABELS = { charged: 'Carica', charging: 'In carica', low: 'Scarica', na: 'N/D' }

function calcDepreciation(item) {
  if (!item.useful_life_years || !item.purchase_date || !item.purchase_price) return null
  const yearsElapsed = differenceInDays(new Date(), new Date(item.purchase_date)) / 365
  const pct = Math.min(100, (yearsElapsed / item.useful_life_years) * 100)
  const residual = parseFloat(item.purchase_price) * Math.max(0, 1 - yearsElapsed / item.useful_life_years)
  return { pct: Math.round(pct), residual }
}

export default async function ScanEquipmentPage({ params }) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: item } = await supabase
    .from('equipment')
    .select('*')
    .eq('id', id)
    .single()

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-10 h-10 text-muted-foreground opacity-40 mb-3" />
        <p className="text-muted-foreground text-sm">Attrezzatura non trovata</p>
        <Link href="/inventario" className="text-primary text-sm mt-4 hover:underline">← Inventario</Link>
      </div>
    )
  }

  // Fetch current assignments + movement history in parallel
  const [{ data: setItems }, { data: kitItems }, { data: caseItems }, { data: movements }] = await Promise.all([
    supabase.from('set_items')
      .select('status, sets(id, name, status, job_date)')
      .eq('equipment_id', id)
      .neq('status', 'returned')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase.from('kit_items')
      .select('kits(id, name)')
      .eq('equipment_id', id),
    supabase.from('case_items')
      .select('cases(id, name)')
      .eq('equipment_id', id),
    supabase.from('movement_log')
      .select('id, action, created_at, sets(id, name), profiles(full_name)')
      .eq('equipment_id', id)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const depr = calcDepreciation(item)
  const daysSinceCheck = item.last_checked_at
    ? differenceInDays(new Date(), new Date(item.last_checked_at))
    : null
  const needsMaintenance = daysSinceCheck === null || daysSinceCheck > 90
  const BattIcon = BATTERY_ICON[item.battery_status] || Minus

  const SET_STATUS_STYLES = {
    planned: 'bg-muted text-muted-foreground',
    out: 'bg-amber-500/20 text-amber-300',
    returned: 'bg-emerald-500/20 text-emerald-300',
    incomplete: 'bg-red-500/20 text-red-300',
  }
  const SET_STATUS_LABELS = { planned: 'Pianificato', out: 'In uscita', returned: 'Rientrato', incomplete: 'Incompleto' }

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/inventario" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate">{item.name}</h1>
          {(item.brand || item.model) && (
            <p className="text-xs text-muted-foreground truncate">{[item.brand, item.model].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        {item.condition && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${CONDITION_STYLES[item.condition] || 'bg-muted text-muted-foreground border-border'}`}>
            {CONDITION_LABELS[item.condition] || item.condition}
          </span>
        )}
      </div>

      {/* Photo */}
      {item.photo_url && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border bg-muted">
          <Image src={item.photo_url} alt={item.name} fill className="object-contain" />
        </div>
      )}

      {/* Maintenance alert */}
      {needsMaintenance && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            {daysSinceCheck === null
              ? 'Nessun controllo registrato'
              : `Ultimo controllo ${daysSinceCheck} giorni fa`}
          </p>
        </div>
      )}

      {/* Info card */}
      <div className="bg-card rounded-xl border border-border divide-y divide-border/50">
        {item.serial_number && (
          <Row label="Seriale" value={<span className="font-mono text-xs">{item.serial_number}</span>} />
        )}
        {item.category && (
          <Row label="Categoria" value={CATEGORY_LABELS[item.category] || item.category} icon={<Tag className="w-3.5 h-3.5" />} />
        )}
        {item.location && (
          <Row label="Location" value={LOCATION_LABELS[item.location] || item.location} icon={<MapPin className="w-3.5 h-3.5" />} />
        )}
        {item.battery_status && item.battery_status !== 'na' && (
          <Row
            label="Batteria"
            value={
              <span className={`flex items-center gap-1.5 ${BATTERY_COLOR[item.battery_status]}`}>
                <BattIcon className="w-3.5 h-3.5" />
                {BATTERY_LABELS[item.battery_status]}
              </span>
            }
          />
        )}
        {item.last_checked_at && (
          <Row
            label="Ultimo controllo"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            value={
              <span className={needsMaintenance ? 'text-red-400' : 'text-emerald-400'}>
                {format(new Date(item.last_checked_at), 'd MMM yyyy', { locale: it })}
              </span>
            }
          />
        )}
        {item.purchase_date && (
          <Row label="Acquistato" icon={<Clock className="w-3.5 h-3.5" />} value={format(new Date(item.purchase_date), 'd MMM yyyy', { locale: it })} />
        )}
      </div>

      {/* Depreciation */}
      {depr && (
        <div className="bg-card rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Ammortamento</span>
            <span className="text-xs font-semibold">{depr.pct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all ${depr.pct > 80 ? 'bg-red-400' : depr.pct > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${depr.pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Valore residuo: <span className="text-foreground font-medium">€ {depr.residual.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </p>
        </div>
      )}

      {/* Assignments */}
      {(setItems?.length > 0 || kitItems?.length > 0 || caseItems?.length > 0) && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assegnazioni attive</h2>
          </div>
          <div className="divide-y divide-border/50">
            {setItems?.map((si, i) => (
              <Link key={i} href={`/set/${si.sets?.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition group">
                <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium group-hover:text-primary transition truncate">{si.sets?.name}</div>
                  {si.sets?.job_date && (
                    <div className="text-xs text-muted-foreground">{format(new Date(si.sets.job_date), 'd MMM yyyy', { locale: it })}</div>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${SET_STATUS_STYLES[si.sets?.status] || 'bg-muted text-muted-foreground'}`}>
                  {SET_STATUS_LABELS[si.sets?.status] || si.sets?.status}
                </span>
              </Link>
            ))}
            {kitItems?.map((ki, i) => (
              <Link key={i} href={`/kit/${ki.kits?.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition group">
                <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm font-medium group-hover:text-primary transition truncate">{ki.kits?.name}</div>
              </Link>
            ))}
            {caseItems?.map((ci, i) => (
              <Link key={i} href={`/case/${ci.cases?.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition group">
                <Box className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm font-medium group-hover:text-primary transition truncate">{ci.cases?.name}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div className="bg-card rounded-xl border border-border px-4 py-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Note</h2>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{item.notes}</p>
        </div>
      )}

      {/* Movement history */}
      {movements && movements.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Storico movimenti</h2>
          </div>
          <div className="divide-y divide-border/50">
            {movements.map((m) => {
              const isOut = m.action === 'checkout'
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${isOut ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {isOut ? <ArrowUpRight className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{m.sets?.name || '—'}</div>
                    {m.profiles?.full_name && (
                      <div className="text-xs text-muted-foreground truncate">{m.profiles.full_name}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-muted-foreground">{format(new Date(m.created_at), 'd MMM', { locale: it })}</div>
                    <div className="text-xs text-muted-foreground/60">{format(new Date(m.created_at), 'HH:mm')}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Repair card */}
      {item.condition === 'repair' && (
        <MarkRepairedButton equipmentId={item.id} />
      )}
      {item.condition === 'active' && (
        <MarkForRepairButton equipmentId={item.id} />
      )}

      {/* Quick location */}
      <QuickLocation equipmentId={item.id} currentLocation={item.location} />

      {/* Add to set */}
      <QuickAddToSet
        equipmentId={item.id}
        currentSetIds={(setItems || []).map((si) => si.sets?.id).filter(Boolean)}
      />

      {/* Quick note */}
      <QuickNote equipmentId={item.id} currentNotes={item.notes} />

      {/* Mark checked */}
      <MarkCheckedButton equipmentId={item.id} currentCheckedAt={item.last_checked_at} />

      {/* Print label */}
      <QuickPrintLabel item={item} />

      {/* Footer link */}
      <div className="text-center pb-4">
        <Link href={`/inventario`} className="text-xs text-muted-foreground hover:text-primary transition">
          Apri inventario completo →
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value, icon }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-4">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
        {icon}
        {label}
      </span>
      <span className="text-xs font-medium text-right">{value}</span>
    </div>
  )
}
