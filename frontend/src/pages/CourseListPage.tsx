import { useEffect, useState, useCallback } from 'react'
import type { Course } from '@/types/course'
import type { Faculty } from '@/types/faculty'
import { fetchCourses, fetchFaculties } from '@/api/courses'
import { CourseCard } from '@/components/CourseCard'
import { input as inputStyle } from '@/theme'

const LIMIT = 20

const CREDITS_OPTIONS = [1, 2, 3, 4, 5, 6]

export function CourseListPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({ search: '', faculty: '', credits: 0, sort: 'code' })

  useEffect(() => {
    fetchFaculties().then(setFaculties).catch(console.error)
  }, [])

  const loadInitial = useCallback(async (f: typeof filters) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchCourses({ search: f.search, faculty: f.faculty, credits: f.credits || undefined, sort: f.sort, limit: LIMIT, page: 1 })
      setCourses(res.data)
      setTotal(res.total)
      setOffset(res.data.length)
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInitial(filters) }, [filters, loadInitial])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const page = Math.floor(offset / LIMIT) + 1
      const res = await fetchCourses({ search: filters.search, faculty: filters.faculty, credits: filters.credits || undefined, sort: filters.sort, limit: LIMIT, page })
      setCourses((prev) => [...prev, ...res.data])
      setOffset((prev) => prev + res.data.length)
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters((f) => ({ ...f, search: searchInput }))
  }

  const setFilter = (key: keyof typeof filters) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = key === 'credits' ? Number(e.target.value) : e.target.value
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const hasMore = courses.length < total
  const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto', fontSize: '0.875rem' }

  return (
    <div>
      {/* Compact header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, color: 'var(--cmu-primary)' }}>
          รีวิววิชาเรียน มช.
        </h1>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.875rem', color: 'var(--cmu-text-muted)' }}>
          ค้นหาและอ่านรีวิวจากรุ่นพี่ก่อนลงทะเบียน
        </p>
      </div>

      {/* Search + 3 filters in one row */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="ค้นหาชื่อวิชา หรือรหัสวิชา..."
          style={{ ...inputStyle, flex: 1, minWidth: 180, fontSize: '0.875rem' }}
        />
        <select value={filters.faculty} onChange={setFilter('faculty')} style={selectStyle}>
          <option value="">ทุกคณะ</option>
          {faculties.map((f) => <option key={f.id} value={f.code}>{f.name_th}</option>)}
        </select>
        <select value={filters.credits || ''} onChange={setFilter('credits')} style={selectStyle}>
          <option value="">ทุกหน่วยกิต</option>
          {CREDITS_OPTIONS.map((c) => <option key={c} value={c}>{c} หน่วยกิต</option>)}
        </select>
        <select value={filters.sort} onChange={setFilter('sort')} style={selectStyle}>
          <option value="code">เรียงตามรหัส</option>
          <option value="rating">คะแนนสูงสุด</option>
          <option value="reviews">รีวิวมากสุด</option>
        </select>
        <button type="submit" style={{
          padding: '0.5rem 1rem',
          background: 'var(--cmu-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '0.875rem',
        }}>
          ค้นหา
        </button>
      </form>

      {/* Count */}
      {!loading && (
        <p style={{ fontSize: '0.8rem', color: 'var(--cmu-text-muted)', marginBottom: '0.75rem' }}>
          พบ <strong style={{ color: 'var(--cmu-primary)' }}>{total}</strong> วิชา
        </p>
      )}

      {error && (
        <div style={{ color: 'var(--cmu-error)', marginBottom: '0.75rem', fontWeight: 600 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--cmu-text-muted)' }}>กำลังโหลด...</div>
      ) : courses.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          color: 'var(--cmu-text-muted)',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid rgba(180,140,220,0.30)',
        }}>
          ไม่พบวิชาที่ตรงกับการค้นหา
        </div>
      ) : (
        <>
          {courses.map((c) => <CourseCard key={c.id} course={c} />)}

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  padding: '0.625rem 2rem',
                  background: loadingMore ? 'var(--cmu-bg)' : 'var(--cmu-bg-card)',
                  color: loadingMore ? 'var(--cmu-text-muted)' : 'var(--cmu-primary)',
                  border: '1px solid var(--cmu-border-strong)',
                  borderRadius: 8,
                  cursor: loadingMore ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
              >
                {loadingMore ? 'กำลังโหลด...' : `โหลดเพิ่ม (${total - courses.length} วิชา)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
