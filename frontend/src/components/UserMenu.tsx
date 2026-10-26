// Header menu: the logged-in team, your display name (for "What's new"), and Log out.
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { ChevronDown, Person } from './Icons'
import { useToast } from './Toast'

export default function UserMenu() {
  const { team, username, actor, setActor, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(actor)
  const ref = useRef<HTMLDivElement>(null)
  const toast = useToast()

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-btn" onClick={() => { setOpen(!open); setName(actor) }} aria-expanded={open} title={`Team: ${team}`}>
        <span className="user-avatar"><Person size={15} /></span>
        <span className="user-text"><small>{team}</small><strong>{actor || username}</strong></span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="conf-menu user-pop">
          <span className="conf-menu-label">Logged in as team</span>
          <p className="user-team"><strong>{team}</strong><br /><small>username: {username}</small></p>
          <form onSubmit={(e) => { e.preventDefault(); setActor(name); toast('Name saved: teammates will see it in What\'s new'); setOpen(false) }}>
            <label className="field-label" htmlFor="actor-name">Your name on this computer</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input id="actor-name" className="input" value={name} maxLength={60} placeholder="e.g. Alex" onChange={(e) => setName(e.target.value)} />
              <button className="btn btn-outline btn-sm" type="submit">Save</button>
            </div>
          </form>
          <div className="conf-actions"><button className="danger" onClick={logout}>Log out</button></div>
        </div>
      )}
    </div>
  )
}
