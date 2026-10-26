// "Planning" tab in the speaker drawer: everything the outreach team needs for one speaker.
// Status, owner, next follow-up, outreach log, a drafted invitation email (never sent),
// fee and travel, the session, and, once confirmed, the confirmed-speaker checklist.
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { domain, followUpState, relativeDate, shortDate } from '../lib/format'
import { CHECKLIST, OUTREACH, OUTREACH_LABEL } from '../lib/labels'
import { useShortlist } from '../lib/shortlist'
import type { LogEntry, OutreachStatus, ShortlistItem, SpeakerNote } from '../lib/types'
import { Alert, Chat, Check, CheckCircle, Clock, Copy, Doc, External, Mic, Note, Person, Plus, Refresh, Sparkle, Trash, Users } from './Icons'
import { useToast } from './Toast'

const SENDER_KEY = 'speakerScout.senderName'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="pl-field"><span className="field-label">{label}</span>{children}</label>
}

/** A text input that saves when you click away (or press Enter). */
function SaveOnBlur({ value, onSave, placeholder, type = 'text', max = 200 }: {
  value: string; onSave: (v: string) => Promise<void>; placeholder?: string; type?: string; max?: number
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input className="input" type={type} value={v} placeholder={placeholder} maxLength={max}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onSave(v) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

export default function PlanningPanel({ item, notesVersion = 0 }: { item: ShortlistItem; notesVersion?: number }) {
  const { groups, setOutreach, setPlanning, addLogNote, draftEmail } = useShortlist()
  const toast = useToast()
  const [log, setLog] = useState<LogEntry[]>([])
  const [note, setNote] = useState('')
  const [sender, setSender] = useState(() => localStorage.getItem(SENDER_KEY) ?? '')
  const [emailNotes, setEmailNotes] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [notes, setNotes] = useState<SpeakerNote[]>([])
  const [newNote, setNewNote] = useState('')

  useEffect(() => {
    api.speakerNotes(item.id).then(setNotes).catch(() => setNotes([]))
  }, [item.id, notesVersion])

  async function addManualNote() {
    const t = newNote.trim()
    if (!t) return
    const n = await api.addSpeakerNote(item.id, { text: t, origin: 'manual' })
    setNotes((all) => [n, ...all])
    setNewNote('')
    toast('Note saved')
  }

  async function removeNote(id: number) {
    if (!window.confirm('Delete this note?')) return
    await api.deleteSpeakerNote(id)
    setNotes((all) => all.filter((n) => n.id !== id))
  }
  const group = groups.find((g) => g.id === item.group_id)
  const fu = followUpState(item.follow_up_date)
  const doneCount = CHECKLIST.filter((c) => item.checklist[c.id]).length

  // Reload the log whenever outreach activity changes.
  useEffect(() => {
    api.outreachLog(item.id).then(setLog).catch(() => setLog([]))
  }, [item.id, item.outreach_status, item.last_outreach_at, item.outreach_notes])

  const save = (patch: Record<string, unknown>, msg?: string) =>
    setPlanning(item.id, patch).then(() => { if (msg) toast(msg) }).catch((e) => toast((e as Error).message))

  async function addNote() {
    const t = note.trim()
    if (!t) return
    await addLogNote(item.id, t)
    setNote('')
    toast('Added to the outreach log')
  }

  async function draft() {
    setDrafting(true)
    localStorage.setItem(SENDER_KEY, sender)
    try {
      await draftEmail(item.id, sender, emailNotes)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setDrafting(false)
    }
  }

  function copy(text: string, what: string) {
    navigator.clipboard.writeText(text)
    toast(`${what} copied`)
  }

  return (
    <div className="planning">
      {/* ---- Status, owner, follow-up ---- */}
      <section className="pl-card">
        <h3 className="pl-title">Outreach status</h3>
        <div className="pl-status-row">
          {OUTREACH.map((o) => (
            <button key={o.id} className={`pl-status os-${o.id} ${item.outreach_status === o.id ? 'on' : ''}`}
              onClick={() => item.outreach_status !== o.id && setOutreach(item.id, { status: o.id }).then(() => toast(`${item.name}: ${o.label}`))}>
              <i /> {o.label}
            </button>
          ))}
        </div>
        <p className="pl-meta">
          {item.contacted_at ? <>First contacted {shortDate(item.contacted_at)}</> : 'Not contacted yet'}
          {item.last_outreach_at && <> · last outreach {relativeDate(item.last_outreach_at)}</>}
        </p>
        <div className="pl-grid">
          <Field label="Outreach owner (who on your team)">
            <SaveOnBlur value={item.owner} placeholder="e.g. Alex" max={80} onSave={(v) => save({ owner: v }, 'Owner saved')} />
          </Field>
          <Field label="Next follow-up">
            <SaveOnBlur type="date" value={item.follow_up_date ?? ''} onSave={(v) => save({ follow_up_date: v }, v ? `Follow-up set for ${shortDate(v)}` : 'Follow-up cleared')} />
            {fu && fu !== 'later' && (
              <span className={`fu-flag fu-${fu}`}><Clock size={12} /> {fu === 'overdue' ? 'Overdue' : fu === 'today' ? 'Due today' : 'Due soon'}</span>
            )}
          </Field>
        </div>
      </section>

      {/* ---- Confirmed checklist ---- */}
      {item.outreach_status === 'confirmed' && (
        <section className="pl-card pl-confirmed">
          <h3 className="pl-title"><CheckCircle size={16} /> Confirmed speaker checklist <span className="pl-count">{doneCount}/{CHECKLIST.length}</span></h3>
          <div className="pl-progress"><span style={{ width: `${(doneCount / CHECKLIST.length) * 100}%` }} /></div>
          <ul className="pl-checklist">
            {CHECKLIST.map((c) => (
              <li key={c.id}>
                <label>
                  <input type="checkbox" checked={!!item.checklist[c.id]}
                    onChange={(e) => save({ checklist: { ...item.checklist, [c.id]: e.target.checked } })} />
                  <span>{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Session ---- */}
      <section className="pl-card">
        <h3 className="pl-title">{group?.kind === 'keynote' ? <Mic size={15} /> : <Users size={15} />} Session</h3>
        {group ? (
          <p className="pl-session">
            <strong>{group.name}</strong>{group.theme ? <> · <em>{group.theme}</em></> : null}<br />
            <span>{group.session_date ? shortDate(group.session_date) : 'Date not set'} · {group.session_time || 'time not set'} · {group.session_room || 'room not set'}</span>
            <small>Set the date, time and room in the panel's header on the Shortlist.</small>
          </p>
        ) : (
          <p className="pl-session"><span>Not placed in a panel or keynote slot yet. Use "Move to" on the Shortlist.</span></p>
        )}
      </section>

      {/* ---- Fee and travel ---- */}
      <section className="pl-card">
        <h3 className="pl-title">Fee and travel</h3>
        <div className="pl-grid">
          <Field label="Honorarium / fee">
            <SaveOnBlur value={item.fee} placeholder="e.g. $500, or No fee" onSave={(v) => save({ fee: v }, 'Fee saved')} />
          </Field>
          <Field label="Travel support">
            <SaveOnBlur value={item.travel} max={300} placeholder="e.g. Flight + 1 night hotel" onSave={(v) => save({ travel: v }, 'Travel saved')} />
          </Field>
        </div>
      </section>

      {/* ---- Draft email ---- */}
      <section className="pl-card">
        <h3 className="pl-title"><Sparkle size={15} /> Invitation email</h3>
        <p className="pl-note"><Alert size={13} /> Draft only. Copy it into your own email; Speaker Scout never sends anything.</p>
        {item.draft ? (
          <div className="pl-draft">
            <div className="pl-draft-row">
              <span className="field-label">Subject</span>
              <button className="btn btn-ghost btn-sm" onClick={() => copy(item.draft!.subject, 'Subject')}><Copy size={14} /> Copy</button>
            </div>
            <div className="pl-draft-subject">{item.draft.subject}</div>
            <div className="pl-draft-row">
              <span className="field-label">Body</span>
              <button className="btn btn-ghost btn-sm" onClick={() => copy(item.draft!.body, 'Email body')}><Copy size={14} /> Copy</button>
            </div>
            <pre className="pl-draft-body">{item.draft.body}</pre>
            <small className="pl-meta">Drafted {item.draft.created_at ? relativeDate(item.draft.created_at) : ''}. Fill in anything in [brackets] before sending.</small>
          </div>
        ) : null}
        <div className="pl-grid" style={{ marginTop: 10 }}>
          <Field label="Your name (for the sign-off)">
            <input className="input" value={sender} maxLength={80} placeholder="e.g. Alex Kew" onChange={(e) => setSender(e.target.value)} />
          </Field>
          <Field label="Anything to mention? (optional)">
            <input className="input" value={emailNotes} maxLength={500} placeholder="e.g. We met at Climate Week" onChange={(e) => setEmailNotes(e.target.value)} />
          </Field>
        </div>
        <button className="btn btn-primary btn-sm" onClick={draft} disabled={drafting} style={{ marginTop: 10 }}>
          {drafting ? <><span className="spinner" /> Drafting…</> : item.draft ? <><Refresh size={14} /> Redraft</> : <><Doc size={14} /> Draft invitation email</>}
        </button>
      </section>

      {/* ---- Outreach log ---- */}
      <section className="pl-card">
        <h3 className="pl-title"><Person size={15} /> Outreach log</h3>
        <div className="pl-log-add">
          <textarea className="textarea" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={`What happened? e.g. "Called their office, left a message" or "Replied: interested, asked about dates"`} />
          <button className="btn btn-outline btn-sm" onClick={addNote} disabled={!note.trim()}><Plus size={14} /> Add to log</button>
        </div>
        {log.length === 0 ? (
          <p className="pl-meta">No outreach yet. Status changes and notes will show up here with dates.</p>
        ) : (
          <ol className="pl-log">
            {log.map((e) => (
              <li key={e.id} className={`os-${e.status}`}>
                <span className="pl-log-dot" />
                <div>
                  <span className="pl-log-head">
                    <time>{shortDate(e.ts)} · {new Date(e.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
                    <span className={`os-badge os-${e.status}`} style={{ marginLeft: 8 }}><i /> {OUTREACH_LABEL[e.status as OutreachStatus]}</span>
                  </span>
                  {e.kind === 'status'
                    ? <p className="pl-log-status"><Check size={13} /> Status changed to <strong>{OUTREACH_LABEL[e.status as OutreachStatus]}</strong></p>
                    : <p>{e.text}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ---- Speaker notes (from the chat, or typed) ---- */}
      <section className="pl-card pl-notes">
        <h3 className="pl-title"><Note size={15} /> Speaker notes</h3>
        <p className="pl-meta" style={{ margin: '-4px 0 10px' }}>Research and context about this speaker. Use "Save to notes" in the chat below, or type your own.</p>
        <div className="pl-log-add">
          <textarea className="textarea" rows={2} maxLength={3000} value={newNote} onChange={(e) => setNewNote(e.target.value)}
            placeholder="e.g. Saw her speak at Climate Week, very engaging with Q&A" />
          <button className="btn btn-outline btn-sm" onClick={addManualNote} disabled={!newNote.trim()}><Plus size={14} /> Add note</button>
        </div>
        {notes.length === 0 ? (
          <p className="pl-meta">No notes yet. Ask the chat a question, then click "Save to notes".</p>
        ) : (
          <ul className="sn-list">
            {notes.map((n) => (
              <li key={n.id} className={`sn-${n.origin}`}>
                <div className="sn-head">
                  <span className={`sn-origin ${n.origin}`}>{n.origin === 'chat' ? <><Chat size={11} /> From chat</> : <><Note size={11} /> Note</>}</span>
                  <time>{shortDate(n.ts)}</time>
                  <button className="sn-del" onClick={() => removeNote(n.id)} aria-label="Delete note"><Trash size={13} /></button>
                </div>
                {n.question && <p className="sn-q">Q: {n.question}</p>}
                <p className="sn-text">{n.text}</p>
                {n.sources.length > 0 && (
                  <ul className="sc-sources">
                    {n.sources.map((src) => <li key={src.url}><a href={src.url} target="_blank" rel="noreferrer"><External size={11} /> {src.title || domain(src.url)}</a></li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
