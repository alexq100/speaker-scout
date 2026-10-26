// The team's shortlist, organized into Keynote speakers and named panels.
// Tabs across the top; drag a person onto a tab (or use "Move to") to place them.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import PanelReviewBox from '../components/PanelReviewBox'
import {
  Bookmark, Clock, Copy, Download, Flag, Folder, Grip, Inbox, Mic, Pencil, Person, Plus, Printer, Search, Sparkle, Star, Trash, Users,
} from '../components/Icons'
import { LevelBadge, RoleBadges, SpeakingBadge, TopicChips } from '../components/SpeakerBadges'
import { useToast } from '../components/Toast'
import { CATEGORY_LABEL, CATEGORY_SHORT, OUTREACH, OUTREACH_LABEL, ROLE_LABEL } from '../lib/labels'
import { followUpState, relativeDate, shortDate } from '../lib/format'
import { useConference } from '../lib/conference'
import { useOpenProfile } from '../lib/drawer'
import { useShortlist } from '../lib/shortlist'
import type { Group, OutreachStatus, ShortlistItem } from '../lib/types'

type Tab = 'all' | 'unsorted' | number

function groupName(groups: Group[], id: number | null): string {
  return id == null ? 'Unsorted' : groups.find((g) => g.id === id)?.name ?? 'Unsorted'
}

function asText(items: ShortlistItem[], groups: Group[], heading: string): string {
  const people = items.map((i) => {
    const c = i.card
    const links = c.links.map((l) => `   ${l.label}: ${l.url}`).join('\n')
    return [
      `${c.name}: ${c.job_title}, ${c.organization} (${CATEGORY_SHORT[i.category]})`,
      `   Group: ${groupName(groups, i.group_id)}`,
      `   Outreach: ${OUTREACH_LABEL[i.outreach_status]}${i.contacted_at ? ` (first contacted ${i.contacted_at.slice(0, 10)})` : ''}`,
      i.outreach_notes ? `   Outreach notes: ${i.outreach_notes.replace(/\n/g, ' / ')}` : '',
      i.owner ? `   Owner: ${i.owner}` : '',
      i.follow_up_date ? `   Next follow-up: ${i.follow_up_date}` : '',
      i.fee || i.travel ? `   Fee / travel: ${[i.fee, i.travel].filter(Boolean).join(' · ')}` : '',
      `   Could speak on: ${c.could_speak_on}`,
      `   Best for: ${c.best_for.map((r) => ROLE_LABEL[r]).join(', ')}`,
      i.note ? `   Note: ${i.note}` : '',
      links,
    ].filter(Boolean).join('\n')
  })
  return `${heading}\n\n${people.join('\n\n')}`
}

