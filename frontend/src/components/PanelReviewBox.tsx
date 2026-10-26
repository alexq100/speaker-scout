// Panel Architect on the Shortlist: honest feedback on a panel the planner built, what's missing,
// and who to add (only people already found in the shortlist or past searches).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useOpenProfile } from '../lib/drawer'
import { relativeDate } from '../lib/format'
import { CATEGORY_SHORT } from '../lib/labels'
import { useShortlist } from '../lib/shortlist'
import type { Group, ReviewSuggestion } from '../lib/types'
import Avatar from './Avatar'
import { Alert, Check, CheckCircle, Chat, Plus, Refresh, Search, Sparkle } from './Icons'
import { useToast } from './Toast'

const VERDICT: Record<string, { label: string; cls: string }> = {
  strong: { label: 'Strong panel', cls: 'v-strong' },
  promising: { label: 'Promising', cls: 'v-promising' },
  needs_work: { label: 'Needs work', cls: 'v-needs' },
}

export default function PanelReviewBox({ group }: { group: Group }) {
  const { items, groups, reviewGroup, addToGroup, move, updateGroup } = useShortlist()
  const placedIn = (s: ReviewSuggestion) => {
    const it = items.find((i) => i.name === s.name && i.category === s.category)
    return it?.group_id != null && it.group_id !== group.id ? groups.find((g) => g.id === it.group_id)?.name : undefined
  }
  const openProfile = useOpenProfile()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const r = group.review

  async function review() {
    setBusy(true)
    setError(null)
    try {
      await reviewGroup(group.id)
      setAdded({})
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function accept(s: ReviewSuggestion) {
    if (!s.search_id) return
    const from = placedIn(s)
    if (from && !window.confirm(`${s.name} is currently in "${from}". A person can be in one group at a time. Move them to "${group.name}"?`)) return
    try {
      await addToGroup(s.search_id, s.category, s.name, group.id)
      if (s.role === 'swap' && s.swap_for) {
        const out = items.find((i) => i.group_id === group.id && i.name === s.swap_for)
        if (out) await move(out.id, null)
      }
      setAdded((a) => ({ ...a, [s.name]: true }))
      toast(s.role === 'swap' && s.swap_for ? `Swapped in ${s.name} (moved ${s.swap_for} to Unsorted)`
        : from ? `Moved ${s.name} from ${from} to ${group.name}` : `Added ${s.name} to ${group.name}`)
    } catch (e) {
      toast((e as Error).message)
    }
  }

  async function openSuggestion(s: ReviewSuggestion) {
    if (!s.search_id) return
    const res = await api.search(s.search_id)
    const card = res.categories.find((c) => c.category === s.category)?.cards.find((c) => c.name === s.name)
    if (card) openProfile(card, s.category, s.search_id)
  }

  if (!r) {
    return (
      <div className="architect architect-empty">
        <span className="architect-icon"><Sparkle size={20} /></span>
        <div>
          <h3>Ask the Panel Architect</h3>
          <p>Get honest feedback on this panel: is it a good conversation, what angle or voice is missing, and who from your shortlist or past searches could fill the gap. About 10 seconds, with no new web search.</p>
          {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}
        </div>
        <button className="btn btn-primary" onClick={review} disabled={busy || group.count === 0}>
          {busy ? <><span className="spinner" /> Reviewing…</> : <><Sparkle size={16} /> Review this panel</>}
        </button>
      </div>
    )
  }

  const v = VERDICT[r.verdict]
  return (
    <div className="architect">
      <div className="architect-head">
        <span className="architect-icon"><Sparkle size={20} /></span>
        <div style={{ flex: 1 }}>
          <span className="eyebrow">Panel Architect review</span>
          <div className="verdict-row">
            <span className={`verdict ${v.cls}`}>{v.label}</span>
            <span className="verdict-score">{r.score}/5</span>
            {r.reviewed_at && <small>Reviewed {relativeDate(r.reviewed_at)}</small>}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={review} disabled={busy}>
          {busy ? <span className="spinner spinner-dark" /> : <Refresh size={15} />} Review again
        </button>
      </div>
      {error && <div className="alert alert-error" style={{ margin: '0 22px 12px' }}>{error}</div>}

      <p className="architect-summary">{r.summary}</p>

      <div className="architect-cols">
        <div>
          <h4><CheckCircle size={14} /> What works</h4>
          <ul className="bullets">{r.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        {r.concerns.length > 0 && (
          <div>
            <h4 className="warn"><Alert size={14} /> Watch out for</h4>
            <ul className="bullets">{r.concerns.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
        {r.missing.length > 0 && (
          <div>
            <h4 className="miss"><Plus size={14} /> What's missing</h4>
            <ul className="bullets">{r.missing.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
      </div>

      {r.suggestions.length > 0 && (
        <div className="architect-sugs">
          <h4>Suggested additions <small>(from your shortlist and past searches)</small></h4>
          <ul>
            {r.suggestions.map((s) => (
              <li key={s.name}>
                <button className="avatar-btn" onClick={() => openSuggestion(s)} aria-label={`Open ${s.name}'s profile`}>
                  <Avatar name={s.name} size={44} />
                </button>
                <div className="sug-text">
                  <button className="name-btn" onClick={() => openSuggestion(s)}><strong>{s.name}</strong></button>
                  <small>
                    {CATEGORY_SHORT[s.category]} · {placedIn(s) ? `currently in ${placedIn(s)}` : s.on_shortlist ? 'on your shortlist' : 'from a past search'}
                    {s.role === 'swap' && s.swap_for ? ` · swap for ${s.swap_for}` : s.role === 'moderator' ? ' · as moderator' : ''}
                  </small>
                  <p>{s.why}</p>
                </div>
                {added[s.name] ? (
                  <span className="sug-done"><Check size={15} /> Added</span>
                ) : (
                  <button className="btn btn-outline btn-sm" onClick={() => accept(s)}>
                    <Plus size={14} /> {placedIn(s) ? `Move here from ${placedIn(s)}` : s.role === 'swap' ? 'Swap in' : 'Add to panel'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="architect-foot">
        {r.moderator_note && <p><Chat size={14} /> <span><strong>Moderator:</strong> {r.moderator_note}</span></p>}
        {r.suggested_theme && (
          <p>
            <Sparkle size={14} />
            <span><strong>Sharper theme:</strong> “{r.suggested_theme}”{' '}
              {r.suggested_theme !== group.theme && (
                <button className="link-btn" onClick={async () => { await updateGroup(group.id, { theme: r.suggested_theme! }); toast('Panel theme updated') }}>Use this theme</button>
              )}
            </span>
          </p>
        )}
        {r.suggested_search && (
          <p>
            <Search size={14} />
            <span><strong>Nobody in your pool fills a gap yet. Try searching:</strong> “{r.suggested_search}”{' '}
              <button className="link-btn" onClick={() => navigate(`/?theme=${encodeURIComponent(r.suggested_search!)}`)}>Start this search</button>
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
