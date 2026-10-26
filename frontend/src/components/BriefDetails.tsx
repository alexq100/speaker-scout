// "What you searched for": every field of the brief, so a saved search always shows what it was asked to do.
import { BUDGET, CATEGORIES, CATEGORY_LABEL, CONFERENCE_TYPES, LEVEL_CHOICES, LOOKING_FOR, PRIORITIES, REACH } from '../lib/labels'
import type { SearchBrief } from '../lib/types'
import { Check, ChevronDown } from './Icons'

export function categoriesSummary(b: SearchBrief): string {
  if (b.categories.length === CATEGORIES.length) return 'All 6 categories'
  if (b.categories.length === 1) return `${CATEGORY_LABEL[b.categories[0]]} only`
  return `${b.categories.length} of 6 categories`
}

export default function BriefDetails({ brief: b }: { brief: SearchBrief }) {
  const rows: [string, React.ReactNode][] = []
  if (b.conference_name) rows.push(['Conference', b.conference_name])
  rows.push(['Conference theme', b.conference_theme])
  rows.push(['Looking for', LOOKING_FOR.find((l) => l.id === b.looking_for)?.label + (b.looking_for === 'panel' ? ` · ${b.panel_size} people` : '')])
  if (b.looking_for === 'panel' && b.panel_theme) rows.push(['Panel theme', b.panel_theme])
  if (b.conference_type) rows.push(['Type / audience', CONFERENCE_TYPES.find((t) => t.id === b.conference_type)?.label])
  rows.push(['Location & reach', `${b.location ? b.location + ' · ' : ''}${REACH.find((r) => r.id === b.reach)?.label}`])
  if (b.budget) rows.push(['Speaker budget', BUDGET.find((x) => x.id === b.budget)?.label])
  if (b.industries?.length) rows.push(['Industry areas', b.industries.join(' · ')])
  rows.push(['Speaker level', b.levels?.length ? b.levels.map((l) => LEVEL_CHOICES.find((x) => x.id === l)?.label).join(' · ') : 'Decide for me'])
  if (b.prioritize.length) rows.push(['Prioritize', b.prioritize.map((p) => PRIORITIES.find((x) => x.id === p)?.label).join(' · ')])
  if (b.skip_names.length) rows.push(['Skipped', b.skip_names.join(', ')])
  if (b.conference_goals) rows.push(['Conference goals', `“${b.conference_goals}”`])
  if (b.ideal_candidate) rows.push(['Ideal candidate', `“${b.ideal_candidate}”`])
  if (b.notes) rows.push(['Notes', `“${b.notes}”`])

  const partial = b.categories.length < CATEGORIES.length
  return (
    <details className="brief-details" open>
      <summary>
        <span><strong>What you searched for</strong> · {categoriesSummary(b)}</span>
        <ChevronDown size={16} className="chev" />
      </summary>
      <div className="brief-details-body">
        <div className="brief-cats">
          <span className="bd-label">Categories searched</span>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <span key={c} className={`cat-chip ${b.categories.includes(c) ? 'on' : 'off'}`}>
                {b.categories.includes(c) && <Check size={12} />} {CATEGORY_LABEL[c]}
              </span>
            ))}
          </div>
          {partial && <span className="bd-note">Only the checked categories were searched.</span>}
        </div>
        <dl className="bd-grid">
          {rows.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </div>
    </details>
  )
}
