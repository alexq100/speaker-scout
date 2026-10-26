// The search brief: three main questions up front, everything else under "More options".
import { useState, type ReactNode } from 'react'
import {
  BUDGET, CATEGORIES, CATEGORY_LABEL, CONFERENCE_TYPES, LEVEL_CHOICES, LOOKING_FOR, PRIORITIES, REACH,
} from '../lib/labels'
import type { Category, Conference, LookingFor, Options, Priority, SearchBrief } from '../lib/types'
import { ArrowRight, Check, ChevronDown, Chat, Folder, Mic, Shield, Sparkle, Tool, Users } from './Icons'

export const EMPTY_BRIEF: SearchBrief = {
  conference_theme: '',
  looking_for: 'any',
  panel_theme: null,
  panel_size: 3,
  conference_name: null,
  conference_type: null,
  location: null,
  reach: 'national',
  budget: null,
  level: 'auto',
  categories: [...CATEGORIES],
  prioritize: ['has_spoken'],
  skip_names: [],
  notes: null,
  per_category: 5,
}

const CHOICE_ICON: Record<LookingFor, ReactNode> = {
  keynote: <Mic size={18} />,
  panel: <Users size={18} />,
  moderator: <Chat size={18} />,
  workshop: <Tool size={18} />,
  any: <Sparkle size={18} />,
}

interface Props {
  options: Options | null
  busy: boolean
  onSubmit: (brief: SearchBrief) => void
  initialTheme?: string
  initialNotes?: string
  initialCategories?: Category[]
  initialSkip?: string
  conference?: Conference | null
}

