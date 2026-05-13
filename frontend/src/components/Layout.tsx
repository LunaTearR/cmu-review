import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { IconSearch, IconPlus, IconPen, IconSun, IconMoon } from './Icons'
import { useReviewModal } from '@/context/ReviewModalContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen } from '@fortawesome/free-solid-svg-icons'

interface Props {
  children: React.ReactNode
}

export function Layout({ children }: Props) {
  const loc = useLocation()
  const navigate = useNavigate()
  const { open: openReview } = useReviewModal()
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const isHome = loc.pathname === '/'

  // forward active faculty filter from /search → /courses/new so faculty pre-fills
  const activeFaculty = new URLSearchParams(loc.search).get('faculty') ?? ''
  const addCourseHref = activeFaculty
    ? `/courses/new?faculty=${encodeURIComponent(activeFaculty)}`
    : '/courses/new'

  return (
    <>
      <header className="nav">
        <div className="shell nav-inner">
          <Link to="/" className="brand">
            <div><FontAwesomeIcon icon={faBookOpen} /></div>
            <div className="brand-name"><span className="accent">morchor</span>CourseReview</div>
          </Link>

          <div className="nav-actions">
            {/* {!isHome && (
              <button className="nav-search-mini" onClick={() => navigate('/search')}>
                <IconSearch width="15" height="15" />
                <span>ค้นหารหัสวิชา / ชื่อวิชา</span>
              </button>
            )} */}
            <Link to={addCourseHref} className="btn btn-ghost btn-sm" aria-label="เพิ่มวิชา">
              <IconPlus /> <span className="nav-text">เพิ่มวิชา</span>
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => openReview()} aria-label="เขียนรีวิว">
              <IconPen /> <span className="nav-text">เขียนรีวิว</span>
            </button>
            <button
              className="btn btn-ghost btn-icon-only"
              onClick={() => setDark(d => !d)}
              title={dark ? 'โหมดสว่าง' : 'โหมดมืด'}
              aria-label="toggle theme"
            >
              {dark ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '40px 0 56px', marginTop: 40 }}>
        <div className="shell footer-grid" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="brand" style={{ marginBottom: 6, color: 'var(--brand-deep)' }}>
              <div><FontAwesomeIcon icon={faBookOpen} /></div>
              <div className="brand-name"><span className="accent">morchor</span>CourseReview</div>
            </div>
            <div className="caption">รีวิวจากนักศึกษา เพื่อนักศึกษา</div>
          </div>
          <div className="caption" style={{ textAlign: 'right' }}>
            ไม่ได้สังกัดมหาวิทยาลัยเชียงใหม่อย่างเป็นทางการ<br />
            เนื้อหารีวิวเป็นความเห็นส่วนตัวของนักศึกษา
          </div>
        </div>
      </footer>
    </>
  )
}
