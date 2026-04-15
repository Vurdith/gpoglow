import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, NavLink } from 'react-router-dom'
import heroMark from './assets/hero.png'
import { SiteContentProvider } from './context/SiteContentContext.jsx'
import { useSiteContent } from './context/useSiteContent'
import AccessoriesPage from './pages/AccessoriesPage'
import AccessoryDetailPage from './pages/AccessoryDetailPage'
import AdminPage from './pages/AdminPage'
import SimulatorPage from './pages/SimulatorPage'

function App() {
  return (
    <SiteContentProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </SiteContentProvider>
  )
}

function AppShell() {
  const { siteConfig } = useSiteContent()
  const location = useLocation()

  return (
    <div className="site-shell min-h-screen text-dark-100">
      <div className="shell-grid"></div>

      <header className="sticky top-0 z-50 border-b border-white/6 bg-dark-900/92">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="brand-mark shrink-0">
                <div className="brand-glow"></div>
                <img src={heroMark} alt="Glow mark" />
              </div>

              <div className="min-w-0">
                <h1 className="accent-hand text-2xl sm:text-3xl font-semibold tracking-tight">{siteConfig.brandName}</h1>
                <p className="text-sm text-dark-300">{siteConfig.tagline}</p>
              </div>
            </div>

            <nav className="tab-strip self-start lg:self-auto">
              <AccessoriesNavDropdown key={location.pathname} />
            </nav>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 pb-12 animate-fade-in">
        <Routes>
          <Route path="/" element={<AccessoriesPage />} />
          <Route path="/accessories/:id" element={<AccessoryDetailPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>

      <footer className="relative z-10 px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="footer-rule mb-5"></div>
          <div className="flex flex-col gap-2 text-sm text-dark-400 sm:flex-row sm:items-center sm:justify-between">
            <p>{siteConfig.footerPrimary}</p>
            <p className="text-dark-500">{siteConfig.footerSecondary}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function AccessoriesNavDropdown() {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const isAccessoriesActive = location.pathname === '/' || location.pathname === '/simulator' || location.pathname.startsWith('/accessories/')

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!(event.target instanceof Element) || !event.target.closest('[data-nav-dropdown="accessories"]')) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  return (
    <div className="nav-dropdown" data-nav-dropdown="accessories">
      <button
        type="button"
        className={`nav-pill nav-pill-dropdown ${isAccessoriesActive ? 'nav-pill-active' : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span>Accessories</span>
        <svg className={`nav-pill-chevron ${isOpen ? 'nav-pill-chevron-open' : ''}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className={`nav-dropdown-menu ${isOpen ? 'nav-dropdown-menu-open' : ''}`} role="menu">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-dropdown-item ${isActive ? 'nav-dropdown-item-active' : ''}`}
          role="menuitem"
        >
          Accessory Browser
        </NavLink>
        <NavLink
          to="/simulator"
          className={({ isActive }) => `nav-dropdown-item ${isActive ? 'nav-dropdown-item-active' : ''}`}
          role="menuitem"
        >
          Accessory Simulator
        </NavLink>
      </div>
    </div>
  )
}

export default App
