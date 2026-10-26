import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useShortlist } from '../lib/shortlist'
import { Mic } from './Icons'

export default function SiteFooter() {
  const navigate = useNavigate()
  const { refresh } = useShortlist()

  async function startOver() {
    const typed = window.prompt(
      'Start over clears your team\'s conferences, saved searches, shortlists and panels.\n\nType "start over" to confirm.',
    )
    if (typed?.trim().toLowerCase() !== 'start over') return
    try {
      await api.reset()
      await refresh()
      navigate('/')
    } catch (e) {
      window.alert((e as Error).message)
    }
  }

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" className="brand">
              <span className="brand-mark"><Mic size={20} color="#fff" /></span>
              <span>
                <span className="brand-name">Speaker Scout</span>
                <span className="brand-sub">Conference speaker search</span>
              </span>
            </Link>
            <p>
              A team of AI agents that searches the live web for real people who could speak at your conference,
              and checks every one against real sources.
            </p>
          </div>
          <div>
            <h4>Every speaker is checked</h4>
            <ul>
              <li>Real people found on real pages only</li>
              <li>A profile or work page for everyone</li>
              <li>Photos only from their own profile</li>
              <li>No personal contact details</li>
            </ul>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              <li><Link to="/">Find speakers</Link></li>
              <li><Link to="/shortlist">Your shortlist</Link></li>
              <li><Link to="/searches">Past searches</Link></li>
              <li><Link to="/how-it-works">How it works</Link></li>
              <li><button className="footer-link" onClick={startOver}>Start over…</button></li>
            </ul>
          </div>
        </div>
        <div className="footer-base">
          <span>Built for MGT 409 · AI Foundations for Managers · Yale SOM</span>
          <span>Agents run on gpt-6-luna. Results are suggestions to review, not confirmed bookings.</span>
        </div>
      </div>
    </footer>
  )
}
