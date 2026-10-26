// "What's new": a team activity feed for the current conference: who added which speakers, outreach updates,
// panel changes, searches run. Items since your last visit are highlighted.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Chat, Clock, Folder, Search, Sparkle, Users } from '../components/Icons'
import { api, type ActivityItem } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useConference } from '../lib/conference'
import { relativeDate } from '../lib/format'

const ICON: Record<string, React.ReactNode> = {
  search: <Search size={14} />, shortlist: <Bookmark size={14} />, outreach: <Chat size={14} />, panel: <Users size={14} />,
  notes: <Chat size={14} />, review: <Sparkle size={14} />, conference: <Folder size={14} />,
}

export const lastSeenKey = (team: string, conf: number | null) => `speakerScout.lastSeen.${team}.${conf ?? 'all'}`

export default function Activity() {
  const { current, currentId } = useConference()
  const { team } = useAuth()
  const [items, setItems] = useState<ActivityItem[] | null>(null)
  const [since] = useState(() => localStorage.getItem(lastSeenKey(team, currentId)) ?? '')

  useEffect(() => {
    if (!currentId) return
    api.activity(currentId).then((a) => {
      setItems(a)
      localStorage.setItem(lastSeenKey(team, currentId), new Date().toISOString())
      window.dispatchEvent(new Event('speakerScout:seen'))
    }).catch(() => setItems([]))
  }, [currentId, team])

  const fresh = (i: ActivityItem) => !!since && i.ts > since

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Team activity · {current?.name}</span>
          <h1>What's new</h1>
          <p className="lead">Everything your team has done in this conference: speakers added, outreach updates, panels changed, searches run. New since your last visit is highlighted.</p>
        </div>
      </section>
      <div className="container page-body">
        {!items ? <div className="center-load"><span className="spinner spinner-dark" /></div> : items.length === 0 ? (
          <div className="empty-state">
            <div className="big-icon"><Clock size={30} /></div>
            <h2>Nothing yet</h2>
            <p>When anyone on your team runs a search, saves a speaker or updates outreach, it shows up here.</p>
            <Link to="/" className="btn btn-primary">Find speakers</Link>
          </div>
        ) : (
          <ol className="activity-list">
            {items.map((i) => (
              <li key={i.id} className={fresh(i) ? 'fresh' : ''}>
                <span className={`act-icon act-${i.kind}`}>{ICON[i.kind] ?? <Clock size={14} />}</span>
                <div>
                  <p><strong>{i.actor || 'Someone'}</strong> {i.text}</p>
                  <small>{relativeDate(i.ts)} · {new Date(i.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{fresh(i) && <span className="act-new">New</span>}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  )
}
