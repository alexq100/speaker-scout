import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Folder, Search } from '../components/Icons'
import { useToast } from '../components/Toast'
import { api } from '../lib/api'
import { useConference } from '../lib/conference'
import { compact, relativeDate, seconds } from '../lib/format'
import { LOOKING_FOR } from '../lib/labels'
import type { SavedSearch } from '../lib/types'

export default function History() {
  const { current, currentId, conferences, ready, refresh: refreshConferences } = useConference()
  const toast = useToast()
  const [rows, setRows] = useState<SavedSearch[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!ready) return
    setRows(null)
    api.searches(currentId).then(setRows).catch((e) => setError(e.message))
  }, [currentId, ready])

  useEffect(() => {
    load()
  }, [load])

  async function moveTo(r: SavedSearch, conferenceId: number) {
    await api.moveSearch(r.id, conferenceId)
    const name = conferences.find((c) => c.id === conferenceId)?.name
    toast(`Moved to "${name}"`)
    setRows((prev) => prev?.filter((x) => x.id !== r.id) ?? null)
    refreshConferences()
  }

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Saved automatically · {current?.name ?? ''}</span>
          <h1>Past searches{current ? <span className="h1-conf"> · {current.name}</span> : null}</h1>
          <p className="lead">Every search is saved under the conference you were working on. Reopen any of them at no extra cost, or file one under a different conference.</p>
        </div>
      </section>
      <div className="container page-body">
        {error && <div className="alert alert-error">{error}</div>}
        {!rows && !error && <div className="center-load"><span className="spinner spinner-dark" /></div>}
        {rows && rows.length === 0 && (
          <div className="empty-state">
            <div className="big-icon"><Clock size={30} /></div>
            <h2>No searches in this conference yet</h2>
            <p>Searches you run while "{current?.name}" is selected will show up here. You can also move a search here from another conference.</p>
            <Link to="/" className="btn btn-primary"><Search size={16} /> Start a search</Link>
          </div>
        )}
        {rows && rows.length > 0 && (
          <div className="history-list">
            {rows.map((r) => (
              <div key={r.id} className="history-row">
                <Link to={`/search/${r.id}`} className="history-main">
                  <span className="eyebrow">{LOOKING_FOR.find((l) => l.id === r.looking_for)?.label}{r.conference_name ? ` · ${r.conference_name}` : ''}</span>
                  <h3>{r.panel_theme ?? r.conference_theme}</h3>
                  <small>{relativeDate(r.created_at)} · {r.categories_label}{r.location ? ` · ${r.location}` : ''}{r.status !== 'done' ? ` · ${r.status}` : ''}</small>
                </Link>
                <div className="history-num"><b>{r.speakers}</b><span>speakers</span></div>
                <div className="history-num"><b>{seconds(r.seconds)}</b><span>time</span></div>
                <div className="history-num"><b>{compact(r.input_tokens + r.output_tokens)}</b><span>tokens</span></div>
                {conferences.length > 1 && (
                  <label className="history-move" title="File this search under another conference">
                    <Folder size={14} />
                    <select className="select" value="" onChange={(e) => e.target.value && moveTo(r, Number(e.target.value))}>
                      <option value="">Move to…</option>
                      {conferences.filter((c) => c.id !== currentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
