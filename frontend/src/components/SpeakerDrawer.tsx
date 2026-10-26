// Slide-over panel with everything we know about one speaker, every fact linked to a real page.
import { useEffect, useState } from 'react'
import { CATEGORY_LABEL } from '../lib/labels'
import { domain } from '../lib/format'
import type { Category, Link, SpeakerCard } from '../lib/types'
import Avatar from './Avatar'
import { CheckCircle, Doc, External, Person, Pin, Stage, X } from './Icons'
import PlanningPanel from './PlanningPanel'
import SpeakerChat from './SpeakerChat'
import SaveButton from './SaveButton'
import { useShortlist } from '../lib/shortlist'
import { OUTREACH_LABEL } from '../lib/labels'
import { followUpState, relativeDate, shortDate } from '../lib/format'
import { LevelBadge, RoleBadges, SpeakingBadge, TopicChips } from './SpeakerBadges'

const KIND_ICON: Record<Link['kind'], React.ReactNode> = {
  profile: <Person size={17} />,
  work: <Doc size={17} />,
  talk: <Stage size={17} />,
}
const KIND_LABEL: Record<Link['kind'], string> = { profile: 'Profile', work: 'Their work', talk: 'Speaking' }

interface Props {
  card: SpeakerCard
  category: Category
  searchId: string
  onClose: () => void
}

export default function SpeakerDrawer({ card, category, searchId, onClose }: Props) {
  const { has } = useShortlist()
  const item = has(card.name, category)
  const [tab, setTab] = useState<'profile' | 'planning'>('profile')
  const [notesVersion, setNotesVersion] = useState(0)
  const fu = item ? followUpState(item.follow_up_date) : null
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={card.name}>
        <div className="drawer-hero">
          <Avatar name={card.name} photo={card.photo_url} size={112} />
          <div>
            <span className="eyebrow">{CATEGORY_LABEL[category]}</span>
            <h2>{card.name}</h2>
            <p>{card.job_title}{card.organization ? ` · ${card.organization}` : ''}</p>
            {card.location && <p className="drawer-loc"><Pin size={14} /> {card.location}</p>}
            {item && (
              <p className="drawer-outreach">
                <span className={`os-badge os-${item.outreach_status}`}><i /> {OUTREACH_LABEL[item.outreach_status]}</span>
                {item.last_outreach_at && <span>Last outreach {relativeDate(item.last_outreach_at)}</span>}
                {item.follow_up_date && <span className={fu === 'overdue' || fu === 'today' ? 'fu-hot' : ''}>Follow up {shortDate(item.follow_up_date)}</span>}
                {item.owner && <span>Owner: {item.owner}</span>}
              </p>
            )}
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="drawer-actions">
          <SaveButton searchId={searchId} category={category} name={card.name} variant="button" />
          {card.profile_url && (
            <a className="btn btn-outline" href={card.profile_url} target="_blank" rel="noreferrer">
              <Person size={16} /> Open profile
            </a>
          )}
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <LevelBadge level={card.level} />
            <SpeakingBadge badge={card.speaking_badge} />
          </span>
        </div>

        <div className="drawer-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'profile'} className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}>
            <Person size={15} /> Profile
          </button>
          <button role="tab" aria-selected={tab === 'planning'} className={tab === 'planning' ? 'on' : ''} onClick={() => setTab('planning')}>
            <Doc size={15} /> Planning, outreach & notes
            {item && <span className={`os-dot os-${item.outreach_status}`} />}
            {(fu === 'overdue' || fu === 'today') && <span className="tab-alert">!</span>}
          </button>
        </div>

        {tab === 'planning' ? (
          <div className="drawer-body">
            {item ? <PlanningPanel item={item} notesVersion={notesVersion} /> : (
              <div className="empty-cat">
                Save {card.name} to your shortlist to start tracking outreach: status, follow-ups, an outreach log, a drafted invitation email and the confirmed-speaker checklist.
                <div style={{ marginTop: 12 }}><SaveButton searchId={searchId} category={category} name={card.name} variant="button" /></div>
              </div>
            )}
          </div>
        ) : (
        <div className="drawer-body">
          {card.topic_tags.length > 0 && (
            <section className="d-section">
              <h3>Known for</h3>
              <TopicChips tags={card.topic_tags} max={8} />
            </section>
          )}

          <section className="d-section">
            <h3>Could speak on</h3>
            <div className="speak-on-box">{card.could_speak_on}</div>
          </section>

          <section className="d-section">
            <h3>About</h3>
            <p>{card.bio}</p>
          </section>

          <section className="d-section">
            <h3>Why they fit</h3>
            <p>{card.why_fit}</p>
          </section>

          {card.talk_ideas.length > 0 && (
            <section className="d-section">
              <h3>Talk ideas</h3>
              <ul className="bullets">{card.talk_ideas.map((t) => <li key={t}>{t}</li>)}</ul>
            </section>
          )}

          <section className="d-section">
            <h3>Has spoken before</h3>
            {card.past_speaking.length > 0 ? (
              <ul className="talk-list">
                {card.past_speaking.map((s) => (
                  <li key={s.url + s.event}>
                    <span className="talk-year">{s.year ?? '—'}</span>
                    <span>
                      <a href={s.url} target="_blank" rel="noreferrer">{s.event}</a>
                      <small>{domain(s.url)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--muted)' }}>No past talks were found with a link. That doesn't mean they haven't spoken.</p>
            )}
          </section>

          <section className="d-section">
            <h3>Best suited for</h3>
            <div className="tag-row"><RoleBadges roles={card.best_for} /></div>
          </section>

          {card.credentials.length > 0 && (
            <section className="d-section">
              <h3>Credentials</h3>
              <div className="tag-row">{card.credentials.map((c) => <span key={c} className="tag">{c}</span>)}</div>
            </section>
          )}

          {card.notable_work.length > 0 && (
            <section className="d-section">
              <h3>Notable work</h3>
              <ul className="bullets">{card.notable_work.map((w) => <li key={w}>{w}</li>)}</ul>
            </section>
          )}

          <section className="d-section">
            <h3>Links</h3>
            <ul className="link-list">
              {card.links.map((l) => (
                <li key={l.url}>
                  <a className="link-row" href={l.url} target="_blank" rel="noreferrer">
                    <span className="link-kind">{KIND_ICON[l.kind]}</span>
                    <span>
                      <strong>{l.label}</strong>
                      <small>{KIND_LABEL[l.kind]} · {domain(l.url)}</small>
                    </span>
                    <External size={15} className="ext" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="d-section">
            <h3>Fit for your brief</h3>
            <div className="fit-box">
              <span className="fit-score">{card.fit_score}<small>/5</small></span>
              <p style={{ margin: 0 }}>{card.fit_reason}</p>
            </div>
          </section>

          <section className="d-section">
            <h3>How we checked</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
              <CheckCircle size={14} color="var(--good)" style={{ verticalAlign: '-2px' }} /> Confirmed on{' '}
              {card.evidence_urls.length || card.links.length} page(s) read during this search
              {card.evidence_urls.length > 0 && <>: {card.evidence_urls.slice(0, 3).map(domain).join(', ')}</>}.
              Every link above was really found, not generated.
            </p>
          </section>
        </div>
        )}

        <SpeakerChat card={card} category={category} searchId={searchId} item={item} onSaved={() => setNotesVersion((v) => v + 1)} />
      </aside>
    </>
  )
}
