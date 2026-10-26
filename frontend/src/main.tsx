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
import { DrawerProvider } from './lib/drawer'
import { ShortlistProvider } from './lib/shortlist'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConferenceProvider>
          <ShortlistProvider>
            <DrawerProvider>
              <App />
            </DrawerProvider>
          </ShortlistProvider>
        </ConferenceProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
