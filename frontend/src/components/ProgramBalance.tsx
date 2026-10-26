// Panel Architect review of the whole conference program: balance, gaps, overlaps, circuit vs rising voices,
// and who to add (from the shortlist and this conference's past searches).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useConference } from '../lib/conference'
import { useOpenProfile } from '../lib/drawer'
import { relativeDate } from '../lib/format'
import { CATEGORY_LABEL, CATEGORY_SHORT, LEVEL_LABEL, SPEAKING_LABEL } from '../lib/labels'
import { useShortlist } from '../lib/shortlist'
import type { Category, ProgramReview, ProgramSuggestion } from '../lib/types'
import Avatar from './Avatar'
import { Alert, Check, CheckCircle, Plus, Refresh, Search, Sparkle, Users } from './Icons'
import { useToast } from './Toast'

const VERDICT: Record<string, [string, string]> = {
  strong: ['Well balanced', 'v-strong'], promising: ['Promising', 'v-promising'], needs_work: ['Needs work', 'v-needs'],
}

function MixBar({ title, counts, labels }: { title: string; counts: Record<string, number>; labels: Record<string, string> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  return (
    <div className="mix">
      <span className="field-label">{title}</span>
      <div className="mix-bar">
        {Object.entries(counts).map(([k, n]) => (
          <span key={k} className={`mix-seg mix-${k}`} style={{ flex: n }} title={`${labels[k] ?? k}: ${n}`} />
        ))}
      </div>
      <div className="mix-legend">
        {Object.entries(counts).map(([k, n]) => <span key={k}><i className={`mix-seg mix-${k}`} /> {labels[k] ?? k} <b>{n}</b></span>)}
      </div>
      <small className="mix-total">{total} people</small>
    </div>
  )
}

export default function ProgramBalance() {
  const { currentId } = useConference()
  const { items, has, add } = useShortlist()
  const openProfile = useOpenProfile()
  const toast = useToast()
  const navigate = useNavigate()
  const [review, setReview] = useState<ProgramReview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setReview(null)
    if (currentId) api.getBalance(currentId).then(setReview).catch(() => setReview(null))
  }, [currentId])

  async function run() {
    if (!currentId) return
    setBusy(true)
    setError(null)
    try {
      setReview(await api.checkBalance(currentId))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function addToShortlist(s: ProgramSuggestion) {
    if (!s.search_id) return
    await add(s.search_id, s.category, s.name)
    toast(`Saved ${s.name} to the shortlist (Unsorted)`)
  }

  async function openSuggestion(s: ProgramSuggestion) {
    if (!s.search_id) return
    const r = await api.search(s.search_id)
    const card = r.categories.find((c) => c.category === s.category)?.cards.find((c) => c.name === s.name)
    if (card) openProfile(card, s.category as Category, s.search_id)
  }

  if (!review) {
    return (
      <div className="architect architect-empty balance-empty">
        <span className="architect-icon"><Sparkle size={20} /></span>
        <div>
          <h3>Check program balance</h3>
          <p>The Panel Architect looks at your whole program at once (keynotes, every panel and unplaced people): the mix of sectors and career stages, overlap between sessions, too many "usual circuit" names vs. rising voices, and who to add. About 10 seconds.</p>
          {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy || items.length === 0}>
          {busy ? <><span className="spinner" /> Reviewing…</> : <><Users size={16} /> Check program balance</>}
        </button>
      </div>
    )
  }

  const [vLabel, vCls] = VERDICT[review.verdict]
  return (
    <div className="architect balance">
      <div className="architect-head">
        <span className="architect-icon"><Sparkle size={20} /></span>
        <div style={{ flex: 1 }}>
          <span className="eyebrow">Program balance · Panel Architect</span>
          <div className="verdict-row">
            <span className={`verdict ${vCls}`}>{vLabel}</span>
            <span className="verdict-score">{review.score}/5</span>
            {review.reviewed_at && <small>Reviewed {relativeDate(review.reviewed_at)}</small>}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={run} disabled={busy}>
          {busy ? <span className="spinner spinner-dark" /> : <Refresh size={15} />} Check again
        </button>
      </div>
      {error && <div className="alert alert-error" style={{ margin: '0 22px 12px' }}>{error}</div>}
      <p className="architect-summary">{review.summary}</p>

      <div className="mix-grid">
        {review.mix.by_category && <MixBar title="Sectors" counts={review.mix.by_category} labels={CATEGORY_SHORT as Record<string, string>} />}
        {review.mix.by_level && <MixBar title="Career stage" counts={review.mix.by_level} labels={LEVEL_LABEL as Record<string, string>} />}
        {review.mix.by_speaking && <MixBar title="Speaking experience" counts={review.mix.by_speaking} labels={SPEAKING_LABEL as Record<string, string>} />}
      </div>

      <div className="architect-cols">
        {review.strengths.length > 0 && <div><h4><CheckCircle size={14} /> What works</h4><ul className="bullets">{review.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>}
        {review.gaps.length > 0 && <div><h4 className="miss"><Plus size={14} /> Gaps</h4><ul className="bullets">{review.gaps.map((x) => <li key={x}>{x}</li>)}</ul></div>}
        {(review.overlaps.length > 0 || review.circuit_note) && (
          <div>
            <h4 className="warn"><Alert size={14} /> Overlaps & usual circuit</h4>
            <ul className="bullets">
              {review.overlaps.map((x) => <li key={x}>{x}</li>)}
              {review.circuit_note && <li>{review.circuit_note}</li>}
            </ul>
          </div>
        )}
      </div>

      {review.suggestions.length > 0 && (
        <div className="architect-sugs">
          <h4>Who to add <small>(from your shortlist and this conference's past searches)</small></h4>
          <ul>
            {review.suggestions.map((s) => {
              const saved = has(s.name, s.category)
              return (
                <li key={s.name}>
                  <button className="avatar-btn" onClick={() => openSuggestion(s)}><Avatar name={s.name} size={44} /></button>
                  <div className="sug-text">
                    <button className="name-btn" onClick={() => openSuggestion(s)}><strong>{s.name}</strong></button>
                    <small>{CATEGORY_LABEL[s.category]} · for <b>{s.session}</b> · {saved ? 'on your shortlist' : 'from a past search'}</small>
                    <p>{s.why}</p>
                  </div>
                  {saved ? <span className="sug-done"><Check size={15} /> On shortlist</span>
                    : <button className="btn btn-outline btn-sm" onClick={() => addToShortlist(s)}><Plus size={14} /> Add to shortlist</button>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {review.suggested_searches.length > 0 && (
        <div className="architect-foot">
          {review.suggested_searches.map((q) => (
            <p key={q}><Search size={14} /><span><strong>Nobody in your pool fills this yet:</strong> {q}{' '}
              <button className="link-btn" onClick={() => navigate(`/?theme=${encodeURIComponent(q.slice(0, 200))}`)}>Start this search</button></span></p>
          ))}
        </div>
      )}
    </div>
  )
}
