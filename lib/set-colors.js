const STATUS_COLOR_FAMILIES = {
  planned:    ['#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8', '#1e40af'],
  out:        ['#f59e0b', '#fbbf24', '#fcd34d', '#d97706', '#b45309'],
  returned:   ['#059669', '#10b981', '#34d399', '#047857', '#065f46'],
  incomplete: ['#e11d48', '#f43f5e', '#fb7185', '#be123c', '#9f1239'],
}

export function getSetColor(setId, status) {
  const family = STATUS_COLOR_FAMILIES[status] || STATUS_COLOR_FAMILIES.planned
  let hash = 0
  const id = String(setId)
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
    hash |= 0
  }
  return family[Math.abs(hash) % family.length]
}