function asCsv(items: ShortlistItem[], groups: Group[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const rows = [['Group', 'Name', 'Title', 'Organization', 'Category', 'Level', 'Best for', 'Could speak on', 'Profile',
    'Outreach status', 'First contacted', 'Last outreach', 'Next follow-up', 'Owner', 'Fee', 'Travel', 'Outreach notes', 'Team note']]
  for (const i of items) {
    const c = i.card
    rows.push([groupName(groups, i.group_id), c.name, c.job_title, c.organization, CATEGORY_LABEL[i.category], c.level,
      c.best_for.join('/'), c.could_speak_on, c.profile_url ?? c.links[0]?.url ?? '',
      OUTREACH_LABEL[i.outreach_status], i.contacted_at?.slice(0, 10) ?? '', i.last_outreach_at?.slice(0, 10) ?? '',
      i.follow_up_date ?? '', i.owner, i.fee, i.travel, i.outreach_notes, i.note])
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

// ---- Small pieces -------------------------------------------------------------

function NoteBox({ item }: { item: ShortlistItem }) {
  const { setNote } = useShortlist()
  const [text, setText] = useState(item.note)
  const [saved, setSaved] = useState(true)
  return (
    <div className="note-box">
      <span className="field-label">Team notes</span>
      <textarea className="textarea" value={text} maxLength={500} placeholder="e.g. Ask about honorarium; great for the finance panel"
        onChange={(e) => { setText(e.target.value); setSaved(false) }}
        onBlur={async () => { if (!saved) { await setNote(item.id, text); setSaved(true) } }} />
      <div className="note-foot"><span>{saved ? 'Saved' : 'Saves when you click away'}</span><span>{text.length}/500</span></div>
    </div>
  )
}

function OutreachBar({ item }: { item: ShortlistItem }) {
  const { setOutreach } = useShortlist()
  const openProfile = useOpenProfile()
  const toast = useToast()
  const [text, setText] = useState(item.outreach_notes)
  const [saved, setSaved] = useState(true)
  async function setStatus(status: OutreachStatus) {
    try {
      await setOutreach(item.id, { status })
      toast(`${item.name}: ${OUTREACH_LABEL[status]}`)
    } catch (e) {
      toast((e as Error).message)
    }
  }
  return (
    <div className={`outreach-bar os-${item.outreach_status}`}>
      <div className="outreach-left">
        <span className="field-label">Outreach</span>
        <select className={`select outreach-select os-${item.outreach_status}`} value={item.outreach_status}
          onChange={(e) => setStatus(e.target.value as OutreachStatus)} aria-label={`Outreach status for ${item.name}`}>
          {OUTREACH.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <small className="outreach-dates">
          {item.contacted_at ? `First contacted ${relativeDate(item.contacted_at)}` : 'Not contacted yet'}
          {item.outreach_updated_at && item.outreach_updated_at !== item.contacted_at ? ` · updated ${relativeDate(item.outreach_updated_at)}` : ''}
        </small>
        {item.outreach_status === 'declined' && (
          <button className="btn btn-outline btn-sm rep-btn" onClick={() => openProfile(item.card, item.category, item.search_id, 'planning')}>
            <Search size={13} /> Find a replacement
          </button>
        )}
      </div>
      <div className="outreach-notes">
        <span className="field-label">Outreach notes</span>
        <textarea className="textarea" value={text} maxLength={2000}
          placeholder="e.g. Emailed Oct 26 via profile contact form. Replied Oct 28: interested, asked about travel support and dates."
          onChange={(e) => { setText(e.target.value); setSaved(false) }}
          onBlur={async () => { if (!saved) { await setOutreach(item.id, { notes: text }); setSaved(true) } }} />
        <div className="note-foot"><span>{saved ? 'Saved' : 'Saves when you click away'}</span><span>{text.length}/2000</span></div>
      </div>
    </div>
  )
}

function OutreachFlags({ item, onOpen }: { item: ShortlistItem; onOpen: () => void }) {
  const fu = followUpState(item.follow_up_date)
  if (!item.last_outreach_at && !item.follow_up_date && !item.owner) return null
  return (
    <div className="card-flags">
      {item.last_outreach_at && (
        <span className="flag-chip"><Flag size={12} /> Last outreach {shortDate(item.last_outreach_at)} ({relativeDate(item.last_outreach_at)})</span>
      )}
      {item.follow_up_date && (
        <button className={`flag-chip fu-${fu}`} onClick={onOpen} title="Open the Planning tab">
          <Clock size={12} /> {fu === 'overdue' ? 'Follow-up overdue' : fu === 'today' ? 'Follow up today' : 'Follow up'} {shortDate(item.follow_up_date)}
        </button>
      )}
      {item.owner && <span className="flag-chip"><Person size={12} /> {item.owner}</span>}
    </div>
  )
}

/** Session date, time and room for a panel or keynote slot. Saves when you click away. */
function SessionFields({ group }: { group: Group }) {
  const { updateGroup } = useShortlist()
  const [d, setD] = useState(group.session_date ?? '')
  const [t, setT] = useState(group.session_time)
  const [r, setR] = useState(group.session_room)
  useEffect(() => { setD(group.session_date ?? ''); setT(group.session_time); setR(group.session_room) }, [group.id, group.session_date, group.session_time, group.session_room])
  const save = (patch: Record<string, string>) => updateGroup(group.id, patch)
  return (
    <div className="session-fields">
      <span className="field-label">Session</span>
      <input className="input" type="date" value={d} onChange={(e) => setD(e.target.value)} onBlur={() => d !== (group.session_date ?? '') && save({ session_date: d })} aria-label="Session date" />
      <input className="input" value={t} maxLength={40} placeholder="Time, e.g. 10:30–11:30" onChange={(e) => setT(e.target.value)} onBlur={() => t !== group.session_time && save({ session_time: t })} aria-label="Session time" />
      <input className="input" value={r} maxLength={80} placeholder="Room" onChange={(e) => setR(e.target.value)} onBlur={() => r !== group.session_room && save({ session_room: r })} aria-label="Session room" />
    </div>
  )
}

function InlineEdit({ value, onSave, className, placeholder, multiline = false, max = 80 }: {
  value: string; onSave: (v: string) => Promise<void>; className?: string; placeholder: string; multiline?: boolean; max?: number
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  async function commit() {
    const v = text.trim()
    setEditing(false)
    if (v !== value && (v || multiline)) await onSave(v)
    else setText(value)
  }
  if (!editing) {
    return (
      <button className={`inline-edit ${className ?? ''} ${value ? '' : 'empty'}`} onClick={() => { setText(value); setEditing(true) }}
        title="Click to edit">
        <span>{value || placeholder}</span> <Pencil size={14} />
      </button>
    )
  }
  const common = {
    autoFocus: true, value: text, maxLength: max, placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !(multiline && e.shiftKey)) { e.preventDefault(); commit() }
      if (e.key === 'Escape') { setText(value); setEditing(false) }
    },
  }
  return multiline
    ? <textarea className={`textarea inline-input ${className ?? ''}`} rows={2} {...common} />
    : <input className={`input inline-input ${className ?? ''}`} {...common} />
}

// ---- Page ----------------------------------------------------------------------

export default function Shortlist() {
  const { items, groups, remove, move, createGroup, updateGroup, deleteGroup, moveGroup } = useShortlist()
  const toast = useToast()
  const openProfile = useOpenProfile()
  const { current, conferences } = useConference()
  // ?tab=<panel id> or ?tab=unsorted opens that tab directly (used by the at-a-glance page).
  const [params, setParams] = useSearchParams()
  const initialTab = (): Tab => {
    const t = params.get('tab')
    return t === 'unsorted' ? 'unsorted' : t && !Number.isNaN(Number(t)) ? Number(t) : 'all'
  }
  const [tab, setTab] = useState<Tab>(initialTab)
  useEffect(() => {
    if (params.get('tab')) {
      setTab(initialTab())
      setParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  // Switching conference goes back to "All saved" (but not on first load).
  const lastConf = useRef(current?.id)
  useEffect(() => {
    if (lastConf.current !== undefined && lastConf.current !== current?.id) setTab('all')
    lastConf.current = current?.id
  }, [current?.id])
  useEffect(() => { setStatusFilter(null); setDueOnly(false) }, [tab, current?.id])
  const [dragId, setDragId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | null>(null)
  const [dueOnly, setDueOnly] = useState(false)
  const [dropTarget, setDropTarget] = useState<Tab | null>(null)

  const keynote = groups.find((g) => g.kind === 'keynote')
  const panels = groups.filter((g) => g.kind === 'panel')
  const activeGroup = typeof tab === 'number' ? groups.find((g) => g.id === tab) : undefined
  const inTab = tab === 'all' ? items : tab === 'unsorted' ? items.filter((i) => i.group_id == null) : items.filter((i) => i.group_id === tab)
  const isDue = (i: ShortlistItem) => ['overdue', 'today'].includes(followUpState(i.follow_up_date) ?? '')
  const dueCount = inTab.filter(isDue).length
  const shown = dueOnly ? inTab.filter(isDue) : statusFilter ? inTab.filter((i) => i.outreach_status === statusFilter) : inTab
  const statusCounts = Object.fromEntries(OUTREACH.map((o) => [o.id, inTab.filter((i) => i.outreach_status === o.id).length])) as Record<OutreachStatus, number>
  const unsortedCount = items.filter((i) => i.group_id == null).length
  const tabTitle = tab === 'all' ? 'All saved speakers' : tab === 'unsorted' ? 'Unsorted' : activeGroup?.name ?? ''

  const confirmedIn = (groupId: number) => items.filter((i) => i.group_id === groupId && i.outreach_status === 'confirmed').length

  async function moveTo(itemId: number, target: Tab) {
    if (target === 'all') return
    const gid = target === 'unsorted' ? null : target
    const item = items.find((i) => i.id === itemId)
    if (!item || item.group_id === gid) return
    await move(itemId, gid)
    toast(`Moved ${item.name} to ${groupName(groups, gid)}`)
  }

  async function newPanel() {
    const g = await createGroup(`Panel ${panels.length + 1}`)
    setTab(g.id)
    toast('New panel added. Click its name to rename it.')
  }

  async function movePanel(g: Group, conferenceId: number) {
    const to = conferences.find((c) => c.id === conferenceId)
    if (!to || !window.confirm(`Move "${g.name}" and its ${g.count} speaker(s) to "${to.name}"?`)) return
    try {
      await moveGroup(g.id, conferenceId)
      setTab('all')
      toast(`Moved "${g.name}" to ${to.name}. Switch conferences at the top to see it there.`)
    } catch (e) {
      toast((e as Error).message)
    }
  }

  async function removePanel(g: Group) {
    if (!window.confirm(`Delete "${g.name}"? Its ${g.count} speaker(s) go back to Unsorted; nobody is removed from the shortlist.`)) return
    await deleteGroup(g.id)
    setTab('all')
  }

  function copy() {
    navigator.clipboard.writeText(asText(shown, groups, tabTitle))
    toast(`Copied ${shown.length} speaker(s). Paste into an email or doc.`)
  }
  function download() {
    const blob = new Blob([asCsv(shown, groups)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `speaker-shortlist-${tabTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
    a.click()
  }

  // Drag and drop: drag a person row onto any tab.
  const dropProps = (target: Tab) => ({
    onDragOver: (e: React.DragEvent) => { if (dragId != null && target !== 'all') { e.preventDefault(); setDropTarget(target) } },
    onDragLeave: () => setDropTarget((t) => (t === target ? null : t)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setDropTarget(null); if (dragId != null) moveTo(dragId, target) },
  })
  const tabClass = (t: Tab) => `group-tab ${tab === t ? 'active' : ''} ${dropTarget === t ? 'drop' : ''}`

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Your team's picks · {current?.name ?? ''}</span>
          <h1>Shortlist{current ? <span className="h1-conf"> · {current.name}</span> : null}</h1>
          <p className="lead">Save speakers from any search, then sort them into keynote slots and panels. Drag a person onto a tab to move them.</p>
        </div>
      </section>

      <div className="container page-body">
        {items.length === 0 && panels.length === 0 ? (
          <div className="empty-state">
            <div className="big-icon"><Bookmark size={30} /></div>
            <h2>No one saved yet</h2>
            <p>Run a search and tap the bookmark on any speaker card to save them here. Then build your keynote list and panels.</p>
            <Link to="/" className="btn btn-primary">Find speakers</Link>
          </div>
        ) : (
          <>
            <div className="group-tabs" role="tablist" aria-label="Shortlist groups">
              <button role="tab" aria-selected={tab === 'all'} className={tabClass('all')} onClick={() => setTab('all')}>
                <Bookmark size={15} /> All saved <span className="tab-count">{items.length}</span>
              </button>
              <button role="tab" aria-selected={tab === 'unsorted'} className={tabClass('unsorted')} onClick={() => setTab('unsorted')} {...dropProps('unsorted')}>
                <Inbox size={15} /> Unsorted <span className="tab-count">{unsortedCount}</span>
              </button>
              {keynote && (
                <button role="tab" aria-selected={tab === keynote.id} className={`${tabClass(keynote.id)} keynote`} onClick={() => setTab(keynote.id)} {...dropProps(keynote.id)}>
                  <Star size={15} /> {keynote.name} <span className="tab-count">{keynote.count}</span>
                </button>
              )}
              {panels.map((g) => (
                <button key={g.id} role="tab" aria-selected={tab === g.id} className={tabClass(g.id)} onClick={() => setTab(g.id)} {...dropProps(g.id)}>
                  <Users size={15} /> {g.name} <span className="tab-count">{g.count}</span>
                </button>
              ))}
              <button className="group-tab add" onClick={newPanel}><Plus size={15} /> New panel</button>
            </div>

            {activeGroup && (
              <div className={`group-header ${activeGroup.kind}`}>
                <span className="group-icon">{activeGroup.kind === 'keynote' ? <Mic size={22} /> : <Users size={22} />}</span>
                <div className="group-text">
                  <span className="eyebrow">{activeGroup.kind === 'keynote' ? 'Keynote slot' : 'Panel'}</span>
                  <InlineEdit className="group-name" value={activeGroup.name} placeholder="Name this panel"
                    onSave={(v) => updateGroup(activeGroup.id, { name: v })} />
                  <InlineEdit className="group-theme" multiline max={200} value={activeGroup.theme}
                    placeholder={activeGroup.kind === 'keynote' ? 'Add a note about the keynote (e.g. opening talk, day 1)' : 'Add the panel theme or the question it will discuss'}
                    onSave={(v) => updateGroup(activeGroup.id, { theme: v })} />
                  <SessionFields group={activeGroup} />
                </div>
                <div className="group-meta">
                  {activeGroup.kind === 'panel' ? (
                    <>
                      <span className={`size-pill ${activeGroup.count >= 3 && activeGroup.count <= 4 ? 'ok' : ''}`}>
                        {activeGroup.count} {activeGroup.count === 1 ? 'person' : 'people'}
                        {activeGroup.count < 3 ? ` · add ${3 - activeGroup.count} more` : activeGroup.count > 4 ? ' · panels are usually 3–4' : ' · good size'}
                      </span>
                      <span className={`size-pill ${confirmedIn(activeGroup.id) === activeGroup.count && activeGroup.count > 0 ? 'ok' : ''}`}>
                        {confirmedIn(activeGroup.id)} of {activeGroup.count} confirmed
                      </span>
                      {conferences.length > 1 && (
                        <label className="panel-move">
                          <Folder size={14} />
                          <select className="select" value="" onChange={(e) => e.target.value && movePanel(activeGroup, Number(e.target.value))}
                            aria-label="Move this panel to another conference">
                            <option value="">Move to conference…</option>
                            {conferences.filter((c) => c.id !== current?.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </label>
                      )}
                      <Link className="btn btn-outline btn-sm" to={`/print/panel/${activeGroup.id}`}><Printer size={14} /> Committee one-pager</Link>
                      <button className="btn-danger-ghost btn btn-sm" onClick={() => removePanel(activeGroup)}><Trash size={14} /> Delete panel</button>
                    </>
                  ) : (
                    <>
                      <span className="size-pill">{activeGroup.count} {activeGroup.count === 1 ? 'candidate' : 'candidates'}</span>
                      <span className="size-pill">{confirmedIn(activeGroup.id)} confirmed</span>
                      <Link className="btn btn-outline btn-sm" to={`/print/panel/${activeGroup.id}`}><Printer size={14} /> Committee one-pager</Link>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeGroup?.kind === 'panel' && <PanelReviewBox key={activeGroup.id} group={activeGroup} />}
            {!activeGroup && panels.length > 0 && (
              <div className="architect-hint">
                <Sparkle size={16} /> <span><strong>Panel Architect:</strong> open a panel tab and ask it to review your lineup: what works, what's missing, and who to add.</span>
              </div>
            )}

            {inTab.length > 0 && (
              <div className="outreach-summary" role="group" aria-label="Filter by outreach status">
                <span className="field-label" style={{ margin: 0 }}>Outreach</span>
                <button className={`os-chip ${statusFilter == null && !dueOnly ? 'on' : ''}`} onClick={() => { setStatusFilter(null); setDueOnly(false) }}>All <b>{inTab.length}</b></button>
                {dueCount > 0 && (
                  <button className={`os-chip due-chip ${dueOnly ? 'on' : ''}`} onClick={() => { setDueOnly(!dueOnly); setStatusFilter(null) }}>
                    <Clock size={13} /> Follow-ups due <b>{dueCount}</b>
                  </button>
                )}
                {OUTREACH.map((o) => (
                  <button key={o.id} className={`os-chip os-${o.id} ${statusFilter === o.id ? 'on' : ''}`} disabled={!statusCounts[o.id]}
                    onClick={() => setStatusFilter(statusFilter === o.id ? null : o.id)}>
                    <i /> {o.short} <b>{statusCounts[o.id]}</b>
                  </button>
                ))}
              </div>
            )}

            <div className="toolbar">
              <p><strong>{shown.length}</strong>{statusFilter ? ` of ${inTab.length}` : ''} {shown.length === 1 && !statusFilter ? 'speaker' : 'speakers'}
                {tab === 'all' ? ' saved' : ` in ${tabTitle}`}{statusFilter ? ` · ${OUTREACH_LABEL[statusFilter]}` : ''}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline btn-sm" onClick={copy} disabled={!shown.length}><Copy size={15} /> Copy as text</button>
                <button className="btn btn-outline btn-sm" onClick={download} disabled={!shown.length}><Download size={15} /> Download CSV</button>
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="drop-empty" {...(tab !== 'all' ? dropProps(tab) : {})}>
                {tab === 'all' ? 'No one saved yet.' : <>Nobody here yet. Go to <button className="link-btn" onClick={() => setTab('all')}>All saved</button> and drag people onto this tab, or use “Move to” on any speaker.</>}
              </div>
            ) : (
              <div className="short-list">
                {shown.map((i) => (
                  <div key={i.id} className={`short-item ${dragId === i.id ? 'dragging' : ''}`} draggable
                    onDragStart={(e) => { setDragId(i.id); e.dataTransfer.effectAllowed = 'move' }}
                    onDragEnd={() => { setDragId(null); setDropTarget(null) }}>
                    <div className="short-left">
                      <span className="grip" title="Drag onto a tab"><Grip size={16} /></span>
                      <button className="avatar-btn" onClick={() => openProfile(i.card, i.category, i.search_id)} aria-label={`Open ${i.card.name}'s profile`}>
                        <Avatar name={i.card.name} photo={i.card.photo_url} size={72} />
                      </button>
                    </div>
                    <div>
                      <span className="eyebrow">{CATEGORY_LABEL[i.category]}</span>
                      <h3>
                        <button className="name-btn" onClick={() => openProfile(i.card, i.category, i.search_id)}>{i.card.name}</button>
                        <span className={`os-badge os-${i.outreach_status}`}><i /> {OUTREACH_LABEL[i.outreach_status]}</span>
                      </h3>
                      <OutreachFlags item={i} onOpen={() => openProfile(i.card, i.category, i.search_id)} />
                      <div className="card-title">{i.card.job_title}, {i.card.organization}</div>
                      <TopicChips tags={i.card.topic_tags} />
                      <p className="short-speak-on">{i.card.could_speak_on}</p>
                      <div className="card-badges" style={{ margin: '10px 0 0' }}>
                        <LevelBadge level={i.card.level} />
                        <SpeakingBadge badge={i.card.speaking_badge} />
                        <RoleBadges roles={i.card.best_for} />
                      </div>
                      <div className="short-links">
                        <button onClick={() => openProfile(i.card, i.category, i.search_id)}>Full profile</button>
                        <Link to={`/search/${i.search_id}`}>From this search</Link>
                        <button onClick={() => remove(i.id)} style={{ color: 'var(--bad)' }}><Trash size={13} /> Remove</button>
                      </div>
                    </div>
                    <div className="short-side">
                      <label className="move-to">
                        <span className="field-label">Move to</span>
                        <select className="select" value={i.group_id ?? ''} onChange={(e) => moveTo(i.id, e.target.value === '' ? 'unsorted' : Number(e.target.value))}>
                          <option value="">Unsorted</option>
                          {keynote && <option value={keynote.id}>★ {keynote.name}</option>}
                          {panels.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </label>
                      <NoteBox item={i} />
                    </div>
                    <OutreachBar item={i} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
