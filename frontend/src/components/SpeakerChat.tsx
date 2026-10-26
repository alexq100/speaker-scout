// "Ask about this speaker": a small chat docked at the bottom of the profile drawer.
// The assistant starts from the verified card and searches the web only when needed; every answer
// lists its sources. Useful answers can be saved to the speaker's notes (Planning tab).
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { domain } from '../lib/format'
import type { Category, ChatSource, ShortlistItem, SpeakerCard } from '../lib/types'
import { Check, ChevronDown, Chat, External, Note, Send, Sparkle } from './Icons'
import { useToast } from './Toast'

interface Msg { role: 'user' | 'assistant'; text: string; sources?: ChatSource[]; note?: string; question?: string; saved?: boolean; error?: boolean }

// Keep each speaker's conversation for this browser session, so closing the drawer doesn't lose it.
const memory = new Map<string, Msg[]>()

const SUGGESTIONS = [
  'What have they spoken about recently?',
  'Any news about them or their organization this year?',
  'Would they be a good moderator or keynote? Why?',
  'What would be a fresh talk topic for our audience?',
]

interface Props {
  card: SpeakerCard
  category: Category
  searchId: string
  item?: ShortlistItem
  onSaved: () => void
}

export default function SpeakerChat({ card, category, searchId, item, onSaved }: Props) {
  const key = `${searchId}:${category}:${card.name}`
  const [msgs, setMsgs] = useState<Msg[]>(() => memory.get(key) ?? [])
  const [open, setOpen] = useState(msgs.length > 0)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const listRef = useRef<HTMLDivElement>(null)
  const first = card.name.split(' ')[0]

  useEffect(() => {
    memory.set(key, msgs)
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, key])

  async function ask(text: string) {
    const question = text.trim()
    if (!question || busy) return
    setOpen(true)
    setQ('')
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }))
    setMsgs((m) => [...m, { role: 'user', text: question }])
    setBusy(true)
    try {
      const a = await api.speakerChat(searchId, category, card.name, question, history)
      setMsgs((m) => [...m, { role: 'assistant', text: a.answer, sources: a.sources, note: a.note, question }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: (e as Error).message, error: true }])
    } finally {
      setBusy(false)
    }
  }

  async function save(i: number) {
    const m = msgs[i]
    if (!item) return
    try {
      await api.addSpeakerNote(item.id, { text: m.note || m.text, origin: 'chat', question: m.question, sources: m.sources })
      setMsgs((all) => all.map((x, j) => (j === i ? { ...x, saved: true } : x)))
      onSaved()
      toast('Saved to notes (Planning, outreach & notes tab)')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className={`speaker-chat ${open ? 'open' : ''}`}>
      <button className="sc-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sc-icon"><Chat size={16} /></span>
        <span className="sc-title">Ask about {card.name}</span>
        <small>{msgs.length ? `${Math.ceil(msgs.length / 2)} question${msgs.length > 2 ? 's' : ''}` : 'Searches the web if needed · answers cite sources'}</small>
        <ChevronDown size={16} className="sc-chev" />
      </button>

      {open && (
        <div className="sc-body" ref={listRef}>
          {msgs.length === 0 && (
            <div className="sc-suggest">
              <p>Ask anything about {first}'s work, recent talks, news, or fit for your sessions.</p>
              <div className="chips">
                {SUGGESTIONS.map((s) => <button key={s} className="example-chip" onClick={() => ask(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`sc-msg ${m.role} ${m.error ? 'err' : ''}`}>
              {m.role === 'assistant' && !m.error && <span className="sc-avatar"><Sparkle size={13} /></span>}
              <div className="sc-bubble">
                <p>{m.text}</p>
                {m.sources && m.sources.length > 0 && (
                  <ul className="sc-sources">
                    {m.sources.map((s) => (
                      <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer"><External size={11} /> {s.title || domain(s.url)}</a></li>
                    ))}
                  </ul>
                )}
                {m.role === 'assistant' && !m.error && (
                  item ? (
                    m.saved
                      ? <span className="sc-saved"><Check size={13} /> Saved to notes</span>
                      : <button className="sc-save" onClick={() => save(i)}><Note size={13} /> Save to notes</button>
                  ) : <span className="sc-hint">Save {first} to your shortlist to keep notes.</span>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="sc-msg assistant"><span className="sc-avatar"><Sparkle size={13} /></span><div className="sc-bubble sc-typing"><i /><i /><i /> <small>Looking into it…</small></div></div>}
        </div>
      )}

      <form className="sc-input" onSubmit={(e) => { e.preventDefault(); ask(q) }}>
        <input className="input" value={q} maxLength={500} placeholder={`Ask about ${first}…`} onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)} disabled={busy} />
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy || q.trim().length < 2} aria-label="Ask"><Send size={15} /></button>
      </form>
    </div>
  )
}
