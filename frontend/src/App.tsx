import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import SiteFooter from './components/SiteFooter'
import AtAGlance from './pages/AtAGlance'
import History from './pages/History'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import NotFound from './pages/NotFound'
import SearchPage from './pages/SearchPage'
import Shortlist from './pages/Shortlist'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <ScrollToTop />
      <NavBar />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search/:id" element={<SearchPage />} />
          <Route path="/shortlist" element={<Shortlist />} />
          <Route path="/at-a-glance" element={<AtAGlance />} />
          <Route path="/searches" element={<History />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <SiteFooter />
    </>
  )
}