export default function BriefForm({ options, busy, onSubmit, initialTheme = '', initialNotes = '', initialCategories, initialSkip = '', conference }: Props) {
  const [b, setB] = useState<SearchBrief>({
    ...EMPTY_BRIEF,
    conference_theme: initialTheme.slice(0, 200),
    // A new search starts with the conference you're working on (unless it's the catch-all "General").
    conference_name: conference && conference.name !== 'General' ? conference.name.slice(0, 120) : null,
    ...(initialNotes ? { notes: initialNotes.slice(0, 300) } : {}),
    ...(initialCategories && initialCategories.length ? { categories: initialCategories } : {}),
  })
  const [skipText, setSkipText] = useState(initialSkip)
  const [more, setMore] = useState(!!initialNotes)
  const [loadedExample, setLoadedExample] = useState<string | null>(null)

  const set = <K extends keyof SearchBrief>(key: K, value: SearchBrief[K]) => setB((prev) => ({ ...prev, [key]: value }))
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

  function loadExample(key: string) {
    const ex = options?.examples[key]
    if (!ex) return
    setB({ ...EMPTY_BRIEF, ...ex.brief })
    setSkipText(ex.brief.skip_names.join(', '))
    setLoadedExample(ex.label)
    setMore(true)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const skip = skipText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    onSubmit({
      ...b,
      conference_theme: b.conference_theme.trim(),
      panel_theme: b.looking_for === 'panel' ? b.panel_theme?.trim() || null : null,
      conference_name: b.conference_name?.trim() || null,
      location: b.location?.trim() || null,
      notes: b.notes?.trim() || null,
      skip_names: skip,
    })
  }

  const themeMax = options?.limits.theme_chars ?? 200
  const notesMax = options?.limits.notes_chars ?? 300
  const canSubmit = b.conference_theme.trim().length >= 3 && b.categories.length > 0 && !busy

  return (
    <form className="brief-card" onSubmit={submit}>
      <div className="brief-top">
        <h2>Tell the scouts what you need</h2>
        {options && (
          <div className="examples">
            <span>Try a real conference:</span>
            {Object.entries(options.examples).map(([key, ex]) => (
              <button type="button" key={key} className="example-chip" onClick={() => loadExample(key)}>
                {ex.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="brief-body">
        {initialNotes && !loadedExample && (
          <div className="alert alert-info" style={{ marginBottom: 24 }}>
            <Users size={18} /> <span>Finding people like a speaker you liked, from other sectors. Review the brief, then search.</span>
          </div>
        )}
        {loadedExample && (
          <div className="alert alert-info" style={{ marginBottom: 24 }}>
            <Check size={18} /> Loaded the <strong>&nbsp;{loadedExample}&nbsp;</strong> brief. Change anything you like, then search.
          </div>
        )}

        <div className="step">
          <span className="step-num">1</span>
          <div>
            <label htmlFor="theme" className="step-title">What is your conference about?</label>
            <span className="step-hint">The theme or topics your speakers should cover.</span>
            <input
              id="theme"
              className="input input-lg"
              placeholder="e.g. Environmental and social regeneration: beyond sustainability"
              value={b.conference_theme}
              maxLength={themeMax}
              onChange={(e) => set('conference_theme', e.target.value)}
              required
            />
            <span className="char-count">{b.conference_theme.length}/{themeMax}</span>
          </div>
        </div>

        <div className="step">
          <span className="step-num">2</span>
          <div>
            <span className="step-title">What are you looking for?</span>
            <span className="step-hint">This changes who the scouts look for: a keynote needs a big-stage voice, a panel needs different angles.</span>
            <div className="choice-grid" role="radiogroup" aria-label="What are you looking for?">
              {LOOKING_FOR.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  role="radio"
                  aria-checked={b.looking_for === c.id}
                  className={`choice ${b.looking_for === c.id ? 'selected' : ''}`}
                  onClick={() => set('looking_for', c.id)}
                >
                  <span className="choice-icon">{CHOICE_ICON[c.id]}</span>
                  <strong>{c.label}</strong>
                  <small>{c.hint}</small>
                  <Check size={16} className="choice-check" />
                </button>
              ))}
            </div>

            {b.looking_for === 'panel' && (
              <div className="panel-fields">
                <label className="field">
                  <span className="field-label">Panel theme <small>(under your conference theme)</small></span>
                  <input
                    className="input"
                    placeholder="e.g. Financing the transition"
                    value={b.panel_theme ?? ''}
                    maxLength={200}
                    onChange={(e) => set('panel_theme', e.target.value)}
                  />
                </label>
                <div className="field">
                  <span className="field-label">Panel size</span>
                  <div className="segmented">
                    {[3, 4].map((n) => (
                      <button type="button" key={n} className={b.panel_size === n ? 'on' : ''} onClick={() => set('panel_size', n as 3 | 4)}>
                        {n} people
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="step">
          <span className="step-num">3</span>
          <div>
            <span className="step-title">Which kinds of people?</span>
            <span className="step-hint">Each one gets its own scout. Fewer categories make the search faster and cheaper.</span>
            <div className="chips">
              {CATEGORIES.map((c: Category) => (
                <button
                  type="button"
                  key={c}
                  className={`chip-toggle ${b.categories.includes(c) ? 'on' : ''}`}
                  aria-pressed={b.categories.includes(c)}
                  onClick={() => setB((prev) => ({ ...prev, categories: toggle(prev.categories, c) }))}
                >
                  {b.categories.includes(c) && <Check size={14} />} {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button type="button" className={`more-toggle ${more ? 'open' : ''}`} onClick={() => setMore(!more)} aria-expanded={more}>
          <ChevronDown size={18} /> More options <small>location, budget, speaker level, priorities, people to skip</small>
        </button>

        {more && (
          <div className="more-grid">
            <label className="field">
              <span className="field-label">Conference name <small>(optional)</small></span>
              <input className="input" placeholder="e.g. Yale Business & the Environment" value={b.conference_name ?? ''} maxLength={120}
                onChange={(e) => set('conference_name', e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Conference type / audience</span>
              <select className="select" value={b.conference_type ?? ''} onChange={(e) => set('conference_type', (e.target.value || null) as SearchBrief['conference_type'])}>
                <option value="">Not sure / mixed</option>
                {CONFERENCE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <div className="field span-2">
              <span className="field-label">Location and reach</span>
              <div className="inline-row">
                <input className="input" style={{ maxWidth: 280 }} placeholder="e.g. New Haven, CT" value={b.location ?? ''} maxLength={100}
                  onChange={(e) => set('location', e.target.value)} aria-label="Location" />
                <div className="segmented">
                  {REACH.map((r) => (
                    <button type="button" key={r.id} className={b.reach === r.id ? 'on' : ''} onClick={() => set('reach', r.id)}>{r.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="field">
              <span className="field-label">Speaker budget <small>(steers the speaker level)</small></span>
              <div className="segmented">
                {BUDGET.map((x) => (
                  <button type="button" key={x.id} className={b.budget === x.id ? 'on' : ''} onClick={() => set('budget', b.budget === x.id ? null : x.id)}>{x.label}</button>
                ))}
              </div>
            </div>
            <label className="field">
              <span className="field-label">Speaker level</span>
              <select className="select" value={b.level} onChange={(e) => set('level', e.target.value as SearchBrief['level'])}>
                {LEVEL_CHOICES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <div className="field span-2">
              <span className="field-label">Prioritize</span>
              <div className="chips">
                {PRIORITIES.map((p) => (
                  <button type="button" key={p.id} className={`chip-toggle ${b.prioritize.includes(p.id) ? 'on' : ''}`}
                    aria-pressed={b.prioritize.includes(p.id)} onClick={() => setB((prev) => ({ ...prev, prioritize: toggle<Priority>(prev.prioritize, p.id) }))}>
                    {b.prioritize.includes(p.id) && <Check size={14} />} {p.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span className="field-label">Already booked / skip these people <small>(comma separated)</small></span>
              <textarea className="textarea" placeholder="e.g. Jane Doe, John Smith" value={skipText} onChange={(e) => setSkipText(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Anything else the scouts should know?</span>
              <textarea className="textarea" placeholder="e.g. We'd love someone who works with students or young professionals."
                value={b.notes ?? ''} maxLength={notesMax} onChange={(e) => set('notes', e.target.value)} />
              <span className="char-count">{(b.notes ?? '').length}/{notesMax}</span>
            </label>
          </div>
        )}
      </div>

      <div className="brief-foot">
        <p><Shield size={16} color="var(--good)" /> Takes about a minute. Every person is checked against real web pages.
          {conference && <> Saved to <span className="conf-chip"><Folder size={13} /> {conference.name}</span></>}</p>
        <button type="submit" className="btn btn-primary btn-lg" disabled={!canSubmit}>
          {busy ? <><span className="spinner" /> Starting…</> : <>Find speakers <ArrowRight size={18} /></>}
        </button>
      </div>
    </form>
  )
}
