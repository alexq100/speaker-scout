// Log in, or create a team account. Shown whenever nobody is logged in.
import { useEffect, useState } from 'react'
import { Mic, Shield, Users } from '../components/Icons'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { login, signup, actor, setActor } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [team, setTeam] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState(actor)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [firstAccount, setFirstAccount] = useState(false)

  useEffect(() => {
    api.authStatus().then((s) => { setFirstAccount(s.accounts === 0); if (s.accounts === 0) setMode('signup') }).catch(() => {})
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (name.trim()) setActor(name)
      if (mode === 'login') await login(username, password)
      else await signup(team, username, password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark"><Mic size={22} color="#fff" /></span>
          <div>
            <span className="brand-name">Speaker Scout</span>
            <span className="brand-sub">Conference speaker search</span>
          </div>
        </div>
        <div className="login-tabs" role="tablist">
          <button role="tab" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Log in</button>
          <button role="tab" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Create team account</button>
        </div>
        <form onSubmit={submit} className="login-form">
          {mode === 'signup' && (
            <>
              <p className="login-note"><Users size={14} /> One account per planning team. Share the username and password with your teammates so everyone sees the same conferences, shortlists and outreach.</p>
              {firstAccount && <p className="login-note"><Shield size={14} /> This is the first account on this computer, so it will include the conferences and searches already saved here.</p>}
              <label className="field"><span className="field-label">Team name</span>
                <input className="input" value={team} maxLength={80} required placeholder="e.g. Yale B&E Conference team" onChange={(e) => setTeam(e.target.value)} /></label>
            </>
          )}
          <label className="field"><span className="field-label">Username</span>
            <input className="input" value={username} maxLength={40} required autoComplete="username" placeholder="e.g. ybec-team" onChange={(e) => setUsername(e.target.value)} /></label>
          <label className="field"><span className="field-label">Password {mode === 'signup' && <small>(8+ characters)</small>}</span>
            <input className="input" type="password" value={password} maxLength={200} required minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} onChange={(e) => setPassword(e.target.value)} /></label>
          <label className="field"><span className="field-label">Your name <small>(shown to teammates in "What's new")</small></span>
            <input className="input" value={name} maxLength={60} placeholder="e.g. Alex" onChange={(e) => setName(e.target.value)} /></label>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : mode === 'login' ? 'Log in' : 'Create team account'}
          </button>
        </form>
        <p className="login-foot">Passwords are stored only as salted hashes. Five wrong tries lock the account for 15 minutes.</p>
      </div>
    </div>
  )
}
