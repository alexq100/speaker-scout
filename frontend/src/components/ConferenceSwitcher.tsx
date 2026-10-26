// Header dropdown: pick the conference you're working on, add a new one, rename or delete it.
import { useEffect, useRef, useState } from 'react'
import { useConference } from '../lib/conference'
import { Check, ChevronDown, Folder, Pencil, Plus, Trash } from './Icons'
import { useToast } from './Toast'

export default function ConferenceSwitcher() {
  const { conferences, current, select, create, rename, remove } = useConference()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'list' | 'new' | 'rename'>('list')
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [])

  function toggle() {
    setOpen(!open)
    setMode('list')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = name.trim()
    if (!v) return
    try {
      if (mode === 'new') {
        await create(v)
        toast(`Now working on "${v}"`)
      } else if (current) {
        await rename(current.id, v)
        toast('Conference renamed')
      }
      setOpen(false)
      setMode('list')
    } catch (err) {
      toast((err as Error).message)
    }
  }

  async function del() {
    if (!current) return
    const what = `${current.searches} search(es), ${current.saved} saved speaker(s) and ${current.panels} panel(s)`
    const typed = window.prompt(`Delete "${current.name}" and its ${what}?\n\nType the conference name to confirm.`)
    if (typed?.trim() !== current.name) return
    try {
      await remove(current.id)
      toast(`Deleted "${current.name}"`)
      setOpen(false)
    } catch (err) {
      toast((err as Error).message)
    }
  }

  return (
    <div className="conf-switch" ref={ref}>
      <button className="conf-btn" onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
        <Folder size={16} />
        <span className="conf-btn-text">
          <small>Conference</small>
          <strong>{current?.name ?? '…'}</strong>
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="conf-menu" role="menu">
          {mode === 'list' ? (
            <>
              <span className="conf-menu-label">Switch conference</span>
              <ul>
                {conferences.map((c) => (
                  <li key={c.id}>
                    <button role="menuitem" className={c.id === current?.id ? 'on' : ''} onClick={() => { select(c.id); setOpen(false) }}>
                      <span className="conf-check">{c.id === current?.id && <Check size={15} />}</span>
                      <span className="conf-item">
                        <strong>{c.name}</strong>
                        <small>{c.searches} searches · {c.saved} saved · {c.panels} panels</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="conf-actions">
                <button onClick={() => { setMode('new'); setName('') }}><Plus size={15} /> New conference</button>
                <button onClick={() => { setMode('rename'); setName(current?.name ?? '') }}><Pencil size={14} /> Rename this one</button>
                {conferences.length > 1 && <button className="danger" onClick={del}><Trash size={14} /> Delete this one</button>}
              </div>
            </>
          ) : (
            <form className="conf-form" onSubmit={submit}>
              <label className="field-label" htmlFor="conf-name">{mode === 'new' ? 'New conference name' : 'Rename conference'}</label>
              <input id="conf-name" className="input" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Yale Business & the Environment 2027" />
              <div className="conf-form-btns">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('list')}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim()}>{mode === 'new' ? 'Create & switch' : 'Save'}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
