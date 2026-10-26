// Team login. One account per team (teammates can share it); each browser also keeps a "your name"
// so the activity feed can show who added which speaker.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ACTOR_KEY, api, TOKEN_KEY } from './api'

interface AuthState {
  ready: boolean
  token: string | null
  team: string
  username: string
  actor: string
  setActor: (name: string) => void
  login: (username: string, password: string) => Promise<void>
  signup: (team: string, username: string, password: string) => Promise<number>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [team, setTeam] = useState('')
  const [username, setUsername] = useState('')
  const [actor, setActorState] = useState(() => localStorage.getItem(ACTOR_KEY) ?? '')
  const [ready, setReady] = useState(false)

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setTeam('')
    setUsername('')
  }, [])

  useEffect(() => {
    const onOut = () => clear()
    window.addEventListener('speakerScout:logged-out', onOut)
    return () => window.removeEventListener('speakerScout:logged-out', onOut)
  }, [clear])

  useEffect(() => {
    if (!token) { setReady(true); return }
    api.me().then((m) => { setTeam(m.team_name); setUsername(m.username) }).catch(() => clear()).finally(() => setReady(true))
  }, [token, clear])

  const value = useMemo<AuthState>(() => ({
    ready, token, team, username, actor,
    setActor: (name) => {
      const n = name.trim().slice(0, 60)
      localStorage.setItem(ACTOR_KEY, n)
      setActorState(n)
    },
    login: async (u, p) => {
      const r = await api.login(u, p)
      localStorage.setItem(TOKEN_KEY, r.token)
      setTeam(r.team_name); setUsername(r.username); setToken(r.token)
    },
    signup: async (t, u, p) => {
      const r = await api.signup(t, u, p)
      localStorage.setItem(TOKEN_KEY, r.token)
      setTeam(r.team_name); setUsername(r.username); setToken(r.token)
      return r.adopted_conferences ?? 0
    },
    logout: async () => {
      try { await api.logout() } catch { /* already logged out */ }
      localStorage.removeItem('speakerScout.conferenceId')
      clear()
    },
  }), [ready, token, team, username, actor, clear])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
