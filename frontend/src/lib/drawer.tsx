// One profile drawer for the whole site: any page can open a speaker's full profile.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import SpeakerDrawer from '../components/SpeakerDrawer'
import type { Category, SpeakerCard } from './types'

interface Open { card: SpeakerCard; category: Category; searchId: string; tab?: 'profile' | 'planning' }

const Ctx = createContext<(card: SpeakerCard, category: Category, searchId: string, tab?: 'profile' | 'planning') => void>(() => {})

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null)
  const show = useCallback((card: SpeakerCard, category: Category, searchId: string, tab?: 'profile' | 'planning') => setOpen({ card, category, searchId, tab }), [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {open && <SpeakerDrawer key={open.card.name + open.category} card={open.card} category={open.category} searchId={open.searchId} initialTab={open.tab} onClose={() => setOpen(null)} />}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useOpenProfile = () => useContext(Ctx)
