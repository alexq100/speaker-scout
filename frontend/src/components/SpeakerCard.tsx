// One speaker, styled like a HW4 product card: photo (or monogram) on top, details below.
import { useState } from 'react'
import { CATEGORY_SHORT } from '../lib/labels'
import { initials } from '../lib/format'
import type { Category, SpeakerCard as Card } from '../lib/types'
import { ArrowRight, CheckCircle, Pin } from './Icons'
import SaveButton from './SaveButton'
import { FitDots, LevelBadge, RoleBadges, SpeakingBadge, TopicChips } from './SpeakerBadges'

interface Props {
  card: Card
  category: Category
  searchId: string
  index: number
  onOpen: () => void
}

export default function SpeakerCard({ card, category, searchId, index, onOpen }: Props) {
  const [broken, setBroken] = useState(false)
  const sources = new Set([...card.evidence_urls, ...card.links.map((l) => l.url)]).size
  return (
    <article className="speaker-card" style={{ animationDelay: `${index * 60}ms` }}>
      <button className="card-media" onClick={onOpen} aria-label={`Open ${card.name}`}>
        {card.photo_url && !broken ? (
          <img src={card.photo_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <span className="card-monogram">{initials(card.name)}</span>
        )}
        <span className="level-ribbon"><LevelBadge level={card.level} /></span>
      </button>
      <SaveButton searchId={searchId} category={category} name={card.name} />
      <div className="card-body">
        <span className="eyebrow">{CATEGORY_SHORT[category]}</span>
        <h3 className="card-name"><button className="name-btn" onClick={onOpen}>{card.name}</button></h3>
        <div className="card-title">{card.job_title}{card.organization ? `, ${card.organization}` : ''}</div>
        {card.location && <div className="card-loc"><Pin size={12} /> {card.location}</div>}
        <TopicChips tags={card.topic_tags} max={5} />
        <p className="card-speak-on">{card.could_speak_on}</p>
        <div className="card-badges">
          <SpeakingBadge badge={card.speaking_badge} />
          <RoleBadges roles={card.best_for} />
        </div>
        <div className="card-foot">
          <span className="verified" title="Confirmed on real pages during this search">
            <CheckCircle size={15} /> Verified · {sources} source{sources === 1 ? '' : 's'}
          </span>
          <FitDots score={card.fit_score} />
        </div>
        <button className="card-more" onClick={onOpen} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
          Full profile <ArrowRight size={14} />
        </button>
      </div>
    </article>
  )
}
