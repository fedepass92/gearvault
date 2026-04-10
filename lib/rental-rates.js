// Percentuali giornaliere basate su analisi mercato rental Sud Italia
const RATES = {
  camera:    { pct: 0.05, label: '5%' },
  lens:      { pct: 0.04, label: '4%' },
  drone:     { pct: 0.06, label: '6%' },
  audio:     { pct: 0.07, label: '7%' },
  lighting:  { pct: 0.05, label: '5%' },
  support:   { pct: 0.06, label: '6%' },
  accessory: { pct: 0.08, label: '8%' },
  altro:     { pct: 0.05, label: '5%' },
}

export function getSuggestedRate(category, purchasePrice) {
  const rate = RATES[category] || RATES.altro
  const suggested = Math.round(purchasePrice * rate.pct)
  return {
    daily: Math.max(suggested, 5),
    percentage: rate.pct,
    label: rate.label,
  }
}

// Sconti per durata suggeriti
export function getDurationDiscount(days) {
  if (days <= 1) return 0
  if (days <= 3) return 10   // -10%
  if (days <= 5) return 20   // -20%
  if (days <= 7) return 25   // -25%
  if (days <= 14) return 30  // -30%
  return 35                   // -35% per 2+ settimane
}
