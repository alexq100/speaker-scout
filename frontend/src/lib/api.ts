// Thin client for the FastAPI backend (proxied at /api by Vite).
import type { ChatAnswer, Conference, Group, LogEntry, Options, SpeakerNote, SavedSearch, SearchBrief, SearchResult, ShortlistItem } from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(0, "Can't reach the Speaker Scout server. Is ./start.sh running?")
  }
  if (!res.ok) {
    let message = `Something went wrong (${res.status}).`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join(' ')
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<T>
}

export const api = {
  options: () => call<Options>('/options'),
  conferences: () => call<Conference[]>('/conferences'),
  createConference: (name: string) => call<Conference>('/conferences', { method: 'POST', body: JSON.stringify({ name }) }),
  renameConference: (id: number, name: string) =>
    call<Conference>(`/conferences/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteConference: (id: number) => call<{ deleted: boolean }>(`/conferences/${id}`, { method: 'DELETE' }),
  startSearch: (brief: SearchBrief, conference_id: number | null, force = false) =>
    call<{ id: string; reused: boolean }>('/searches', { method: 'POST', body: JSON.stringify({ brief, force, conference_id }) }),
  searchConference: (id: string) => call<{ conference_id: number }>(`/searches/${id}/conference`),
  moveSearch: (id: string, conference_id: number) =>
    call<{ moved: boolean }>(`/searches/${id}/move`, { method: 'POST', body: JSON.stringify({ conference_id }) }),
  search: (id: string) => call<SearchResult>(`/searches/${id}`),
  searches: (conferenceId: number | null) => call<SavedSearch[]>(`/searches${conferenceId ? `?conference_id=${conferenceId}` : ''}`),
  suggestPanels: (id: string) => call<SearchResult>(`/searches/${id}/panels`, { method: 'POST' }),
  savePanel: (id: string, index: number) => call<{ group: Group }>(`/searches/${id}/panels/${index}/save`, { method: 'POST' }),
  stop: (id: string) => call<{ stopped: boolean }>(`/searches/${id}/stop`, { method: 'POST' }),
  shortlist: (conferenceId: number | null) => call<ShortlistItem[]>(`/shortlist${conferenceId ? `?conference_id=${conferenceId}` : ''}`),
  addToShortlist: (search_id: string, category: string, name: string) =>
    call<ShortlistItem>('/shortlist', { method: 'POST', body: JSON.stringify({ search_id, category, name }) }),
  editNote: (id: number, note: string) =>
    call<ShortlistItem>(`/shortlist/${id}`, { method: 'PATCH', body: JSON.stringify({ note }) }),
  removeFromShortlist: (id: number) => call<{ removed: boolean }>(`/shortlist/${id}`, { method: 'DELETE' }),
  speakerChat: (search_id: string, category: string, name: string, question: string, history: { role: string; text: string }[]) =>
    call<ChatAnswer>('/speaker-chat', { method: 'POST', body: JSON.stringify({ search_id, category, name, question, history }) }),
  speakerNotes: (itemId: number) => call<SpeakerNote[]>(`/shortlist/${itemId}/notes`),
  addSpeakerNote: (itemId: number, note: { text: string; origin: 'chat' | 'manual'; question?: string; sources?: { title: string; url: string }[] }) =>
    call<SpeakerNote>(`/shortlist/${itemId}/notes`, { method: 'POST', body: JSON.stringify(note) }),
  deleteSpeakerNote: (noteId: number) => call<{ deleted: boolean }>(`/notes/${noteId}`, { method: 'DELETE' }),
  updatePlanning: (id: number, patch: Record<string, unknown>) =>
    call<ShortlistItem>(`/shortlist/${id}/planning`, { method: 'PATCH', body: JSON.stringify(patch) }),
  outreachLog: (id: number) => call<LogEntry[]>(`/shortlist/${id}/log`),
  addLogNote: (id: number, text: string) => call<ShortlistItem>(`/shortlist/${id}/log`, { method: 'POST', body: JSON.stringify({ text }) }),
  draftEmail: (id: number, sender_name: string, notes: string) =>
    call<ShortlistItem>(`/shortlist/${id}/draft-email`, { method: 'POST', body: JSON.stringify({ sender_name, notes }) }),
  updateOutreach: (id: number, patch: { status?: string; notes?: string }) =>
    call<ShortlistItem>(`/shortlist/${id}/outreach`, { method: 'PATCH', body: JSON.stringify(patch) }),
  moveItem: (id: number, group_id: number | null) =>
    call<ShortlistItem>(`/shortlist/${id}/move`, { method: 'POST', body: JSON.stringify({ group_id }) }),
  groups: (conferenceId: number | null) => call<Group[]>(`/groups${conferenceId ? `?conference_id=${conferenceId}` : ''}`),
  createGroup: (name: string, conference_id: number | null, theme = '') =>
    call<Group>('/groups', { method: 'POST', body: JSON.stringify({ name, theme, conference_id }) }),
  updateGroup: (id: number, patch: { name?: string; theme?: string; session_date?: string; session_time?: string; session_room?: string }) =>
    call<Group>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  moveGroup: (id: number, conference_id: number) =>
    call<{ moved: boolean; group: Group }>(`/groups/${id}/move`, { method: 'POST', body: JSON.stringify({ conference_id }) }),
  reviewGroup: (id: number) => call<Group>(`/groups/${id}/review`, { method: 'POST' }),
  deleteGroup: (id: number) => call<{ deleted: boolean }>(`/groups/${id}`, { method: 'DELETE' }),
  reset: () => call<{ reset: boolean }>('/reset', { method: 'POST', body: JSON.stringify({ confirm: 'start over' }) }),
}
