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
        <div style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '0 1rem',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Brand */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2L4 7V16C4 22.627 9.373 28.627 16 30C22.627 28.627 28 22.627 28 16V7L16 2Z"
                fill="var(--cmu-gold)" />
              <text x="16" y="20" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#2d0a54"
                fontFamily="sans-serif">มช</text>
            </svg>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
                CMU Review
              </div>
              <div style={{ color: 'var(--cmu-gold-light)', fontSize: '0.65rem', lineHeight: 1, opacity: 0.9 }}>
                มหาวิทยาลัยเชียงใหม่
              </div>
            </div>
          </Link>

          {!isNew && (
            <Link
              to="/courses/new"
              style={{
                padding: '0.375rem 0.875rem',
                background: 'var(--cmu-gold)',
                color: '#2d0a54',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 800,
                fontSize: '0.875rem',
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
        <main style={{ maxWidth: 900, width: '100%', margin: '0 auto', padding: '1.5rem 1rem' }}>
          {children}
        </main>
      </div>

      {/* Glass footer */}
      <footer style={{
        background: 'rgba(13, 1, 32, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(201, 162, 39, 0.3)',
        padding: '0.75rem 1rem',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'rgba(240, 216, 117, 0.75)',
      }}>
        CMU Review — รีวิววิชาเรียน มหาวิทยาลัยเชียงใหม่
      </footer>
    </div>
  )
}
