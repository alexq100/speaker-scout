import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle } from './Icons'

const Ctx = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2600)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <CheckCircle size={18} /> {msg}
        </div>
      )}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(Ctx)
