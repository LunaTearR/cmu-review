import { useEffect, useState, useCallback } from 'react'
import type { Course } from '@/types/course'
import type { Faculty } from '@/types/faculty'
import { fetchCourses, fetchFaculties } from '@/api/courses'
import { CourseCard } from '@/components/CourseCard'
import { SearchableSelect } from '@/components/SearchableSelect'
import type { SelectOption } from '@/components/SearchableSelect'
import { input as inputStyle } from '@/theme'

const LIMIT = 20

const CREDITS_OPTIONS: SelectOption[] = [
  { value: '', label: 'ทุกหน่วยกิต' },
  ...[1, 2, 3, 4, 5, 6].map(c => ({ value: c, label: `${c} หน่วยกิต`, searchKeys: [String(c)] })),
]

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: '',                          label: 'ทุกหมวดหมู่' },
  { value: 'หมวดวิชาบังคับ',           label: 'หมวดวิชาบังคับ' },
  { value: 'หมวดวิชาเอกเลือก',         label: 'หมวดวิชาเอกเลือก' },
  { value: 'หมวดวิชาเลือกทั่วไป',      label: 'หมวดวิชาเลือกทั่วไป (GE)' },
  { value: 'หมวดวิชาฟรี',              label: 'หมวดวิชาฟรี' },
]

const SORT_OPTIONS: SelectOption[] = [
  { value: 'code',    label: 'เรียงตามรหัส' },
  { value: 'rating',  label: 'คะแนนสูงสุด' },
  { value: 'reviews', label: 'รีวิวมากสุด' },
]

export function CourseListPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({ search: '', faculty: '', credits: 0, category: '', sort: 'code' })

  useEffect(() => {
    fetchFaculties().then(setFaculties).catch(console.error)
  }, [])

  const facultyOptions: SelectOption[] = [
    { value: '', label: 'ทุกคณะ' },
    ...faculties.map(f => ({
      value: f.code,
      label: f.name_th,
      searchKeys: [f.name_en, f.code],
    })),
  ]

  const loadInitial = useCallback(async (f: typeof filters) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchCourses({
        search: f.search,
        faculty: f.faculty,
        credits: f.credits || undefined,
        category: f.category || undefined,
        sort: f.sort,
        limit: LIMIT,
        page: 1,
      })
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
      const res = await fetchCourses({
        search: filters.search,
        faculty: filters.faculty,
        credits: filters.credits || undefined,
        category: filters.category || undefined,
        sort: filters.sort,
        limit: LIMIT,
        page,
      })
      setCourses(prev => [...prev, ...res.data])
      setOffset(prev => prev + res.data.length)
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters(f => ({ ...f, search: searchInput }))
  }

  const hasMore = courses.length < total

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--cmu-primary)', lineHeight: 1.25 }}>
          รีวิววิชาเรียน มช.
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9375rem', color: 'var(--cmu-text-muted)', lineHeight: 1.5 }}>
          ค้นหาและอ่านรีวิวจากรุ่นพี่ก่อนลงทะเบียน
        </p>
      </div>

      <form onSubmit={handleSearch} className="filter-bar">
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="ค้นหาชื่อวิชา หรือรหัสวิชา..."
          className="filter-search"
          style={{ ...inputStyle, fontSize: '0.9375rem' }}
        />
        <SearchableSelect
          options={facultyOptions}
          value={filters.faculty}
          onChange={v => setFilters(f => ({ ...f, faculty: String(v) }))}
          placeholder="ทุกคณะ"
        />
        <SearchableSelect
          options={CREDITS_OPTIONS}
          value={filters.credits || ''}
          onChange={v => setFilters(f => ({ ...f, credits: Number(v) }))}
          placeholder="ทุกหน่วยกิต"
        />
        <SearchableSelect
          options={CATEGORY_OPTIONS}
          value={filters.category}
          onChange={v => setFilters(f => ({ ...f, category: String(v) }))}
          placeholder="ทุกหมวดหมู่"
        />
        <SearchableSelect
          options={SORT_OPTIONS}
          value={filters.sort}
          onChange={v => setFilters(f => ({ ...f, sort: String(v) }))}
          placeholder="เรียงตามรหัส"
        />
        <button type="submit" style={{
          padding: '0.5rem 1.125rem',
          background: 'var(--cmu-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '0.9375rem',
        }}>
          ค้นหา
        </button>
      </form>

      {!loading && (
        <p style={{ fontSize: '0.875rem', color: 'var(--cmu-text-muted)', marginBottom: '0.75rem' }}>
          พบ <strong style={{ color: 'var(--cmu-primary)' }}>{total}</strong> วิชา
        </p>
      )}

      {error && (
        <div style={{ color: 'var(--cmu-error)', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.9375rem' }}>{error}</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--cmu-text-muted)', fontSize: '0.9375rem' }}>กำลังโหลด...</div>
      ) : courses.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          color: 'var(--cmu-text-muted)',
          fontSize: '0.9375rem',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid rgba(180,140,220,0.30)',
        }}>
          ไม่พบวิชาที่ตรงกับการค้นหา
        </div>
      ) : (
        <>
          <div className="course-grid">
            {courses.map(c => <CourseCard key={c.id} course={c} />)}
          </div>

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
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
                  fontSize: '0.9375rem',
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
