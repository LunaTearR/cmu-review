import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Course } from '@/types/course'
import type { Faculty } from '@/types/faculty'
import { fetchCourses, fetchFaculties } from '@/api/courses'
import { CourseCard } from '@/components/CourseCard'
import { PawScatter } from '@/components/PawScatter'
import { IconSearch, IconArrow, IconPen, IconBuilding } from '@/components/Icons'
import { useReviewModal } from '@/context/ReviewModalContext'
import { useDataRefresh } from '@/context/DataRefreshContext'

const FREE_ELECTIVE = 'หมวดวิชาฟรี'

export function HomePage() {
  const navigate = useNavigate()
  const { open: openReview } = useReviewModal()
  const { coursesV } = useDataRefresh()
  const [query, setQuery] = useState('')
  const [topCourses, setTopCourses] = useState<Course[]>([])
  const [topFreeElectives, setTopFreeElectives] = useState<Course[]>([])
  const [faculties, setFaculties] = useState<Faculty[]>([])

  useEffect(() => {
    fetchCourses({ sort: 'top', limit: 8, page: 1 })
      .then(r => setTopCourses(r.data))
      .catch(console.error)
  }, [coursesV])

  useEffect(() => {
    fetchCourses({ category: FREE_ELECTIVE, sort: 'top', limit: 8, page: 1 })
      .then(r => setTopFreeElectives(r.data))
      .catch(console.error)
  }, [coursesV])

  useEffect(() => {
    fetchFaculties().then(setFaculties).catch(console.error)
  }, [])

  const onSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') navigate(`/search?q=${encodeURIComponent(query)}`)
  }

  return (
    <div className="fade-in">
      <section className="hero">
        <div className="hero-bg" />
        <PawScatter count={2} seed={40} sizeMin={380} sizeMax={620} />
        <div className="shell hero-content">
          <h1 className="hero-title">
            หาวิชาที่ใช่<br />
            ก่อน <span className="accent">กดลงทะเบียน</span>
          </h1>
          <p className="hero-sub">
            อ่านรีวิวจากเพื่อนที่ลงไปแล้ว ทั้งวิชาฟรี วิชาเลือก วิชาบังคับ วิชาโท หรือกดดูตามคณะก็ได้
          </p>
          <div className="search-hero">
            <IconSearch width="20" height="20" />
            <input
              placeholder="พิมพ์รหัสวิชา เช่น 204111 หรือชื่อวิชาก็ได้"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearch}
            />
            <button className="btn btn-primary" onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`)}>
              ค้นหา
            </button>
          </div>
        </div>
      </section>

      {topFreeElectives.length > 0 && (
        <section className="section section--pawed">
          <PawScatter count={2} seed={119} sizeMin={400} sizeMax={640} />
          <div className="shell">
            <div className="section-head">
              <div>
                <div className="eyebrow">หมวดวิชาเลือกเสรี</div>
                <h2 className="h-1">วิชาฟรียอดนิยมตอนนี้</h2>
              </div>
              <Link to={`/search?category=${encodeURIComponent(FREE_ELECTIVE)}`} className="btn btn-ghost btn-sm">
                ดูหมวดวิชาฟรีทั้งหมด <IconArrow />
              </Link>
            </div>
            <div className="responsive-grid-3">
              {topFreeElectives.map(c => <CourseCard key={c.id} course={c} />)}
            </div>
          </div>
        </section>
      )}

      {topCourses.length > 0 && (
        <section className="section section--pawed" style={{ background: 'var(--bg-soft)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <PawScatter count={2} seed={263} sizeMin={380} sizeMax={620} />
          <div className="shell">
            <div className="section-head">
              <div>
                <div className="eyebrow">เพื่อนๆ บอกต่อ</div>
                <h2 className="h-1">วิชาที่รีวิวดีสุดตอนนี้</h2>
              </div>
              <Link to="/search" className="btn btn-ghost btn-sm">
                ดูรีวิวทั้งหมด <IconArrow />
              </Link>
            </div>
            <div className="responsive-grid-3">
              {topCourses.map(c => <CourseCard key={c.id} course={c} />)}
            </div>
          </div>
        </section>
      )}

      {faculties.length > 0 && (
        <section className="section section--pawed">
          <PawScatter count={2} seed={511} sizeMin={420} sizeMax={660} />
          <div className="shell">
            <div className="section-head">
              <div>
                <div className="eyebrow">ไล่ดูตามคณะ</div>
                <h2 className="h-1">ลองหาวิชาจากคณะที่สนใจ</h2>
              </div>
            </div>
            <div className="fac-grid">
              {faculties.map(f => (
                <div key={f.id} className="fac-tile" onClick={() => navigate(`/search?faculty=${f.code}`)}>
                  <div className="ft-icon"><IconBuilding /></div>
                  <div className="ft-name">{f.name_th}</div>
                  <div className="ft-count">{f.name_en}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="shell">
          <div className="home-cta" style={{
            background: 'linear-gradient(135deg, var(--brand-deep), var(--brand))',
            color: 'white',
            borderRadius: 'var(--r-xl)',
            padding: '56px 48px',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            gap: 32,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8, marginBottom: 8 }}>
                ส่งต่อให้รุ่นน้อง
              </div>
              <h2 style={{ fontSize: 36, lineHeight: 1.15, fontWeight: 700, margin: 0, color: 'white', textWrap: 'balance' }}>
                ลงวิชาไหนมาแล้ว?<br />มาบอกรุ่นน้องหน่อย
              </h2>
              <p style={{ marginTop: 14, marginBottom: 0, opacity: 0.85, fontSize: 16, maxWidth: 520 }}>
                รีวิวสั้นๆ ก็ช่วยรุ่นน้องตัดสินใจได้ ถ้าวิชายังไม่มีในระบบ เพิ่มเข้ามาก่อนแล้วค่อยรีวิวต่อก็ได้
              </p>
            </div>
            <div className="home-cta-actions" style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button className="btn btn-lg" style={{ background: 'white', color: 'var(--brand-deep)' }} onClick={() => openReview()}>
                <IconPen /> เขียนรีวิว
              </button>
              <Link to="/courses/new" className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
                เพิ่มวิชาใหม่
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
