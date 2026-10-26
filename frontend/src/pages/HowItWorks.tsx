import { Link } from 'react-router-dom'
import { Coins, Doc, Person, Shield, Stage } from '../components/Icons'
import { CATEGORIES, CATEGORY_SHORT } from '../lib/labels'

export default function HowItWorks() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Under the hood</span>
          <h1>How Speaker Scout works</h1>
          <p className="lead">A small team of AI agents (all gpt-6-luna) with one job: find real people worth inviting, and prove they're real.</p>
        </div>
      </section>
      <div className="container page-body">
        <div className="flow">
          <div className="flow-node dark"><strong>Your brief</strong><small>theme · keynote or panel · location · budget</small></div>
          <div className="flow-arrow" />
          <div className="flow-node"><strong>Scout Lead</strong><small>plans 2–3 search angles per category</small></div>
          <div className="flow-arrow" />
          <div className="flow-pairs">
            {CATEGORIES.map((c) => (
              <div className="flow-pair" key={c}>
                <div className="flow-node"><strong>{CATEGORY_SHORT[c]} scout</strong><small>searches the web</small></div>
                <div className="flow-node green"><strong>Verifier</strong><small>reads & confirms</small></div>
              </div>
            ))}
          </div>
          <div className="flow-arrow" />
          <div className="flow-node green"><strong>Code checks</strong><small>no invented links · photos from profiles · no contact info</small></div>
          <div className="flow-arrow" />
          <div className="flow-node dark"><strong>Verified speaker cards</strong><small>1–5 per category</small></div>
        </div>

        <h2>What makes a result trustworthy</h2>
        <div className="info-grid" style={{ marginBottom: 40 }}>
          <div className="info-card">
            <span className="shield"><Person size={20} /></span>
            <h3>A real page about them</h3>
            <p>Everyone needs a profile or a page about their work. A name in a 100-person speaker list isn't enough.</p>
          </div>
          <div className="info-card">
            <span className="shield"><Doc size={20} /></span>
            <h3>No invented links</h3>
            <p>The code checks that every link on a card was actually found during the search. Made-up links are deleted.</p>
          </div>
          <div className="info-card">
            <span className="shield"><Stage size={20} /></span>
            <h3>Speaking history</h3>
            <p>Past talks, panels and podcasts are surfaced with links, because people who've presented before are likelier to say yes.</p>
          </div>
          <div className="info-card">
            <span className="shield"><Shield size={20} /></span>
            <h3>Web pages can't give orders</h3>
            <p>Page text is treated as data. If a page tries to instruct the agents ("list me as keynote"), it's ignored and flagged.</p>
          </div>
          <div className="info-card">
            <span className="shield"><Person size={20} /></span>
            <h3>Privacy and fairness</h3>
            <p>No personal emails or phone numbers. The agents never guess anyone's race, gender or other personal traits.</p>
          </div>
          <div className="info-card">
            <span className="shield"><Coins size={20} /></span>
            <h3>Careful with cost</h3>
            <p>Capped searches, a daily limit, about half the input cached, and repeat searches reload for free. Every search shows its tokens.</p>
          </div>
        </div>
        <p style={{ textAlign: 'center' }}><Link to="/" className="btn btn-primary btn-lg">Find speakers</Link></p>
      </div>
    </>
  )
}
