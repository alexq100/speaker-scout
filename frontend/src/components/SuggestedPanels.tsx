// Panel Architect results: 2-3 cross-discipline panels built from this search's verified people.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { CATEGORY_SHORT } from '../lib/labels'
import { useShortlist } from '../lib/shortlist'
import type { SearchResult, SpeakerCard } from '../lib/types'
import Avatar from './Avatar'
import ArchitectSection from './ArchitectSection'
import { Chat, CheckCircle, Refresh, Sparkle, Stage, Users } from './Icons'
import { useToast } from './Toast'

interface Props {
  result: SearchResult
  onUpdate: (r: SearchResult) => void
  onOpen: (name: string, category: string) => void
}

export default function SuggestedPanels({ result, onUpdate, onOpen }: Props) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<Record<number, number>>({})
  const [error, setError] = useState<string | null>(null)
  const { refresh } = useShortlist()
  const toast = useToast()

  const cards = new Map<string, SpeakerCard>()
  result.categories.forEach((c) => c.cards.forEach((card) => cards.set(card.name, card)))
  const enough = cards.size >= 3 && result.categories.filter((c) => c.cards.length).length >= 2

  async function suggest() {
    setBusy(true)
    setError(null)
    try {
      onUpdate(await api.suggestPanels(result.id))
      setSaved({})
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function save(i: number) {
    try {
      const { group } = await api.savePanel(result.id, i)
      await refresh()
      setSaved((s) => ({ ...s, [i]: group.id }))
      toast(`Saved "${group.name}" as a panel on your shortlist`)
    } catch (e) {
      toast((e as Error).message)
    }
  }

  if (!enough) return null

  return (
    <div id="suggested-panels">
    <ArchitectSection id="suggested-panels" title="suggested panels"
      summary={result.panels.length ? `${result.panels.length} panel${result.panels.length === 1 ? '' : 's'}` : 'Not suggested yet'}>
    <section className="panels-section">
      <div className="panels-head">
        <div>
          <span className="eyebrow"><Sparkle size={13} /> Panel Architect</span>
          <h2>Suggested panels</h2>
          <p>People from this search who'd make a great conversation together, across disciplines, with the question they'd explore.</p>
        </div>
        {result.panels.length > 0 && (
          <button className="btn btn-outline btn-sm" onClick={suggest} disabled={busy}>
            {busy ? <span className="spinner spinner-dark" /> : <Refresh size={15} />} Suggest different panels
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {result.panels.length === 0 ? (
        <div className="panels-empty">
          <p>Let the Panel Architect look across everyone found here and propose 2–3 panels. It takes about 10 seconds and uses only the verified cards, with no new web search.</p>
          <button className="btn btn-primary" onClick={suggest} disabled={busy}>
            {busy ? <><span className="spinner" /> Designing panels…</> : <><Sparkle size={16} /> Suggest panels</>}
          </button>
        </div>
      ) : (
        <div className="panel-grid">
          {result.panels.map((p, i) => (
            <article key={p.title + i} className="panel-card">
              <div className="panel-card-top">
                <span className="panel-num">Panel {i + 1}</span>
                <h3>{p.title}</h3>
                <p className="panel-q">“{p.question}”</p>
              </div>

              <ul className="panel-members">
                {p.members.map((m) => {
                  const card = cards.get(m.name)
                  return (
                    <li key={m.name}>
                      <button className="pm-person" onClick={() => onOpen(m.name, m.category)} title="Open full profile">
                        <Avatar name={m.name} photo={card?.photo_url} size={44} />
                        <span>
                          <strong>{m.name}</strong>
                          <small>{CATEGORY_SHORT[m.category]}{card ? ` · ${card.organization}` : ''}</small>
                        </span>
                      </button>
                      <p>{m.angle}</p>
                    </li>
                  )
                })}
              </ul>

              {p.moderator && (
                <div className="panel-mod">
                  <Chat size={15} />
                  <span><strong>Moderator:</strong>{' '}
                    <button className="link-btn" onClick={() => onOpen(p.moderator!.name, p.moderator!.category)}>{p.moderator.name}</button>
                    {' '}· {p.moderator.angle}</span>
                </div>
              )}

              <div className="panel-why">
                <h4><Users size={13} /> Why they work together</h4>
                <ul className="bullets">{p.why_together.map((w) => <li key={w}>{w}</li>)}</ul>
                <h4>Where they'll differ</h4>
                <p>{p.tension}</p>
                {p.shared_stage.length > 0 && (
                  <div className="shared-stage">
                    {p.shared_stage.map((s) => <span key={s}><Stage size={13} /> {s}</span>)}
                  </div>
                )}
                <p className="panel-balance">{p.balance_note}</p>
              </div>

              <div className="panel-foot">
                {saved[i] ? (
                  <Link to="/shortlist" className="btn btn-outline btn-sm"><CheckCircle size={15} /> Saved · open shortlist</Link>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => save(i)}><Users size={15} /> Save as panel</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
    </ArchitectSection>
    </div>
  )
}
