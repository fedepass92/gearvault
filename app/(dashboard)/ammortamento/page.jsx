'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { format, differenceInMonths, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { TrendingDown, Loader2, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// Straight-line depreciation
function calcDepreciation(purchasePrice, purchaseDate, yearsLife = 5) {
  if (!purchasePrice || !purchaseDate) return null
  const totalMonths = yearsLife * 12
  const elapsed = Math.max(0, differenceInMonths(new Date(), parseISO(purchaseDate)))
  const monthlyRate = purchasePrice / totalMonths
  const depreciated = Math.min(monthlyRate * elapsed, purchasePrice)
  const currentValue = Math.max(purchasePrice - depreciated, 0)
  const residualPct = (currentValue / purchasePrice) * 100
  return {
    currentValue: Math.round(currentValue * 100) / 100,
    depreciated: Math.round(depreciated * 100) / 100,
    residualPct: Math.round(residualPct),
    elapsed,
    totalMonths,
    yearsLife,
  }
}

// Build monthly value series for chart (last 12 months + future to end of life)
function buildChartData(purchasePrice, purchaseDate, yearsLife = 5) {
  if (!purchasePrice || !purchaseDate) return []
  const start = parseISO(purchaseDate)
  const totalMonths = yearsLife * 12
  const points = []
  for (let m = 0; m <= totalMonths; m += Math.max(1, Math.floor(totalMonths / 24))) {
    const d = new Date(start)
    d.setMonth(d.getMonth() + m)
    const val = Math.max(purchasePrice - (purchasePrice / totalMonths) * m, 0)
    points.push({
      label: format(d, 'MMM yy', { locale: it }),
      value: Math.round(val),
      month: m,
    })
  }
  return points
}

function getResidualColor(pct) {
  if (pct >= 60) return 'text-emerald-400'
  if (pct >= 30) return 'text-amber-400'
  return 'text-red-400'
}

function getResidualBadge(pct) {
  if (pct >= 60) return { variant: 'outline', className: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' }
  if (pct >= 30) return { variant: 'outline', className: 'border-amber-500/40 text-amber-400 bg-amber-500/10' }
  return { variant: 'outline', className: 'border-red-500/40 text-red-400 bg-red-500/10' }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-muted-foreground mb-1">{label}</div>
      <div className="font-bold text-foreground">€{payload[0].value.toLocaleString('it-IT')}</div>
    </div>
  )
}

export default function AmmortamentoPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      const supabase = getSupabase()
      const { data } = await supabase
        .from('equipment')
        .select('id, name, brand, model, purchase_price, purchase_date, photo_url, condition')
        .neq('condition', 'retired')
        .neq('condition', 'sold')
        .not('purchase_price', 'is', null)
        .order('purchase_date', { ascending: false })
      setItems(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const itemsWithData = items.map((eq) => ({
    ...eq,
    dep: calcDepreciation(eq.purchase_price, eq.purchase_date),
  }))

  const totalPurchase = itemsWithData.reduce((s, e) => s + (e.purchase_price || 0), 0)
  const totalCurrent  = itemsWithData.reduce((s, e) => s + (e.dep?.currentValue || 0), 0)
  const totalLoss     = totalPurchase - totalCurrent

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Ammortamento</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Valore residuo dell&apos;attrezzatura calcolato con metodo a quote costanti (5 anni)
        </p>
      </div>

      {/* Summary cards */}
      {!loading && itemsWithData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Valore d&apos;acquisto</div>
            <div className="text-2xl font-bold">€{totalPurchase.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{itemsWithData.length} item</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Valore attuale</div>
            <div className="text-2xl font-bold text-emerald-400">€{totalCurrent.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {totalPurchase > 0 ? Math.round((totalCurrent / totalPurchase) * 100) : 0}% residuo
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Valore perso</div>
            <div className="text-2xl font-bold text-red-400">€{totalLoss.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</div>
            <div className="text-xs text-muted-foreground mt-0.5">ammortizzato</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : itemsWithData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <TrendingDown className="w-10 h-10 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-muted-foreground text-sm font-medium">Nessun dato</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Aggiungi un prezzo d&apos;acquisto agli item dell&apos;inventario</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Attrezzatura</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Acquisto</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Data</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valore attuale</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Residuo</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {itemsWithData.map((eq) => {
                const d = eq.dep
                const badge = d ? getResidualBadge(d.residualPct) : null
                return (
                  <tr key={eq.id} className="hover:bg-muted/30 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {eq.photo_url ? (
                          <img src={eq.photo_url} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0 border border-border" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-muted flex-shrink-0 border border-border" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{eq.name}</div>
                          {(eq.brand || eq.model) && (
                            <div className="text-xs text-muted-foreground truncate">
                              {[eq.brand, eq.model].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground hidden sm:table-cell">
                      {eq.purchase_price != null ? `€${Number(eq.purchase_price).toLocaleString('it-IT')}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground text-xs hidden sm:table-cell">
                      {eq.purchase_date ? format(parseISO(eq.purchase_date), 'd MMM yyyy', { locale: it }) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold">
                      {d ? `€${d.currentValue.toLocaleString('it-IT')}` : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {d ? (
                        <Badge className={`text-[10px] font-bold ${badge.className}`}>
                          {d.residualPct}%
                        </Badge>
                      ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {d && (
                        <button
                          onClick={() => setSelected(eq)}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
                          title="Dettaglio ammortamento"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              {selected?.name}
            </DialogTitle>
          </DialogHeader>
          {selected && (() => {
            const d = selected.dep
            const chartData = buildChartData(selected.purchase_price, selected.purchase_date)
            const nowMonths = d?.elapsed || 0
            const badge = getResidualBadge(d?.residualPct || 0)

            return (
              <div className="space-y-5">
                {/* KPIs */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Acquisto</div>
                    <div className="text-base font-bold">€{Number(selected.purchase_price).toLocaleString('it-IT')}</div>
                    {selected.purchase_date && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {format(parseISO(selected.purchase_date), 'd MMM yyyy', { locale: it })}
                      </div>
                    )}
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Attuale</div>
                    <div className="text-base font-bold text-emerald-400">€{d?.currentValue.toLocaleString('it-IT')}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">oggi</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Residuo</div>
                    <div className={`text-base font-bold ${getResidualColor(d?.residualPct || 0)}`}>{d?.residualPct}%</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{d?.elapsed} mesi</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Ammortamento</span>
                    <span>{d?.elapsed} / {d?.totalMonths} mesi</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full transition-all"
                      style={{ width: `${Math.min((d?.elapsed / d?.totalMonths) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 text-right">
                    Vita utile stimata: {d?.yearsLife} anni
                  </div>
                </div>

                {/* Chart */}
                {chartData.length > 0 && (
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v.toLocaleString('it-IT')}`} width={55} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine
                          x={chartData.find((p) => p.month >= nowMonths)?.label}
                          stroke="hsl(var(--primary))"
                          strokeDasharray="4 2"
                          label={{ value: 'oggi', position: 'top', fontSize: 9, fill: 'hsl(var(--primary))' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
