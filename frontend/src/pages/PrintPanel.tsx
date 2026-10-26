// Committee one-pager for one panel (or the keynote slot): print-ready, one page.
import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { ArrowRight, Printer } from '../components/Icons'
import { TopicChips } from '../components/SpeakerBadges'
import { useConference } from '../lib/conference'
import { shortDate } from '../lib/format'
import { CATEGORY_SHORT, LEVEL_LABEL, OUTREACH_LABEL, SPEAKING_LABEL } from '../lib/labels'
import { useShortlist } from '../lib/shortlist'

export default function PrintPanel() {
  const { id } = useParams()
  const { items, groups } = useShortlist()
  const { current } = useConference()
  const group = groups.find((g) => String(g.id) === id)
  if (!group) return <div className="container page-body"><p>Loading… (or this panel is in another conference.)</p><Link to="/shortlist">Back to shortlist</Link></div>
  const people = items.filter((i) => i.group_id === group.id)
  const session = [group.session_date ? shortDate(group.session_date) : '', group.session_time, group.session_room].filter(Boolean).join(' · ')
  const confirmed = people.filter((p) => p.outreach_status === 'confirmed').length

  return (
    <div className="print-wrap">
      <div className="print-toolbar no-print">
        <Link to={`/shortlist?tab=${group.id}`} className="btn btn-ghost btn-sm">← Back to {group.name}</Link>
        <span className="header-spacer" />
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={15} /> Print / save as PDF</button>
      </div>
      <article className="one-pager">
        <header className="op-head">
          <span className="op-conf">{current?.name} · {group.kind === 'keynote' ? 'Keynote' : 'Panel'} proposal</span>
          <h1>{group.name}</h1>
          {group.theme && <p className="op-theme">“{group.theme}”</p>}
          <p className="op-meta">
            {session || 'Session time to be set'} · {people.length} {people.length === 1 ? 'speaker' : 'speakers'} · {confirmed} confirmed
          </p>
        </header>
        <div className={`op-grid ${people.length <= 2 ? 'op-grid-1' : ''}`}>
          {people.map((p) => {
            const c = p.card
            const isMod = p.note.toLowerCase().startsWith('suggested moderator')
            const angle = (isMod ? p.note.replace(/^suggested moderator\.?\s*/i, '') : p.note) || c.why_fit
            return (
              <section key={p.id} className="op-person">
                <div className="op-person-head">
                  <Avatar name={c.name} photo={c.photo_url} size={50} />
                  <div>
                    <h2>{c.name}{isMod && <span className="op-mod">Moderator</span>}</h2>
                    <p className="op-role">{c.job_title}, {c.organization}</p>
                    <p className="op-small">{CATEGORY_SHORT[p.category]} · {LEVEL_LABEL[c.level]} · {SPEAKING_LABEL[c.speaking_badge]}{c.location ? ` · ${c.location}` : ''} · <b>{OUTREACH_LABEL[p.outreach_status]}</b></p>
                  </div>
                </div>
                <TopicChips tags={c.topic_tags} max={5} />
                <p className="op-bio">{c.bio}</p>
                <p className="op-why"><ArrowRight size={11} /> <b>Why on this {group.kind === 'keynote' ? 'stage' : 'panel'}:</b> {angle}</p>
              </section>
            )
          })}
        </div>
        {people.length === 0 && <p className="op-small">No speakers on this panel yet.</p>}
        <footer className="op-foot">
          Prepared with Speaker Scout · {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} ·
          Every speaker was verified against public web pages; outreach status as of today.
        </footer>
      </article>
    </div>
  )
}
