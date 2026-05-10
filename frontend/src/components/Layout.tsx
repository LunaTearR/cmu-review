import { faBookOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link, useLocation } from 'react-router-dom'

interface Props {
  children: React.ReactNode
}

export function Layout({ children }: Props) {
  const loc = useLocation()
  const isNew = loc.pathname === '/courses/new'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Glassmorphism navbar */}
      <header style={{
        background: 'rgba(75, 30, 120, 0.72)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(201, 162, 39, 0.45)',
        boxShadow: '0 2px 24px rgba(0,0,0,0.35)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div className="navbar-inner">
          {/* Brand */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <FontAwesomeIcon icon={faBookOpen} style={{ fontSize: '1.125rem' }} />
            <div>
              {/* 1.05 → 1.125rem: brand needs more presence in navbar */}
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.125rem', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                CMU Review
              </div>
              {/* 0.65 → 0.8rem: 0.65rem (10.4px) fails WCAG readability */}
              <div style={{ color: 'var(--cmu-gold-light)', fontSize: '0.8rem', lineHeight: 1.1, opacity: 0.9 }}>
                มหาวิทยาลัยเชียงใหม่
              </div>
            </div>
          </Link>

          {!isNew && (
            <Link
              to="/courses/new"
              style={{
                padding: '0.4rem 1rem',
                background: 'var(--cmu-gold)',
                color: '#2d0a54',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 800,
                fontSize: '0.9375rem',
                boxShadow: '0 2px 8px rgba(201,162,39,0.3)',
              }}
            >
              + เพิ่มวิชา
            </Link>
          )}
        </div>
      </header>

      {/* White glass content band */}
      <div style={{
        flex: 1,
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}>
        <main className="page-container">
          {children}
        </main>
      </div>

      {/* Glass footer — 0.8rem, readable but subordinate */}
      <footer style={{
        background: 'rgba(13, 1, 32, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(201, 162, 39, 0.3)',
        padding: '0.875rem 1rem',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'rgba(240, 216, 117, 0.75)',
      }}>
        CMU Review — รีวิววิชาเรียน มหาวิทยาลัยเชียงใหม่
      </footer>
    </div>
  )
}
