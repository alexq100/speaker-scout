// Proof the safety checks ran: who was dropped and why, what the code removed, any injection attempts,
// and the full step-by-step trace of what each agent did.
import { CATEGORY_SHORT, REMOVAL_LABEL } from '../lib/labels'
import type { Category, SearchResult } from '../lib/types'
import { Alert, ChevronDown, Shield } from './Icons'

export default function ChecksPanel({ result }: { result: SearchResult }) {
  const dropped = result.categories.flatMap((c) => c.dropped.map((d) => ({ ...d, category: c.category })))
  const removals = result.removals

  return (
    <>
      <details className="checks">
        <summary>
          <span className="shield"><Shield size={20} /></span>
          <div>
            <h3>Checked and filtered</h3>
            <p>
              {dropped.length} {dropped.length === 1 ? 'person' : 'people'} dropped by the verifiers · {removals.length} item
              {removals.length === 1 ? '' : 's'} removed by code checks · {result.injection_flags.length} injection attempt
              {result.injection_flags.length === 1 ? '' : 's'} flagged
            </p>
          </div>
          <ChevronDown size={18} className="chev" />
        </summary>
        <div className="checks-body">
          <div>
            <h4>Dropped by the verifiers</h4>
            {dropped.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Nobody: every candidate checked out.</p> : (
              <ul className="check-list">
                {dropped.map((d) => (
                  <li key={d.category + d.name}>
                    <strong>{d.name} <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· {CATEGORY_SHORT[d.category as Category]}</span></strong>
                    <span>{d.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4>Removed by code checks</h4>
            {removals.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Nothing needed removing: no invented links, wrong photos or contact details.</p> : (
              <ul className="check-list">
                {removals.map((r, i) => (
                  <li key={i}>
                    <strong>{r.name}</strong>
                    <span className="check-what">{REMOVAL_LABEL[r.what] ?? r.what}</span>
                    <br /><span>{r.detail}</span>
                  </li>
                ))}
              </ul>
            )}
            {result.injection_flags.length > 0 && (
              <>
                <h4 style={{ marginTop: 18 }} className="flag"><Alert size={14} /> Prompt-injection attempts (ignored)</h4>
                <ul className="check-list">
                  {result.injection_flags.map((f, i) => <li key={i} className="flag">{f}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      </details>

      <details className="checks">
        <summary>
          <span className="shield" style={{ background: 'var(--tint)', color: 'var(--yale-blue)' }}><ChevronDown size={20} /></span>
          <div>
            <h3>Step-by-step: what each agent did</h3>
            <p>{result.events.length} steps · {result.usage.model_calls} model calls · {result.usage.web_searches} web searches · {result.usage.page_reads} pages read</p>
          </div>
          <ChevronDown size={18} className="chev" />
        </summary>
        <div style={{ padding: '0 22px 22px' }}>
          {result.plan && (
            <div className="alert alert-info" style={{ marginBottom: 14 }}>
              <span><strong>Scout Lead's plan:</strong> {result.plan.summary}</span>
            </div>
          )}
          <ul className="trace-list">
            {result.events.map((e, i) => (
              <li key={i}>
                <time>{e.seconds.toFixed(1)}s</time>
                <b>{e.agent}</b>
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </>
  )
}
