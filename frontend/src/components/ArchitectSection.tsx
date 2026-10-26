// A Panel Architect header bar with "See less" / "See more", so the section can be folded away.
// The choice is remembered per section type in this browser.
import { useState, type ReactNode } from 'react'
import { ChevronDown, Sparkle } from './Icons'

export default function ArchitectSection({ id, title, summary, children }: {
  id: string          // which kind of section, e.g. 'suggested-panels', 'panel-review', 'program-balance'
  title: string
  summary?: string    // short status shown in the bar, e.g. "Promising · 3/5"
  children: ReactNode
}) {
  const key = `speakerScout.collapsed.${id}`
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(key) === '1')
  const toggle = () => {
    localStorage.setItem(key, collapsed ? '0' : '1')
    setCollapsed(!collapsed)
  }
  return (
    <div className={`arch-section ${collapsed ? 'collapsed' : ''}`}>
      <div className="arch-bar">
        <span className="arch-bar-icon"><Sparkle size={14} /></span>
        <strong>Panel Architect</strong>
        <span className="arch-bar-title">· {title}</span>
        {summary && <span className="arch-bar-summary">{summary}</span>}
        <button className="arch-toggle" onClick={toggle} aria-expanded={!collapsed}>
          {collapsed ? 'See more' : 'See less'} <ChevronDown size={14} />
        </button>
      </div>
      {!collapsed && <div className="arch-body">{children}</div>}
    </div>
  )
}
