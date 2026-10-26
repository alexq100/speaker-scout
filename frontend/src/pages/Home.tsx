import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BriefForm from '../components/BriefForm'
import { CheckCircle, Mic } from '../components/Icons'
import { useToast } from '../components/Toast'
import { api } from '../lib/api'
import { useConference } from '../lib/conference'
import type { Category, Options, SearchBrief } from '../lib/types'

// Illustrative cards for the hero (not real search results).
const DECK = [
  { name: 'Academic Researcher', title: 'Professor of Urban Ecology', badge: 'Experienced speaker', tag: 'ACADEMIC' },
  { name: 'Policy Leader', title: 'Chief Resilience Officer, a US city', badge: 'Panelist · Keynote', tag: 'POLICY' },
  { name: 'Founder Voice', title: 'Founder & CEO, circular startup', badge: 'Has spoken', tag: 'FOUNDER' },
]

export default function Home() {
  const [options, setOptions] = useState<Options | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const { current, currentId } = useConference()

  useEffect(() => {
    api.options().then(setOptions).catch((e) => setError(e.message))
  }, [])

  async function start(brief: SearchBrief) {
    setBusy(true)
    setError(null)
    try {
      const { id, reused } = await api.startSearch(brief, currentId)
      if (reused) toast('You searched this recently, so here are the saved results (no new cost).')
      navigate(`/search/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="pill pill-light"><Mic size={13} /> For conference planning teams</span>
            <h1>Find the right voices for your <em>conference</em>.</h1>
            <p className="lead">
              Describe your event. A team of AI scouts searches the live web for academics, practitioners, policy leaders,
              founders, advocates and journalists, then checks every person against real sources.
            </p>
            <ul className="hero-points">
              <li><CheckCircle size={16} /> Real people, real links</li>
              <li><CheckCircle size={16} /> Past talks surfaced</li>
              <li><CheckCircle size={16} /> Keynotes or full panels</li>
            </ul>
          </div>
          <div className="hero-deck" aria-hidden="true">
            {DECK.map((d) => (
              <div className="deck-card" key={d.name}>
                <Avatar name={d.name} size={54} />
                <div>
                  <span className="eyebrow" style={{ fontSize: '.62rem' }}>{d.tag}</span>
                  <strong>{d.name}</strong>
                  <small>{d.title}</small>
                  <span className="badge badge-speak-experienced">{d.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container brief-wrap">
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        <BriefForm key={`${currentId ?? 0}-${params.toString()}`} options={options} busy={busy} onSubmit={start} initialTheme={params.get('theme') ?? ''}
          initialNotes={params.get('notes') ?? ''} initialSkip={params.get('skip') ?? ''}
          initialCategories={(params.get('cats') ?? '').split(',').filter(Boolean) as Category[]}
          conference={current} />

        <div className="how-strip">
          <div className="how-step">
            <span className="eyebrow">Step 1 · Scout Lead</span>
            <h3>Plans the search</h3>
            <p>Turns your brief into search angles for each kind of speaker.</p>
          </div>
          <div className="how-step">
            <span className="eyebrow">Step 2 · Six scouts</span>
            <h3>Search the live web</h3>
            <p>One scout per category, all at once, looking at speaker lists, profiles and news.</p>
          </div>
          <div className="how-step">
            <span className="eyebrow">Step 3 · Verifiers</span>
            <h3>Check every person</h3>
            <p>Read each person's pages, confirm their role, and drop anyone who can't be confirmed.</p>
          </div>
          <div className="how-step">
            <span className="eyebrow">Step 4 · You</span>
            <h3>Shortlist and share</h3>
            <p>Save the best fits with notes, then copy the list for your team.</p>
          </div>
        </div>
      </section>
    </>
  )
}
