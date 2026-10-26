export function initials(name: string): string {
  const parts = name.replace(/^(dr|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

export function seconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

export function relativeDate(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function cachedShare(input: number, cached: number): number {
  return input ? Math.round((cached / input) * 100) : 0
}

export function shortDate(isoOrDay: string): string {
  const d = isoOrDay.length === 10 ? new Date(isoOrDay + 'T12:00:00') : new Date(isoOrDay)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** 'overdue' | 'today' | 'soon' (within 3 days) | 'later' for a YYYY-MM-DD follow-up date. */
export function followUpState(day: string | null): 'overdue' | 'today' | 'soon' | 'later' | null {
  if (!day) return null
  const today = new Date()
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const d = new Date(day + 'T00:00:00').getTime()
  const diff = Math.round((d - t) / 86400000)
  return diff < 0 ? 'overdue' : diff === 0 ? 'today' : diff <= 3 ? 'soon' : 'later'
}
