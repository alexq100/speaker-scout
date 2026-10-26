// "Shortlist at a glance": one clean table of every keynote and panel in the current conference,
// with who's on it and where outreach stands. Easy to scan, print, or paste into an email.
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import ProgramBalance from '../components/ProgramBalance'
import { ArrowRight, Clock, Copy, Mic, Printer, Table, Users } from '../components/Icons'
import { useToast } from '../components/Toast'
import { useConference } from '../lib/conference'
import { useOpenProfile } from '../lib/drawer'
import { followUpState, shortDate } from '../lib/format'
import { CATEGORY_SHORT, CHECKLIST, OUTREACH, OUTREACH_LABEL } from '../lib/labels'
import { useShortlist } from '../lib/shortlist'
import type { Group, ShortlistItem } from '../lib/types'

interface Section { key: string; group: Group | null; title: string; people: ShortlistItem[] }

function sessionText(g: Group | null): string {
  if (!g) return ''
  return [g.session_date ? shortDate(g.session_date) : '', g.session_time, g.session_room].filter(Boolean).join(' · ')
}

export default function AtAGlance() {
  const { items, groups } = useShortlist()
  const { current } = useConference()
  const openProfile = useOpenProfile()
  const toast = useToast()

  const keynote = groups.find((g) => g.kind === 'keynote') ?? null
  const panels = groups.filter((g) => g.kind === 'panel')
  const sections: Section[] = [
    ...(keynote ? [{ key: `g${keynote.id}`, group: keynote, title: keynote.name, people: items.filter((i) => i.group_id === keynote.id) }] : []),
    ...panels.map((g) => ({ key: `g${g.id}`, group: g, title: g.name, people: items.filter((i) => i.group_id === g.id) })),
    { key: 'unsorted', group: null, title: 'Not yet placed', people: items.filter((i) => i.group_id == null) },
  ].filter((s) => s.people.length > 0 || s.group)

  const count = (st: string) => items.filter((i) => i.outreach_status === st).length
  const due = items.filter((i) => ['overdue', 'today'].includes(followUpState(i.follow_up_date) ?? '')).length
  const confirmedIn = (s: Section) => s.people.filter((i) => i.outreach_status === 'confirmed').length

  function copyTable() {
    const lines: string[] = [`${current?.name ?? 'Conference'} · speaker shortlist`, '']
    for (const s of sections) {
      if (!s.people.length) continue
      const sess = sessionText(s.group)
      lines.push(`${s.title}${sess ? ` (${sess})` : ''}: ${confirmedIn(s)} of ${s.people.length} confirmed`)
      for (const i of s.people) {
        lines.push(`  - ${i.card.name}, ${i.card.job_title}, ${i.card.organization}: ${OUTREACH_LABEL[i.outreach_status]}`
          + `${i.owner ? ` · owner ${i.owner}` : ''}${i.follow_up_date ? ` · follow up ${i.follow_up_date}` : ''}`)
      }
      lines.push('')
    }
    navigator.clipboard.writeText(lines.join('\n'))
    toast('Table copied as text')
  }

  return (
    <>
      <section className="page-head glance-head">
        <div className="container">
          <div className="crumbs"><Link to="/shortlist">Shortlist</Link> / <span>At a glance</span></div>
          <h1><Table size={26} style={{ verticalAlign: '-3px' }} /> {current?.name ?? ''} <span className="h1-conf">· shortlist at a glance</span></h1>
          <div className="glance-stats">
            <span><b>{items.length}</b> saved</span>
            <span><b>{panels.length}</b> panels</span>
            {OUTREACH.filter((o) => count(o.id) > 0).map((o) => (
              <span key={o.id} className={`os-badge os-${o.id}`}><i /> {count(o.id)} {o.label.toLowerCase()}</span>
            ))}
            {due > 0 && <span className="flag-chip fu-overdue"><Clock size={12} /> {due} follow-up{due === 1 ? '' : 's'} due</span>}
          </div>
          <div className="glance-actions">
            <button className="btn btn-outline btn-sm" onClick={copyTable} disabled={!items.length}><Copy size={15} /> Copy as text</button>
            <button className="btn btn-outline btn-sm" onClick={() => window.print()} disabled={!items.length}><Printer size={15} /> Print this table</button>
            <Link className="btn btn-primary btn-sm" to="/print/conference"><Printer size={15} /> Conference one-pager</Link>
          </div>
        </div>
      </section>

      <div className="container page-body">
        {items.length === 0 && panels.length === 0 ? (
          <div className="empty-state">
            <div className="big-icon"><Table size={30} /></div>
            <h2>Nothing on this conference's shortlist yet</h2>
            <p>Save speakers from a search and sort them into keynote and panel slots. They'll show up here as one tidy table.</p>
            <Link to="/" className="btn btn-primary">Find speakers</Link>
          </div>
        ) : (
          <>
          <div className="no-print"><ProgramBalance /></div>
          <div className="glance-table-wrap">
            <table className="glance-table">
              <thead>
                <tr>
                  <th>Speaker</th>
                  <th>Role & organization</th>
                  <th>Type</th>
                  <th>Outreach</th>
                  <th>Owner</th>
                  <th>Next follow-up</th>
                  <th>Last outreach</th>
                  <th>Checklist</th>
                </tr>
              </thead>
              {sections.map((s) => (
                <tbody key={s.key}>
                  <tr className={`glance-section ${s.group?.kind ?? 'unsorted'}`}>
                    <td colSpan={8}>
                      <div className="gs-row">
                        <span className="gs-icon">{s.group?.kind === 'keynote' ? <Mic size={15} /> : s.group ? <Users size={15} /> : null}</span>
                        <Link className="gs-title" to={`/shortlist?tab=${s.group ? s.group.id : 'unsorted'}`} title="Open this on the Shortlist">
                          <strong>{s.title}</strong> <ArrowRight size={13} />
                        </Link>
                        {s.group?.theme && <em>{s.group.theme}</em>}
                        <span className="gs-spacer" />
                        {sessionText(s.group) && <span className="gs-session">{sessionText(s.group)}</span>}
                        <span className={`gs-count ${s.people.length && confirmedIn(s) === s.people.length ? 'ok' : ''}`}>
                          {confirmedIn(s)} of {s.people.length} confirmed
                        </span>
                      </div>
                    </td>
                  </tr>
                  {s.people.length === 0 ? (
                    <tr><td colSpan={8} className="glance-empty">No one here yet.</td></tr>
                  ) : s.people.map((i) => {
                    const fu = followUpState(i.follow_up_date)
                    const done = CHECKLIST.filter((c) => i.checklist[c.id]).length
                    return (
                      <tr key={i.id}>
                        <td>
                          <button className="glance-person" onClick={() => openProfile(i.card, i.category, i.search_id)}>
                            <Avatar name={i.card.name} photo={i.card.photo_url} size={32} />
                            <span>{i.card.name}</span>
                          </button>
                        </td>
                        <td className="glance-role">{i.card.job_title}<small>{i.card.organization}</small></td>
                        <td><span className="tag">{CATEGORY_SHORT[i.category]}</span></td>
                        <td><span className={`os-badge os-${i.outreach_status}`} style={{ margin: 0 }}><i /> {OUTREACH_LABEL[i.outreach_status]}</span></td>
                        <td>{i.owner || <span className="glance-dim">—</span>}</td>
                        <td>
                          {i.follow_up_date
                            ? <span className={`flag-chip fu-${fu}`}><Clock size={11} /> {shortDate(i.follow_up_date)}{fu === 'overdue' ? ' · overdue' : fu === 'today' ? ' · today' : ''}</span>
                            : <span className="glance-dim">—</span>}
                        </td>
                        <td>{i.last_outreach_at ? shortDate(i.last_outreach_at) : <span className="glance-dim">—</span>}</td>
                        <td>
                          {i.outreach_status === 'confirmed'
                            ? <span className={`glance-check ${done === CHECKLIST.length ? 'ok' : ''}`}>{done}/{CHECKLIST.length}</span>
                            : <span className="glance-dim">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              ))}
            </table>
          </div>
          </>
        )}
      </div>
    </>
  )
}
