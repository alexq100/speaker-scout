import '@fontsource-variable/open-sans'
import '@fontsource/libre-baskerville/400.css'
import '@fontsource/libre-baskerville/400-italic.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/Toast'
import './index.css'
import { ConferenceProvider } from './lib/conference'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './pages/Login'
import { DrawerProvider } from './lib/drawer'
import { ShortlistProvider } from './lib/shortlist'

// Nothing but the login page until a team is logged in; providers mount fresh for each login.
function AuthGate() {
  const { ready, token } = useAuth()
  if (!ready) return <div className="center-load"><span className="spinner spinner-dark" /></div>
  if (!token) return <Login />
  return (
    <ConferenceProvider key={token}>
      <ShortlistProvider>
        <DrawerProvider>
          <App />
        </DrawerProvider>
      </ShortlistProvider>
    </ConferenceProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
