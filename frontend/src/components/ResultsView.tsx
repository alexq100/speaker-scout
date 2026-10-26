// Finished search: headline numbers, a jump bar, then one section of speaker cards per category.
import { CATEGORY_BLURB, CATEGORY_LABEL } from '../lib/labels'
import { cachedShare, compact, seconds } from '../lib/format'
import { useOpenProfile } from '../lib/drawer'
import type { SearchResult } from '../lib/types'
import ChecksPanel from './ChecksPanel'
import SpeakerCard from './SpeakerCard'
import SuggestedPanels from './SuggestedPanels'

export default function ResultsView({ result, onUpdate }: { result: SearchResult; onUpdate: (r: SearchResult) => void }) {
  const openProfile = useOpenProfile()
  const total = result.categories.reduce((s, c) => s + c.cards.length, 0)
  const u = result.usage

  return (
    <>
      <div className="stats">
        <div className="stat stat-hero">
          <span className="stat-value">{total}</span>
          <span className="stat-label">verified speakers</span>
        </div>
        <div className="stat">
          <span className="stat-value">{result.categories.filter((c) => c.cards.length).length}<small style={{ fontSize: '1rem', color: 'var(--faint)' }}>/{result.categories.length}</small></span>
          <span className="stat-label">categories with matches</span>
        </div>
        <div className="stat">
          <span className="stat-value">{seconds(result.seconds)}</span>
          <span className="stat-label">search time</span>
        </div>
        <div className="stat" title={`${u.input_tokens.toLocaleString()} input (${u.cached_input_tokens.toLocaleString()} cached) + ${u.output_tokens.toLocaleString()} output tokens across ${u.model_calls} model calls`}>
          <span className="stat-value">{compact(u.input_tokens + u.output_tokens)}</span>
          <span className="stat-label">tokens · {cachedShare(u.input_tokens, u.cached_input_tokens)}% cached input</span>
        </div>
        <div className="stat">
          <span className="stat-value">{u.cost_usd != null ? (u.cost_usd < 0.1 ? `$${u.cost_usd.toFixed(3)}` : `$${u.cost_usd.toFixed(2)}`) : '—'}</span>
          <span className="stat-label">{u.cost_usd != null ? 'model cost (gpt-6-luna)' : 'cost (price not set)'}</span>
        </div>
      </div>

      <SuggestedPanels result={result} onUpdate={onUpdate} onOpen={(name, category) => {
        const cr = result.categories.find((c) => c.category === category)
        const card = cr?.cards.find((c) => c.name === name)
        if (card && cr) openProfile(card, cr.category, result.id)
      }} />

      <nav className="jump-bar" aria-label="Jump to category">
        <ul>
          {result.panels.length > 0 && (
            <li><a href="#suggested-panels">Suggested panels <span className="count">{result.panels.length}</span></a></li>
          )}
          {result.categories.map((c) => (
            <li key={c.category}>
              <a href={`#cat-${c.category}`}>{c.label} <span className="count">{c.cards.length}</span></a>
            </li>
          ))}
        </ul>
      </nav>

      {result.categories.map((c) => (
        <section key={c.category} id={`cat-${c.category}`} className="cat-section">
          <div className="cat-head">
            <div>
              <span className="eyebrow">{c.cards.length} verified</span>
              <h2>{CATEGORY_LABEL[c.category]}</h2>
              <p>{CATEGORY_BLURB[c.category]}</p>
            </div>
            <div className="cat-meta">
              {c.candidates_found} found · {c.dropped.length} dropped<br />{seconds(c.seconds)}
            </div>
          </div>
          {c.cards.length > 0 ? (
            <div className="speaker-grid">
              {c.cards.map((card, i) => (
                <SpeakerCard key={card.name} card={card} category={c.category} searchId={result.id} index={i}
                  onOpen={() => openProfile(card, c.category, result.id)} />
              ))}
            </div>
          ) : (
            <div className="empty-cat">
              {c.error ? `This scout ran into a problem: ${c.error}` : 'No one in this category passed every check this time. Try a broader theme, or widen the reach under More options.'}
            </div>
          )}
        </section>
      ))}

      <ChecksPanel result={result} />

    </>
  )
}
