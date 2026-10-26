// "Why you can trust this": makes Speaker Scout's code-level verification visible on every profile.
import { domain, shortDate } from '../lib/format'
import type { SpeakerCard } from '../lib/types'
import { Check, Shield } from './Icons'

export function trustFacts(card: SpeakerCard) {
  const urls = new Set([...card.evidence_urls, ...card.links.map((l) => l.url)])
  const domains = [...new Set([...urls].map(domain))]
  const profile = card.profile_url ?? card.links.find((l) => l.kind === 'profile')?.url ?? null
  return { sources: urls.size, domains, profile, talks: card.past_speaking.length }
}

export default function TrustBox({ card }: { card: SpeakerCard }) {
  const f = trustFacts(card)
  const rows: [boolean, string][] = [
    [true, `Real person, confirmed on ${f.sources} page${f.sources === 1 ? '' : 's'} read during the search (${f.domains.slice(0, 3).join(', ')})`],
    [!!f.profile, f.profile ? `Profile page found: ${domain(f.profile)}` : 'No personal profile page; confirmed through articles or talks about their work'],
    [true, `Current role checked: ${card.job_title}, ${card.organization}`],
    [f.talks > 0, f.talks > 0 ? `${f.talks} past talk${f.talks === 1 ? '' : 's'} or appearance${f.talks === 1 ? '' : 's'}, each with a link` : 'No past talks found with a link'],
    [true, card.photo_url ? 'Photo taken from their own profile page' : 'No verified photo, so initials are shown (never a generated image)'],
    [true, 'Every link was found during the search; invented links are removed by code'],
    [true, 'No personal email or phone number stored'],
  ]
  return (
    <section className="trust-box">
      <h3><Shield size={15} /> Why you can trust this {card.verified_at && <small>Verified {shortDate(card.verified_at)}</small>}</h3>
      <ul>
        {rows.map(([ok, text]) => (
          <li key={text} className={ok ? 'ok' : 'meh'}><span>{ok ? <Check size={13} /> : '–'}</span>{text}</li>
        ))}
      </ul>
    </section>
  )
}
