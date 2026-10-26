// Human-friendly words for the codes the backend uses.
import type { OutreachStatus, Budget, Category, ConferenceType, Level, LookingFor, Priority, Reach, Role, SpeakingBadge } from './types'

export const CATEGORY_LABEL: Record<Category, string> = {
  academic: 'Academics & Researchers',
  practitioner: 'Practitioners',
  policy: 'Policy & Government',
  founder: 'Founders & Industry',
  advocate: 'Advocates & Community',
  journalist: 'Journalists & Communicators',
}

export const CATEGORY_SHORT: Record<Category, string> = {
  academic: 'Academic',
  practitioner: 'Practitioner',
  policy: 'Policy',
  founder: 'Founder',
  advocate: 'Advocate',
  journalist: 'Journalist',
}

export const CATEGORY_BLURB: Record<Category, string> = {
  academic: 'Professors, scientists and research leaders',
  practitioner: 'People doing the work: agencies, nonprofits, consultancies',
  policy: 'Officials, agency leaders and policy advisors',
  founder: 'Founders, executives and investors',
  advocate: 'Organizers, advocacy and philanthropy leaders',
  journalist: 'Reporters, authors and podcasters: great moderators',
}

export const CATEGORIES: Category[] = ['academic', 'practitioner', 'policy', 'founder', 'advocate', 'journalist']

export const LOOKING_FOR: { id: LookingFor; label: string; hint: string }[] = [
  { id: 'keynote', label: 'Keynote', hint: 'One big voice to open or close the day' },
  { id: 'panel', label: 'Panel', hint: '3–4 people with different angles on one theme' },
  { id: 'moderator', label: 'Moderator', hint: 'Someone to guide a conversation' },
  { id: 'workshop', label: 'Workshop', hint: 'A hands-on, practical session' },
  { id: 'any', label: 'Open to anything', hint: 'Show me a strong mix' },
]

export const CONFERENCE_TYPES: { id: ConferenceType; label: string }[] = [
  { id: 'business', label: 'Business' },
  { id: 'academic', label: 'Academic' },
  { id: 'practitioner', label: 'Practitioner' },
  { id: 'philanthropy', label: 'Philanthropy & nonprofit' },
  { id: 'policy', label: 'Policy' },
  { id: 'community', label: 'Community' },
  { id: 'student', label: 'Student-led' },
]

export const REACH: { id: Reach; label: string }[] = [
  { id: 'local', label: 'Local' },
  { id: 'regional', label: 'Regional' },
  { id: 'national', label: 'National' },
  { id: 'global', label: 'Global' },
  { id: 'virtual', label: 'Virtual is fine' },
]

export const BUDGET: { id: Budget; label: string }[] = [
  { id: 'none', label: 'No fee' },
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
]

export const LEVEL_CHOICES: { id: Level; label: string }[] = [
  { id: 'rising', label: 'Rising voices' },
  { id: 'established', label: 'Established experts' },
  { id: 'headliner', label: 'Headliners' },
]

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 'has_spoken', label: 'Has spoken before' },
  { id: 'yale_ties', label: 'Ties to Yale / New Haven' },
  { id: 'early_career', label: 'Early-career voices' },
  { id: 'range_of_perspectives', label: 'A range of perspectives' },
]

export const LEVEL_LABEL: Record<Level, string> = {
  rising: 'Rising voice',
  established: 'Established expert',
  headliner: 'Headliner',
}

export const ROLE_LABEL: Record<Role, string> = {
  keynote: 'Keynote',
  panelist: 'Panelist',
  moderator: 'Moderator',
  workshop: 'Workshop',
}

export const SPEAKING_LABEL: Record<SpeakingBadge, string> = {
  experienced: 'Experienced speaker',
  some: 'Has spoken',
  none_found: 'No talks found',
}

export const REMOVAL_LABEL: Record<string, string> = {
  invented_link_removed: 'Link removed: never seen in this search',
  dropped_no_evidence: 'Dropped: no page confirms them',
  dropped_no_work_proof: 'Dropped: only event listings, no profile or work page',
  dropped_weak_title: 'Dropped: no real job title',
  dropped_linkedin_only: 'Dropped: LinkedIn was the only page',
  dropped_injection_source: 'Dropped: source page tried to instruct the AI',
  photo_removed: 'Photo removed: not from their profile',
  contact_info_removed: 'Contact details removed',
  skip_list: 'Removed: on your skip list',
  duplicate_merged: 'Merged: found in two categories',
  panel_member_removed: 'Panel check: removed someone not in this search',
}

export const OUTREACH: { id: OutreachStatus; label: string; short: string }[] = [
  { id: 'not_contacted', label: 'Not contacted', short: 'Not contacted' },
  { id: 'reached_out', label: 'Reached out', short: 'Reached out' },
  { id: 'following_up', label: 'Following up', short: 'Following up' },
  { id: 'in_conversation', label: 'In conversation', short: 'Talking' },
  { id: 'confirmed', label: 'Confirmed', short: 'Confirmed' },
  { id: 'declined', label: 'Declined', short: 'Declined' },
]
export const OUTREACH_LABEL: Record<OutreachStatus, string> = Object.fromEntries(OUTREACH.map((o) => [o.id, o.label])) as Record<OutreachStatus, string>

export const CHECKLIST: { id: string; label: string }[] = [
  { id: 'bio', label: 'Bio received' },
  { id: 'headshot', label: 'Headshot received' },
  { id: 'talk_title', label: 'Talk title / topic confirmed' },
  { id: 'av_needs', label: 'AV and accessibility needs noted' },
  { id: 'travel_booked', label: 'Travel and hotel booked' },
  { id: 'release_form', label: 'Release / recording form signed' },
]
