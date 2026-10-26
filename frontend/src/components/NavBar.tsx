import { Link, NavLink, useLocation } from 'react-router-dom'
import { useShortlist } from '../lib/shortlist'
import ConferenceSwitcher from './ConferenceSwitcher'
import { Bookmark, Folder, Mic, Search, Table } from './Icons'
import { useConference } from '../lib/conference'

export default function NavBar() {
  const { items } = useShortlist()
  const { current } = useConference()
  const onGlance = useLocation().pathname === '/at-a-glance'
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="Speaker Scout home">
          <span className="brand-mark"><Mic size={20} color="#fff" /></span>
          <span>
            <span className="brand-name">Speaker Scout</span>
            <span className="brand-sub">Conference speaker search</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>Find speakers</NavLink>
          <NavLink to="/shortlist">
            Shortlist {items.length > 0 && <span className="nav-count">{items.length}</span>}
          </NavLink>
          <NavLink to="/searches">Past searches</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
        </nav>
        <span className="header-spacer" />
        <ConferenceSwitcher />
        <Link to="/" className="btn btn-primary btn-sm header-cta"><Search size={15} /> New search</Link>
      </div>
      <div className="conf-bar">
        <div className="container conf-bar-inner">
          <span className="conf-bar-stats">
            <Folder size={14} /> <strong>{current?.name ?? ''}</strong> · 
            {items.length} saved · {items.filter((i) => i.outreach_status === 'confirmed').length} confirmed
          </span>
          <span className="header-spacer" />
          {onGlance ? (
            <Link to="/shortlist" className="glance-btn">
              <Bookmark size={15} /> View full shortlist for {current?.name ?? 'this conference'}
            </Link>
          ) : (
            <Link to="/at-a-glance" className="glance-btn">
              <Table size={15} /> View shortlist for {current?.name ?? 'this conference'} at a glance
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
