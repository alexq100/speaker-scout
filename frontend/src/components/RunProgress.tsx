// Live view while the agents work: the Scout Lead, one tile per category, and a plain-English feed.
import { useEffect, useState } from 'react'
import { CATEGORY_LABEL } from '../lib/labels'
import type { Category, ProgressEvent, SearchResult } from '../lib/types'
import { Clock, Sparkle, Stop } from './Icons'

type Phase = 'waiting' | 'searching' | 'checking' | 'done' | 'error'

function phaseOf(cat: Category, events: ProgressEvent[], result: SearchResult): { phase: Phase; note: string } {
  const mine = events.filter((e) => e.category === cat)
  const cr = result.categories.find((c) => c.category === cat)
  if (cr?.error) return { phase: 'error', note: cr.error }
  const last = mine[mine.length - 1]
  if (!last) return { phase: 'waiting', note: 'Waiting for the plan…' }
  if (/confirmed/.test(last.message)) return { phase: 'done', note: last.message }
  if (/Found 0 candidates/.test(last.message)) return { phase: 'done', note: 'No strong matches found' }
  if (/verifier/i.test(last.agent)) return { phase: 'checking', note: last.message }
  return { phase: 'searching', note: last.message }
}

const PHASE_LABEL: Record<Phase, string> = {
  waiting: 'Waiting', searching: 'Searching', checking: 'Checking', done: 'Done', error: 'Problem',
}
const PHASE_WEIGHT: Record<Phase, number> = { waiting: 0, searching: 0.25, checking: 0.65, done: 1, error: 1 }

export default function RunProgress({ result, onStop }: { result: SearchResult; onStop: () => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [])

  const started = new Date(result.created_at).getTime()
  const elapsed = Math.max(0, Math.floor((now - started) / 1000))
  const cats = result.brief.categories
  const phases = cats.map((c) => ({ cat: c, ...phaseOf(c, result.events, result) }))
  const planReady = !!result.plan
  const pct = Math.round(((planReady ? 1 : 0.3) * 10 + (phases.reduce((s, p) => s + PHASE_WEIGHT[p.phase], 0) / cats.length) * 90))

  return (
    <div className="run-layout">
      <div>
        <div className="run-status">
          <div style={{ flex: 1 }}>
            <h2>The scouts are at work</h2>
            <p>Searching the web, then checking every person against real pages. Usually about a minute.</p>
            <div className="progress-bar"><span style={{ width: `${Math.min(pct, 98)}%` }} /></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="run-clock"><Clock size={20} style={{ verticalAlign: '-1px', opacity: 0.7 }} /> {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</div>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.14)', color: '#fff', marginTop: 8 }} onClick={onStop}>
              <Stop size={14} /> Stop
            </button>
          </div>
        </div>

        <div className="lead-tile">
          <span className="choice-icon" style={{ margin: 0, background: 'var(--yale-blue)', color: '#fff' }}><Sparkle size={18} /></span>
          <div>
            <span className={`status-dot ${planReady ? 'done' : 'working'}`}>Scout Lead · {planReady ? 'Plan ready' : 'Planning'}</span>
            <p>{result.plan?.summary ?? 'Reading your brief and deciding where each scout should look…'}</p>
          </div>
        </div>

        <div className="agent-board">
          {phases.map(({ cat, phase, note }) => (
            <div key={cat} className={`agent-tile ${phase === 'searching' || phase === 'checking' ? 'active' : ''} ${phase === 'done' ? 'done' : ''}`}>
              <span className={`status-dot ${phase === 'done' ? 'done' : phase === 'error' ? 'error' : phase === 'waiting' ? '' : 'working'}`}>
                {PHASE_LABEL[phase]}
              </span>
              <h3>{CATEGORY_LABEL[cat]}</h3>
              <div className="agent-steps" aria-hidden="true">
                <span className={phase === 'searching' ? 'pulse' : phase !== 'waiting' ? 'on' : ''} />
                <span className={phase === 'checking' ? 'pulse' : phase === 'done' || phase === 'error' ? 'on' : ''} />
                <span className={phase === 'done' ? 'on' : ''} />
              </div>
              <div className="agent-note">{note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="feed">
        <div className="feed-head">
          <h3>Live activity</h3>
          <span className="status-dot working">Live</span>
        </div>
        <ol>
          {[...result.events].reverse().map((e, i) => (
            <li key={`${e.seconds}-${i}`}>
              <time>{e.seconds.toFixed(0)}s</time>
              <span><strong>{e.agent}</strong> {e.message}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
