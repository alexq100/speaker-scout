import { useState } from 'react'
import { useShortlist } from '../lib/shortlist'
import { BookmarkFill, Bookmark } from './Icons'
import { useToast } from './Toast'

interface Props {
  searchId: string
  category: string
  name: string
  variant?: 'icon' | 'button'
}

export default function SaveButton({ searchId, category, name, variant = 'icon' }: Props) {
  const { has, add, remove } = useShortlist()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const saved = has(name, category)

  async function click(e: React.MouseEvent) {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      if (saved) {
        await remove(saved.id)
        toast(`Removed ${name} from your shortlist`)
      } else {
        await add(searchId, category, name)
        toast(`Saved ${name} to your shortlist`)
      }
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (variant === 'button') {
    return (
      <button className={`btn ${saved ? 'btn-outline' : 'btn-primary'}`} onClick={click} disabled={busy}>
        {saved ? <><BookmarkFill size={16} /> On your shortlist</> : <><Bookmark size={16} /> Add to shortlist</>}
      </button>
    )
  }
  return (
    <button
      className={`save-btn ${saved ? 'saved' : ''}`}
      onClick={click}
      disabled={busy}
      aria-pressed={!!saved}
      title={saved ? 'Remove from shortlist' : 'Save to shortlist'}
      aria-label={saved ? `Remove ${name} from shortlist` : `Save ${name} to shortlist`}
    >
      {saved ? <BookmarkFill size={17} /> : <Bookmark size={17} />}
    </button>
  )
}
