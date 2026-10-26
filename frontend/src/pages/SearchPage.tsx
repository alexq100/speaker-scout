import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BriefDetails from '../components/BriefDetails'
import { Refresh } from '../components/Icons'
import ResultsView from '../components/ResultsView'
import RunProgress from '../components/RunProgress'
import { api } from '../lib/api'
import { useConference } from '../lib/conference'
import { useToast } from '../components/Toast'
import { relativeDate } from '../lib/format'
import type { SearchResult } from '../lib/types'

export default function SearchPage() {
  const { id = '' } = useParams()
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { current, currentId, conferences, select } = useConference()
  const toast = useToast()

  // Opening a search switches to its conference, so bookmarks go to that conference's shortlist.
  useEffect(() => {
    if (!currentId || !id) return
    api.searchConference(id).then(({ conference_id }) => {
      if (conference_id !== currentId) {
        select(conference_id)
        const name = conferences.find((c) => c.id === conference_id)?.name
        if (name) toast(`Switched to the "${name}" conference`)
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const load = useCallback(async () => {
    try {
      setResult(await api.search(id))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [id])

  // Poll while the search runs.
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (result?.status !== 'running') return
    const t = window.setInterval(load, 1500)
    return () => window.clearInterval(t)
  }, [result?.status, load])

  async function stop() {
    if (!window.confirm('Stop this search? Anything already verified will be kept.')) return
    try {
      await api.stop(id)
    } catch {
      /* it may have just finished */
    }
    load()
  }

  if (error && !result) {
    return (
      <div className="container page-body">
        <div className="alert alert-error">{error}</div>
        <p style={{ marginTop: 16 }}><Link to="/">← Start a new search</Link></p>
      </div>
    )
  }
  if (!result) {
    return <div className="center-load"><span className="spinner spinner-dark" /> Loading search…</div>
  }

  const b = result.brief
  return (
    <>
      <section className="page-head">
        <div className="container">
          <div className="crumbs"><Link to="/searches">{current?.name ?? 'Past searches'}</Link> / <span>{b.conference_name ?? 'Search'}</span></div>
          <h1>{b.looking_for === 'panel' && b.panel_theme ? b.panel_theme : b.conference_theme}</h1>
          <p className="lead">
            {b.looking_for === 'panel' && b.panel_theme ? <>Panel for <em>{b.conference_theme}</em> · </> : null}
            {result.status === 'running' ? 'Searching now' : `Searched ${relativeDate(result.created_at)}`}
          </p>
          <BriefDetails brief={b} />
        </div>
      </section>

      <div className="container page-body">
        {result.status === 'running' && <RunProgress result={result} onStop={stop} />}
        {result.status === 'error' && (
          <div className="alert alert-error" style={{ marginBottom: 24 }}>
            The search hit a problem: {result.error}. <Link to="/">Try again</Link>
          </div>
        )}
        {result.status === 'stopped' && (
          <div className="alert alert-warn" style={{ marginBottom: 24 }}>
            {result.error ?? 'This search was stopped.'} Showing anything that was verified before it stopped.
          </div>
        )}
        {result.status !== 'running' && (
          <>
            <ResultsView result={result} onUpdate={setResult} />
            <p style={{ marginTop: 30, textAlign: 'center' }}>
              <Link to="/" className="btn btn-outline"><Refresh size={16} /> Start another search</Link>
            </p>
          </>
        )}
      </div>
    </>
  )
}
