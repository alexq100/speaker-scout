import { LEVEL_LABEL, ROLE_LABEL, SPEAKING_LABEL } from '../lib/labels'
import type { SpeakerCard } from '../lib/types'
import { Mic } from './Icons'

export function LevelBadge({ level }: { level: SpeakerCard['level'] }) {
  return <span className={`badge badge-level-${level}`}>{LEVEL_LABEL[level]}</span>
}

export function SpeakingBadge({ badge }: { badge: SpeakerCard['speaking_badge'] }) {
  return (
    <span className={`badge badge-speak-${badge}`} title="Based on past talks, panels, podcasts or webinars found with links">
      <Mic size={12} /> {SPEAKING_LABEL[badge]}
    </span>
  )
}

export function RoleBadges({ roles }: { roles: SpeakerCard['best_for'] }) {
  return (
    <>
      {roles.map((r) => (
        <span key={r} className="badge badge-role">{ROLE_LABEL[r]}</span>
      ))}
    </>
  )
}

export function FitDots({ score }: { score: number }) {
  return (
    <span className="fit" title={`Fit: ${score} of 5`} aria-label={`Fit ${score} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= score ? 'on' : ''} />)}
    </span>
  )
}

export function TopicChips({ tags, max = 6 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null
  return (
    <ul className="topic-chips" aria-label="Topics">
      {tags.slice(0, max).map((t) => <li key={t}>{t}</li>)}
    </ul>
  )
}
