import { useState } from 'react'
import { initials } from '../lib/format'

// A real photo when we have a verified one, otherwise the person's initials (never a made-up picture).
export default function Avatar({ name, photo, size = 48 }: { name: string; photo?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {photo && !broken ? (
        <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        initials(name)
      )}
    </span>
  )
}
