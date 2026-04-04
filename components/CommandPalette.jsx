'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Package, Briefcase, Box, Layers, Loader2 } from 'lucide-react'

const TYPE_META = {
  equipment: { icon: Package, label: 'Attrezzatura', color: 'text-blue-400' },
  set: { icon: Briefcase, label: 'Set', color: 'text-amber-400' },
  case: { icon: Box, label: 'Case', color: 'text-sky-400' },
  kit: { icon: Layers, label: 'Kit', color: 'text-violet-400' },
}

const HREF = {
  equipment: (id) => `/scan/${id}`,
  set: (id) => `/set/${id}`,
  case: (id) => `/case/${id}`,
  kit: (id) => `/kit/${id}`,
}

export default function CommandPalette({ open, onOpenChange }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    const supabase = getSupabase()
    const s = q.trim()
    const [eqRes, setRes, caseRes, kitRes] = await Promise.all([
      supabase.from('equipment')
        .select('id, name, brand, model, serial_number')
        .or(`name.ilike.%${s}%,brand.ilike.%${s}%,serial_number.ilike.%${s}%,model.ilike.%${s}%`)
        .limit(5),
      supabase.from('sets')
        .select('id, name, location, status')
        .or(`name.ilike.%${s}%,location.ilike.%${s}%`)
        .limit(5),
      supabase.from('cases')
        .select('id, name, description')
        .or(`name.ilike.%${s}%,description.ilike.%${s}%`)
        .limit(4),
      supabase.from('kits')
        .select('id, name, description')
        .or(`name.ilike.%${s}%,description.ilike.%${s}%`)
        .limit(4),
    ])

    const combined = [
      ...(eqRes.data || []).map((r) => ({ ...r, _type: 'equipment', _sub: [r.brand, r.model].filter(Boolean).join(' · ') + (r.serial_number ? ` · S/N: ${r.serial_number}` : '') })),
      ...(setRes.data || []).map((r) => ({ ...r, _type: 'set', _sub: [r.location, r.status].filter(Boolean).join(' · ') })),
      ...(caseRes.data || []).map((r) => ({ ...r, _type: 'case', _sub: r.description || '' })),
      ...(kitRes.data || []).map((r) => ({ ...r, _type: 'kit', _sub: r.description || '' })),
    ]
    setResults(combined)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 200)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]) }
  }, [open])

  function handleSelect(item) {
    onOpenChange(false)
    router.push(HREF[item._type](item.id))
  }

  const grouped = ['equipment', 'set', 'case', 'kit'].map((type) => ({
    type,
    items: results.filter((r) => r._type === type),
  })).filter((g) => g.items.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg">
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
          <CommandInput
            placeholder="Cerca attrezzatura, set, case, kit…"
            value={query}
            onValueChange={setQuery}
            className="border-b border-border"
          />
          <CommandList className="max-h-[400px]">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && query.trim() && results.length === 0 && (
              <CommandEmpty>Nessun risultato per &ldquo;{query}&rdquo;</CommandEmpty>
            )}
            {!loading && !query.trim() && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Inizia a scrivere per cercare…
              </div>
            )}
            {grouped.map(({ type, items }) => {
              const meta = TYPE_META[type]
              return (
                <CommandGroup key={type} heading={meta.label}>
                  {items.map((item) => {
                    const Icon = meta.icon
                    return (
                      <CommandItem
                        key={`${type}-${item.id}`}
                        value={`${type}-${item.id}`}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{item.name}</div>
                          {item._sub && (
                            <div className="text-xs text-muted-foreground truncate">{item._sub}</div>
                          )}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
