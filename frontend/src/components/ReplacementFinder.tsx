// Shown in the Planning tab when a speaker declines: who could fill their seat (shortlist + past searches only).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useOpenProfile } from '../lib/drawer'
import { CATEGORY_SHORT } from '../lib/labels'
import { useShortlist } from '../lib/shortlist'
import type { ReplacementResult, ReviewSuggestion, ShortlistItem } from '../lib/types'
import Avatar from './Avatar'
import { Check, Plus, Refresh, Search, Users } from './Icons'
import { useToast } from './Toast'

export default function ReplacementFinder({ item }: { item: ShortlistItem }) {
  const { groups, addToGroup, add } = useShortlist()
  const openProfile = useOpenProfile()
  const toast = useToast()
  const navigate = useNavigate()
  const [res, setRes] = useState<ReplacementResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const group = groups.find((g) => g.id === item.group_id)

  async function run() {
    setBusy(true)
    try {
      setRes(await api.findReplacements(item.id))
      setDone({})
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function accept(s: ReviewSuggestion) {
    if (!s.search_id) return
    if (group) await addToGroup(s.search_id, s.category, s.name, group.id)
    else await add(s.search_id, s.category, s.name)
    setDone((d) => ({ ...d, [s.name]: true }))
    toast(group ? `Added ${s.name} to ${group.name}` : `Saved ${s.name} to the shortlist`)
  }

  async function open(s: ReviewSuggestion) {
    if (!s.search_id) return
    const r = await api.search(s.search_id)
    const card = r.categories.find((c) => c.category === s.category)?.cards.find((c) => c.name === s.name)
    if (card) openProfile(card, s.category, s.search_id)
  }

  return (
    <section className="pl-card pl-replace">
      <h3 className="pl-title"><Users size={15} /> {item.name.split(' ')[0]} declined: find a replacement</h3>
      {!res ? (
        <>
          <p className="pl-meta" style={{ margin: '-4px 0 10px' }}>
            The Panel Architect looks for someone from your shortlist or past searches who covers the same angle{group ? ` on "${group.name}"` : ''} without duplicating anyone already there.
          </p>
          <button className="btn btn-primary btn-sm" onClick={run} disabled={busy}>
            {busy ? <><span className="spinner" /> Looking…</> : <><Search size={14} /> Find a replacement</>}
          </button>
        </>
      ) : (
        <>
          <p className="pl-session" style={{ marginBottom: 10 }}>{res.summary}</p>
          <ul className="rep-list">
            {res.suggestions.map((s) => (
              <li key={s.name}>
                <button className="avatar-btn" onClick={() => open(s)}><Avatar name={s.name} size={38} /></button>
                <div>
                  <button className="name-btn" onClick={() => open(s)}><strong>{s.name}</strong></button>
                  <small>{CATEGORY_SHORT[s.category]} · {s.on_shortlist ? 'on your shortlist' : 'from a past search'}</small>
                  <p>{s.why}</p>
                </div>
                {done[s.name] ? <span className="sug-done"><Check size={14} /> Added</span>
                  : <button className="btn btn-outline btn-sm" onClick={() => accept(s)}><Plus size={13} /> {group ? 'Add to panel' : 'Save'}</button>}
              </li>
            ))}
          </ul>
          {res.suggested_search && (
            <p className="pl-meta"><Search size={12} /> Try a new search: “{res.suggested_search}”{' '}
              <button className="link-btn" onClick={() => navigate(`/?theme=${encodeURIComponent(res.suggested_search!.slice(0, 200))}`)}>Start it</button></p>
          )}
          <button className="btn btn-ghost btn-sm" onClick={run} disabled={busy}><Refresh size={13} /> Look again</button>
        </>
      )}
    </section>
  )
}
