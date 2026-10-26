// The conference you're working on. Everything (searches, shortlist, panels) is filed under one.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Conference } from './types'

const STORAGE_KEY = 'speakerScout.conferenceId'

interface ConferenceState {
  conferences: Conference[]
  current: Conference | null
  currentId: number | null
  ready: boolean
  select: (id: number) => void
  create: (name: string) => Promise<Conference>
  rename: (id: number, name: string) => Promise<void>
  remove: (id: number) => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<ConferenceState | null>(null)

export function ConferenceProvider({ children }: { children: ReactNode }) {
  const [conferences, setConferences] = useState<Conference[]>([])
  const [currentId, setCurrentId] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(saved) && saved > 0 ? saved : null
  })
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const list = await api.conferences()
      setConferences(list)
      setCurrentId((cur) => (cur && list.some((c) => c.id === cur) ? cur : list[0]?.id ?? null))
    } catch {
      /* server not up yet */
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (currentId) localStorage.setItem(STORAGE_KEY, String(currentId))
  }, [currentId])

  const value = useMemo<ConferenceState>(() => ({
    conferences,
    currentId,
    current: conferences.find((c) => c.id === currentId) ?? null,
    ready: ready && currentId != null,
    select: (id) => setCurrentId(id),
    create: async (name) => {
      const c = await api.createConference(name)
      setConferences((prev) => [...prev, c])
      setCurrentId(c.id)
      return c
    },
    rename: async (id, name) => {
      const c = await api.renameConference(id, name)
      setConferences((prev) => prev.map((p) => (p.id === id ? c : p)))
    },
    remove: async (id) => {
      await api.deleteConference(id)
      const rest = conferences.filter((c) => c.id !== id)
      setConferences(rest)
      if (currentId === id) setCurrentId(rest[0]?.id ?? null)
    },
    refresh,
  }), [conferences, currentId, ready, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConference(): ConferenceState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConference must be used inside ConferenceProvider')
  return ctx
}
