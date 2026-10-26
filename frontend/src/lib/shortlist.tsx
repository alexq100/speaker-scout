// Shared shortlist + groups state, so the header count, every Save button and the Shortlist tabs stay in sync.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { useConference } from './conference'
import type { Group, ShortlistItem } from './types'

interface ShortlistState {
  items: ShortlistItem[]
  groups: Group[]
  has: (name: string, category: string) => ShortlistItem | undefined
  add: (searchId: string, category: string, name: string) => Promise<void>
  remove: (id: number) => Promise<void>
  setNote: (id: number, note: string) => Promise<void>
  move: (id: number, groupId: number | null) => Promise<void>
  setOutreach: (id: number, patch: { status?: string; notes?: string }) => Promise<void>
  setPlanning: (id: number, patch: Record<string, unknown>) => Promise<void>
  addLogNote: (id: number, text: string) => Promise<void>
  draftEmail: (id: number, sender: string, notes: string) => Promise<void>
  createGroup: (name: string) => Promise<Group>
  updateGroup: (id: number, patch: { name?: string; theme?: string; session_date?: string; session_time?: string; session_room?: string }) => Promise<void>
  deleteGroup: (id: number) => Promise<void>
  reviewGroup: (id: number) => Promise<void>
  moveGroup: (id: number, conferenceId: number) => Promise<void>
  addToGroup: (searchId: string, category: string, name: string, groupId: number) => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<ShortlistState | null>(null)

export function ShortlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ShortlistItem[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const { currentId, ready, refresh: refreshConferences } = useConference()

  const refresh = useCallback(async () => {
    if (!ready) return
    try {
      const [i, g] = await Promise.all([api.shortlist(currentId), api.groups(currentId)])
      setItems(i)
      setGroups(g)
      refreshConferences()
    } catch {
      /* server not up yet; the page shows its own error */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, ready])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo<ShortlistState>(
    () => ({
      items,
      // Counts come from the items list, so they update the moment someone is moved.
      groups: groups.map((g) => ({ ...g, count: items.filter((i) => i.group_id === g.id).length })),
      has: (name, category) => items.find((i) => i.name === name && i.category === category),
      add: async (searchId, category, name) => {
        const item = await api.addToShortlist(searchId, category, name)
        if (item.conference_id === currentId) setItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)])
      },
      remove: async (id) => {
        await api.removeFromShortlist(id)
        setItems((prev) => prev.filter((p) => p.id !== id))
      },
      setNote: async (id, note) => {
        const item = await api.editNote(id, note)
        setItems((prev) => prev.map((p) => (p.id === id ? item : p)))
      },
      setPlanning: async (id, patch) => {
        const item = await api.updatePlanning(id, patch)
        setItems((prev) => prev.map((p) => (p.id === id ? item : p)))
      },
      addLogNote: async (id, text) => {
        const item = await api.addLogNote(id, text)
        setItems((prev) => prev.map((p) => (p.id === id ? item : p)))
      },
      draftEmail: async (id, sender, notes) => {
        const item = await api.draftEmail(id, sender, notes)
        setItems((prev) => prev.map((p) => (p.id === id ? item : p)))
      },
      setOutreach: async (id, patch) => {
        const item = await api.updateOutreach(id, patch)
        setItems((prev) => prev.map((p) => (p.id === id ? item : p)))
      },
      move: async (id, groupId) => {
        setItems((prev) => prev.map((p) => (p.id === id ? { ...p, group_id: groupId } : p)))  // feels instant
        try {
          await api.moveItem(id, groupId)
        } catch (e) {
          await refresh()
          throw e
        }
      },
      createGroup: async (name) => {
        const g = await api.createGroup(name, currentId)
        setGroups((prev) => [...prev, g])
        return g
      },
      updateGroup: async (id, patch) => {
        const g = await api.updateGroup(id, patch)
        setGroups((prev) => prev.map((p) => (p.id === id ? g : p)))
      },
      moveGroup: async (id, conferenceId) => {
        await api.moveGroup(id, conferenceId)
        await refresh()  // the panel and its people leave this conference's lists
      },
      reviewGroup: async (id) => {
        const g = await api.reviewGroup(id)
        setGroups((prev) => prev.map((p) => (p.id === id ? g : p)))
      },
      addToGroup: async (searchId, category, name, groupId) => {
        const existing = items.find((i) => i.name === name && i.category === category)
        const item = existing ?? (await api.addToShortlist(searchId, category, name))
        const moved = await api.moveItem(item.id, groupId)
        setItems((prev) => [moved, ...prev.filter((p) => p.id !== moved.id)])
      },
      deleteGroup: async (id) => {
        await api.deleteGroup(id)
        setGroups((prev) => prev.filter((p) => p.id !== id))
        setItems((prev) => prev.map((p) => (p.group_id === id ? { ...p, group_id: null } : p)))
      },
      refresh,
    }),
    [items, groups, refresh, currentId],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useShortlist(): ShortlistState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useShortlist must be used inside ShortlistProvider')
  return ctx
}
