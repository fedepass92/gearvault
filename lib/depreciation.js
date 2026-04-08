// Annual depreciation rates by equipment category (DB keys)
const DEPRECIATION_RATES = {
  camera:    0.22,
  lens:      0.06,
  audio:     0.12,
  drone:     0.28,
  lighting:  0.10,
  support:   0.04,
  accessory: 0.18,
  altro:     0.12,
}

// Condition multipliers (DB condition values)
const CONDITION_MULTIPLIERS = {
  active:  1.0,
  repair:  0.30,
  retired: 0.10,
  sold:    0,
}

/**
 * Estimate current market value using exponential decay depreciation.
 * Returns null if purchase_price or purchase_date are missing.
 * Never overwrites a manually set market_value — caller decides when to use this.
 */
export function estimateMarketValue(item) {
  const { purchase_price, purchase_date, category, condition } = item
  if (!purchase_price || !purchase_date) return null

  const rate = DEPRECIATION_RATES[category] ?? 0.12
  const multiplier = CONDITION_MULTIPLIERS[condition] ?? 1.0

  const years = (Date.now() - new Date(purchase_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const baseValue = parseFloat(purchase_price) * Math.pow(1 - rate, years)
  const finalValue = Math.max(baseValue * multiplier, parseFloat(purchase_price) * 0.05)

  return Math.round(finalValue)
}

export function getDepreciationRate(category) {
  return DEPRECIATION_RATES[category] ?? 0.12
}
