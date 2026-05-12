import { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { Course } from '@/types/course'
import type { Faculty } from '@/types/faculty'
import { fetchCourses, fetchFaculties } from '@/api/courses'
import { CourseCard } from '@/components/CourseCard'
import { CourseRow } from '@/components/CourseRow'
import { IconSearch, IconPlus, IconGrid, IconList, IconMenu } from '@/components/Icons'
import { CourseFilterPanel } from '@/components/CourseFilterPanel'
import { useDataRefresh } from '@/context/DataRefreshContext'

const LIMIT = 20
const CREDITS = [1, 2, 3, 4, 5, 6]
const CATEGORIES = [
  'หมวดวิชาบังคับ',
  'หมวดวิชาเอกเลือก',
  'หมวดหมู่วิชาโท',
  'หมวดวิชาเลือกทั่วไป (GE)',
  'หมวดวิชาฟรี',
]

export function CourseListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { coursesV } = useDataRefresh()

  const initialQuery = params.get('q') ?? ''
  const initialFaculty = params.get('faculty') ?? ''
  const initialFacCodes = initialFaculty ? initialFaculty.split(',').filter(Boolean) : []

  const [searchInput, setSearchInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [facCodes, setFacCodes] = useState<string[]>(initialFacCodes)
  const [cats, setCats] = useState<string[]>([])
  const [credits, setCredits] = useState<number[]>([])
  const [sort, setSort] = useState<'rating' | 'reviews' | 'code'>('rating')
  const [density, setDensity] = useState<'grid' | 'list'>('grid')

  const [courses, setCourses] = useState<Course[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  // Lock body scroll while mobile filter open
  useEffect(() => {
    if (!filterOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFilterOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [filterOpen])

  useEffect(() => { fetchFaculties().then(setFaculties).catch(console.error) }, [])

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

  // backend accepts faculty as comma-separated codes. category/credits still single (first selected).
  const apiFilters = useMemo(() => ({
    search: query,
    faculty: facCodes.join(','),
    credits: credits[0],
    category: cats[0],
    sort,
  }), [query, facCodes, credits, cats, sort])

  const loadInitial = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetchCourses({ ...apiFilters, limit: LIMIT, page: 1 })
      setCourses(res.data); setTotal(res.total); setOffset(res.data.length)
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }, [apiFilters])

  useEffect(() => { loadInitial() }, [loadInitial, coursesV])

  // sync URL
  useEffect(() => {
    const p = new URLSearchParams()
    if (query) p.set('q', query)
    if (facCodes.length) p.set('faculty', facCodes.join(','))
    setParams(p, { replace: true })
  }, [query, facCodes, setParams])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const page = Math.floor(offset / LIMIT) + 1
      const res = await fetchCourses({ ...apiFilters, limit: LIMIT, page })
      setCourses(prev => [...prev, ...res.data])
      setOffset(prev => prev + res.data.length)
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoadingMore(false)
    }
  }

  const onSearchSubmit = (e: React.FormEvent) => { e.preventDefault(); setQuery(searchInput) }
  const clearAll = () => { setFacCodes([]); setCats([]); setCredits([]); setQuery(''); setSearchInput('') }
  const activeFilterCount = facCodes.length + cats.length + credits.length + (query ? 1 : 0)

  const hasMore = courses.length < total

  const filterProps = {
    faculties,
    facCodes,
    cats,
    credits,
    categories: CATEGORIES,
    creditOptions: CREDITS,
    activeCount: activeFilterCount,
    onToggleFaculty: (code: string) => setFacCodes(toggle(facCodes, code)),
    onToggleCat: (c: string) => setCats(toggle(cats, c)),
    onToggleCredit: (n: number) => setCredits(toggle(credits, n)),
    onClear: () => { clearAll(); setFilterOpen(false) },
    onClose: () => setFilterOpen(false),
  }

  return (
    <div className="fade-in shell">
      {createPortal(
        <>
          <div
            className={`filter-overlay ${filterOpen ? 'is-open' : ''}`}
            onClick={() => setFilterOpen(false)}
            aria-hidden="true"
          />
          {/* mobile drawer — body-mounted so no ancestor can constrain fixed positioning */}
          <CourseFilterPanel {...filterProps} open={filterOpen} variant="drawer" />
        </>,
        document.body,
      )}

      <div className="results-layout">
        {/* desktop inline panel — CSS hides on ≤1024 */}
        <CourseFilterPanel {...filterProps} open={true} variant="inline" />

        <div>
          <button
            className="filter-burger"
            onClick={() => setFilterOpen(true)}
            aria-label="เปิดตัวกรอง"
            aria-expanded={filterOpen}
            type="button"
          >
            <IconMenu />
            <span>ตัวกรอง</span>
            {activeFilterCount > 0 && (
              <span className="filter-burger-badge">{activeFilterCount}</span>
            )}
          </button>

          <form onSubmit={onSearchSubmit} style={{ marginBottom: 18 }}>
            <div className="search-hero" style={{ padding: '6px 6px 6px 18px', boxShadow: 'var(--shadow-sm)' }}>
              <IconSearch width="18" height="18" />
              <input
                placeholder="ค้นหารหัสวิชา / ชื่อวิชา"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearchInput(''); setQuery('') }}>ล้าง</button>
              )}
              <button type="submit" className="btn btn-primary btn-sm">ค้นหา</button>
            </div>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="h-2">พบ {total} วิชา</div>
              <div className="caption" style={{ marginTop: 4 }}>
                {query ? <>คำค้น "<b style={{ color: 'var(--ink-2)' }}>{query}</b>"</> : 'ทุกวิชาในระบบ'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="seg">
                <button className={sort === 'rating' ? 'is-active' : ''} onClick={() => setSort('rating')}>คะแนน</button>
                <button className={sort === 'reviews' ? 'is-active' : ''} onClick={() => setSort('reviews')}>รีวิว</button>
                <button className={sort === 'code' ? 'is-active' : ''} onClick={() => setSort('code')}>รหัส</button>
              </div>
              <div className="seg">
                <button className={density === 'grid' ? 'is-active' : ''} onClick={() => setDensity('grid')} title="แบบการ์ด"><IconGrid /></button>
                <button className={density === 'list' ? 'is-active' : ''} onClick={() => setDensity('list')} title="แบบรายการ"><IconList /></button>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--accent-rose)', fontWeight: 600, marginBottom: 12 }}>{error}</div>
          )}

          {loading ? (
            <div className="empty-state">กำลังโหลด...</div>
          ) : courses.length === 0 ? (
            <div className="empty-state card">
              <div style={{ fontSize: 38, marginBottom: 10 }}>🔍</div>
              <div className="h-3" style={{ marginBottom: 6 }}>ไม่พบวิชาที่ค้นหา</div>
              <div className="body-sm" style={{ marginBottom: 18 }}>ลองปรับคำค้น หรือถ้ายังไม่มีในระบบ ช่วยกันเพิ่มได้</div>
              <button className="btn btn-primary" onClick={() => navigate('/courses/new')}>
                <IconPlus /> เพิ่มวิชาใหม่
              </button>
            </div>
          ) : density === 'grid' ? (
            <div className="result-grid">
              {courses.map(c => <CourseCard key={c.id} course={c} />)}
            </div>
          ) : (
            <div className="result-list">
              {courses.map((c, i) => (
                <div key={c.id}>
                  {i > 0 && <hr />}
                  <CourseRow course={c} />
                </div>
              ))}
            </div>
          )}

          {hasMore && !loading && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'กำลังโหลด...' : `โหลดเพิ่ม (${total - courses.length} วิชา)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
