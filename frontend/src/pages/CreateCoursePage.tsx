import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import type { Faculty } from '@/types/faculty'
import { fetchFaculties, createCourse } from '@/api/courses'
import { ApiError } from '@/api/client'
import { input as inputStyle } from '@/theme'

export function CreateCoursePage() {
  const navigate = useNavigate()
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    course_id: '',
    name_th: '',
    name_en: '',
    credits: 3,
    faculty_id: 0,
    description: '',
  })

  useEffect(() => {
    fetchFaculties().then((list) => {
      setFaculties(list)
      if (list.length > 0) setForm((f) => ({ ...f, faculty_id: list[0].id }))
    }).catch(console.error)
  }, [])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const course = await createCourse({ ...form, credits: Number(form.credits), faculty_id: Number(form.faculty_id) })
      navigate(`/courses/${course.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  const label: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.3rem',
    fontWeight: 700,
    fontSize: '0.875rem',
    color: 'var(--cmu-text-sub)',
  }
  const field: React.CSSProperties = { marginBottom: '1.125rem' }

  return (
    <div>
      <Link to="/" style={{ color: 'var(--cmu-accent)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
        ← กลับ
      </Link>

      {/* Header */}
      <div style={{
        background: 'rgba(75, 30, 120, 0.68)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(201,162,39,0.35)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        borderRadius: 14,
        padding: '1.25rem 1.75rem',
        marginTop: '1rem',
        marginBottom: '1.75rem',
        color: '#fff',
      }}>
        <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800 }}>เพิ่มวิชาใหม่</h1>
        <p style={{ margin: '0.25rem 0 0', opacity: 0.85, fontSize: '0.875rem' }}>
          กรอกข้อมูลวิชาที่ต้องการเพิ่มในระบบ
        </p>
      </div>

      {/* Form card */}
      <div style={{
        background: '#fff',
        border: '1px solid rgba(180,140,220,0.35)',
        borderTop: '3px solid var(--cmu-gold)',
        borderRadius: 14,
        padding: '1.75rem',
        boxShadow: '0 2px 12px rgba(75,30,120,0.10)',
      }}>
        <form onSubmit={handleSubmit}>
          <div style={field}>
            <label style={label}>รหัสวิชา *</label>
            <input style={inputStyle} value={form.course_id} onChange={set('course_id')}
              placeholder="เช่น 204111" required maxLength={20} />
          </div>

          <div style={field}>
            <label style={label}>ชื่อวิชา (ภาษาไทย) *</label>
            <input style={inputStyle} value={form.name_th} onChange={set('name_th')}
              placeholder="ชื่อวิชาภาษาไทย" required maxLength={255} />
          </div>

          <div style={field}>
            <label style={label}>ชื่อวิชา (English) *</label>
            <input style={inputStyle} value={form.name_en} onChange={set('name_en')}
              placeholder="Course name in English" required maxLength={255} />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.125rem' }}>
            <div style={{ flex: 1 }}>
              <label style={label}>หน่วยกิต *</label>
              <input style={inputStyle} type="number" value={form.credits} onChange={set('credits')} min={1} max={12} required />
            </div>
            <div style={{ flex: 2 }}>
              <label style={label}>คณะ *</label>
              <select style={inputStyle} value={form.faculty_id} onChange={set('faculty_id')} required>
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>{f.name_th}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={field}>
            <label style={label}>คำอธิบายรายวิชา</label>
            <textarea
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              value={form.description}
              onChange={set('description')}
              placeholder="คำอธิบายรายวิชา (ไม่จำเป็น)"
              maxLength={2000}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--cmu-error)', marginBottom: '1rem', fontWeight: 600 }}>{error}</div>
          )}

          <button type="submit" disabled={submitting} style={{
            width: '100%',
            padding: '0.75rem',
            background: submitting ? 'var(--cmu-text-muted)' : 'var(--cmu-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: '1rem',
            fontWeight: 800,
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}>
            {submitting ? 'กำลังบันทึก...' : 'เพิ่มวิชา'}
          </button>
        </form>
      </div>
    </div>
  )
}
