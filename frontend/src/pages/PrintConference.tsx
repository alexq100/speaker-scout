// One-page overview of the whole conference program: keynotes, every panel, who's on it, and where outreach stands.
import { Link } from 'react-router-dom'
import { Printer } from '../components/Icons'
import { useConference } from '../lib/conference'
import { shortDate } from '../lib/format'
import { CATEGORY_SHORT, OUTREACH, OUTREACH_LABEL } from '../lib/labels'
import { useShortlist } from '../lib/shortlist'
import type { Group } from '../lib/types'

export default function PrintConference() {
  const { items, groups } = useShortlist()
  const { current } = useConference()
  const keynote = groups.find((g) => g.kind === 'keynote')
  const panels = groups.filter((g) => g.kind === 'panel')
  const sessions = [...(keynote ? [keynote] : []), ...panels]
  const unplaced = items.filter((i) => i.group_id == null)
  const count = (st: string) => items.filter((i) => i.outreach_status === st).length
  const sessionLine = (g: Group) => [g.session_date ? shortDate(g.session_date) : '', g.session_time, g.session_room].filter(Boolean).join(' · ')

  return (
    <div className="print-wrap">
      <div className="print-toolbar no-print">
        <Link to="/at-a-glance" className="btn btn-ghost btn-sm">← Back to at a glance</Link>
        <span className="header-spacer" />
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={15} /> Print / save as PDF</button>
      </div>
      <article className="one-pager op-conference">
        <header className="op-head">
          <span className="op-conf">Speaker program · one-page overview</span>
          <h1>{current?.name}</h1>
          <p className="op-meta">
            {panels.length} panels · {items.length} speakers on the shortlist ·{' '}
            {OUTREACH.filter((o) => count(o.id) > 0).map((o) => `${count(o.id)} ${o.label.toLowerCase()}`).join(' · ')}
          </p>
        </header>
        <div className="opc-sessions">
          {sessions.map((g) => {
            const people = items.filter((i) => i.group_id === g.id)
            const conf = people.filter((p) => p.outreach_status === 'confirmed').length
            return (
              <section key={g.id} className={`opc-session ${g.kind}`}>
                <div className="opc-head">
                  <h2>{g.kind === 'keynote' ? '★ ' : ''}{g.name}</h2>
                  <span>{conf}/{people.length} confirmed</span>
                </div>
                {g.theme && <p className="opc-theme">{g.theme}</p>}
                {sessionLine(g) && <p className="opc-when">{sessionLine(g)}</p>}
                {people.length === 0 ? <p className="opc-empty">No speakers yet</p> : (
                  <ul>
                    {people.map((p) => (
                      <li key={p.id}>
                        <b>{p.card.name}</b>
                        <span className="opc-role">{p.card.job_title}, {p.card.organization} · {CATEGORY_SHORT[p.category]}</span>
                        <span className={`opc-status os-${p.outreach_status}`}>{OUTREACH_LABEL[p.outreach_status]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
        {unplaced.length > 0 && (
          <p className="opc-unplaced"><b>Also on the shortlist (not yet placed):</b> {unplaced.map((u) => u.card.name).join(', ')}</p>
        )}
        <footer className="op-foot">
          Prepared with Speaker Scout · {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} ·
          Speakers verified against public web pages · Outreach status as of today.
        </footer>
      </article>
    </div>
  )
}
