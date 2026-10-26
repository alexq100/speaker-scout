// Mirrors backend/models.py. Keep the two in sync.

export type Category = 'academic' | 'practitioner' | 'policy' | 'founder' | 'advocate' | 'journalist'
export type LookingFor = 'keynote' | 'panel' | 'moderator' | 'workshop' | 'any'
export type ConferenceType = 'business' | 'academic' | 'practitioner' | 'philanthropy' | 'policy' | 'community' | 'student'
export type Reach = 'local' | 'regional' | 'national' | 'global' | 'virtual'
export type Budget = 'none' | 'small' | 'medium' | 'large'
export type Level = 'rising' | 'established' | 'headliner'
export type LevelChoice = Level | 'mix' | 'auto'
export type Role = 'keynote' | 'panelist' | 'moderator' | 'workshop'
export type SpeakingBadge = 'experienced' | 'some' | 'none_found'
export type Priority = 'has_spoken' | 'yale_ties' | 'early_career' | 'range_of_perspectives'

export interface SearchBrief {
  conference_theme: string
  looking_for: LookingFor
  panel_theme: string | null
  panel_size: 3 | 4
  conference_name: string | null
  conference_type: ConferenceType | null
  location: string | null
  reach: Reach
  budget: Budget | null
  level: LevelChoice
  categories: Category[]
  prioritize: Priority[]
  skip_names: string[]
  notes: string | null
  per_category: number
}

export interface SpeakingItem { event: string; year: number | null; url: string }
export interface Link { label: string; url: string; kind: 'profile' | 'work' | 'talk' }

export interface SpeakerCard {
  name: string
  job_title: string
  organization: string
  location?: string | null
  level: Level
  best_for: Role[]
  speaking_badge: SpeakingBadge
  could_speak_on: string
  talk_ideas: string[]
  topic_tags: string[]
  bio: string
  credentials: string[]
  why_fit: string
  past_speaking: SpeakingItem[]
  notable_work: string[]
  profile_url: string | null
  links: Link[]
  photo_url: string | null
  evidence_urls: string[]
  fit_score: number
  fit_reason: string
  verified_at?: string | null
}

export interface DroppedCandidate { name: string; reason: string }

export interface UsageTotals {
  model_calls: number
  input_tokens: number
  cached_input_tokens: number
  cache_write_tokens?: number
  output_tokens: number
  reasoning_tokens: number
  web_searches: number
  page_reads: number
  cost_usd: number | null
}

export interface CategoryResult {
  category: Category
  label: string
  cards: SpeakerCard[]
  dropped: DroppedCandidate[]
  candidates_found: number
  error: string | null
  usage: UsageTotals
  seconds: number
}

export interface Removal { category: string; name: string; what: string; detail: string }
export interface ProgressEvent { ts: string; seconds: number; agent: string; category: string | null; message: string }

export interface SearchPlan {
  summary: string
  target_level: Level | 'mix'
  target_roles: Role[]
  location_focus: string | null
  angles: { category: Category; angles: string[] }[]
}

export interface PanelMember { name: string; category: Category; angle: string }

export interface PanelSuggestion {
  title: string
  question: string
  members: PanelMember[]
  moderator: PanelMember | null
  why_together: string[]
  tension: string
  balance_note: string
  shared_stage: string[]
}

export interface SearchResult {
  id: string
  status: 'running' | 'done' | 'error' | 'stopped'
  brief: SearchBrief
  plan: SearchPlan | null
  categories: CategoryResult[]
  removals: Removal[]
  injection_flags: string[]
  events: ProgressEvent[]
  panels: PanelSuggestion[]
  panel_usage: UsageTotals | null
  usage: UsageTotals
  seconds: number
  error: string | null
  created_at: string
  model: string
}

export interface Conference {
  id: number
  name: string
  created_at: string
  searches: number
  saved: number
  panels: number
}

export interface SavedSearch {
  id: string
  conference_id: number
  status: SearchResult['status']
  created_at: string
  conference_name: string | null
  conference_theme: string
  looking_for: LookingFor
  panel_theme: string | null
  categories_label: string
  location: string | null
  speakers: number
  seconds: number
  input_tokens: number
  output_tokens: number
  cost_usd: number | null
}

export type OutreachStatus = 'not_contacted' | 'reached_out' | 'following_up' | 'in_conversation' | 'confirmed' | 'declined'

export interface ShortlistItem {
  id: number
  conference_id: number
  search_id: string
  category: Category
  name: string
  note: string
  added_at: string
  group_id: number | null
  outreach_status: OutreachStatus
  outreach_notes: string
  contacted_at: string | null
  outreach_updated_at: string | null
  owner: string
  follow_up_date: string | null
  fee: string
  travel: string
  checklist: Record<string, boolean>
  draft: EmailDraft | null
  last_outreach_at: string | null
  card: SpeakerCard
}

export interface ProgramSuggestion { name: string; category: Category; session: string; why: string; search_id: string | null; on_shortlist: boolean }
export interface ProgramReview {
  verdict: 'strong' | 'promising' | 'needs_work'
  score: number
  summary: string
  strengths: string[]
  gaps: string[]
  overlaps: string[]
  circuit_note: string
  suggestions: ProgramSuggestion[]
  suggested_searches: string[]
  mix: { people?: number; sessions?: number; by_category?: Record<string, number>; by_level?: Record<string, number>; by_speaking?: Record<string, number> }
  reviewed_at: string | null
  tokens: number
}
export interface ReplacementResult { summary: string; suggestions: ReviewSuggestion[]; suggested_search: string | null; tokens: number }

export interface ChatSource { title: string; url: string }
export interface ChatAnswer { answer: string; sources: ChatSource[]; note: string; tokens: number; web_searches: number }
export interface SpeakerNote { id: number; item_id: number; ts: string; origin: 'chat' | 'manual'; question: string; text: string; sources: ChatSource[] }

export interface EmailDraft { subject: string; body: string; created_at: string | null; tokens: number }

export interface LogEntry { id: number; item_id: number; ts: string; kind: 'status' | 'note'; status: OutreachStatus; text: string }

export interface ReviewSuggestion {
  name: string
  category: Category
  why: string
  role: 'add' | 'swap' | 'moderator'
  swap_for: string | null
  search_id: string | null
  on_shortlist: boolean
}

export interface PanelReview {
  verdict: 'strong' | 'promising' | 'needs_work'
  score: number
  summary: string
  strengths: string[]
  concerns: string[]
  missing: string[]
  suggestions: ReviewSuggestion[]
  moderator_note: string | null
  suggested_theme: string | null
  suggested_search: string | null
  reviewed_at: string | null
  tokens: number
}

export interface Group {
  id: number
  conference_id: number
  name: string
  kind: 'keynote' | 'panel'
  theme: string
  position: number
  count: number
  review: PanelReview | null
  session_date: string | null
  session_time: string
  session_room: string
}

export interface Options {
  model: string
  categories: { id: Category; label: string }[]
  examples: Record<string, { label: string; brief: SearchBrief }>
  limits: { theme_chars: number; notes_chars: number; max_per_category: number; searches_per_day: number; searches_today: number }
  pricing_set: boolean
}
