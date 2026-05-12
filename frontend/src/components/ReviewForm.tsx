import { useState } from 'react'
import type { CreateReviewPayload } from '@/types/review'
import { Rating } from './Rating'
import { ApiError } from '@/api/client'
import { IconCheck } from './Icons'

interface Props {
  courseId: number
  onSubmit: (payload: CreateReviewPayload) => Promise<void>
  onCancel?: () => void
}

const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'W']
const CURRENT_YEAR = new Date().getFullYear() + 543

const RATING_LABELS: Record<number, string> = {
  1: 'ไม่แนะนำเลย',
  2: 'ค่อนข้างไม่แนะนำ',
  3: 'เฉยๆ',
  4: 'แนะนำ',
  5: 'แนะนำมาก',
}

const PROGRAMS = ['ปกติ', 'พิเศษ', 'นานาชาติ', 'อื่นๆ']
const CATEGORIES = [
  'หมวดวิชาบังคับ',
  'หมวดวิชาเอกเลือก',
  'หมวดวิชาเลือกทั่วไป',
  'หมวดวิชาฟรี',
  'อื่นๆ',
]

export function ReviewForm({ courseId: _courseId, onSubmit, onCancel }: Props) {
  const [rating, setRating] = useState(0)
  const [grade, setGrade] = useState('')
  const [academicYear, setAcademicYear] = useState(CURRENT_YEAR)
  const [semester, setSemester] = useState(1)
  const [content, setContent] = useState('')
  const [program, setProgram] = useState('ปกติ')
  const [programCustom, setProgramCustom] = useState('')
  const [category, setCategory] = useState('')
  const [categoryCustom, setCategoryCustom] = useState('')
  const [professor, setProfessor] = useState('')
  const [reviewerName, setReviewerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const programValue = program === 'อื่นๆ' ? programCustom : program
  const categoryValue = category === 'อื่นๆ' ? categoryCustom : category
  const filled = rating > 0 && grade && professor && content.trim().length >= 30 && categoryValue

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!rating) return setError('กรุณาให้คะแนนหัวใจ')
    if (content.trim().length < 30) return setError('รีวิวต้องมีอย่างน้อย 30 ตัวอักษร')

    setLoading(true)
    try {
      await onSubmit({
        rating,
        grade,
        academic_year: academicYear,
        semester,
        content: content.trim(),
        program: programValue,
        category: categoryValue,
        professor,
        reviewer_name: reviewerName.trim() || undefined,
      })
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError('คุณได้รีวิววิชานี้ในเทอมนี้แล้ว')
        else if (err.status === 429) setError('ส่งรีวิวบ่อยเกินไป กรุณารอสักครู่')
        else setError(err.message)
      } else {
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="card card-pad" style={{ background: 'var(--brand-tint)', color: 'var(--brand-ink)', borderColor: 'var(--border-strong)' }}>
        <div className="h-3" style={{ marginBottom: 6 }}>ขอบคุณสำหรับรีวิว</div>
        <div className="body-sm" style={{ color: 'var(--brand-ink)' }}>รุ่นน้องจะได้ประโยชน์มาก</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-section">
        <div className="form-section-title">ภาพรวม</div>
        <div className="field" style={{ alignItems: 'center', textAlign: 'center', background: 'var(--bg-soft)', padding: 28, borderRadius: 'var(--r-lg)' }}>
          <label className="field-label" style={{ marginBottom: 4 }}>แนะนำให้คนอื่นลงเรียนไหม <span className="req">*</span></label>
          <div style={{ marginTop: 6 }}>
            <Rating value={rating} onChange={setRating} />
          </div>
          <div className="body-sm" style={{ marginTop: 10, minHeight: 22, fontWeight: 600, color: 'var(--brand-deep)' }}>
            {rating ? RATING_LABELS[rating] : 'แตะหัวใจเพื่อให้คะแนน'}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">บริบทตอนเรียน</div>
        <div className="form-stack">
          <div className="form-row-3">
            <div className="field">
              <label className="field-label">เกรดที่ได้ <span className="req">*</span></label>
              <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">— เลือก —</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">ปีการศึกษา</label>
              <input className="input" type="number" min={2560} max={CURRENT_YEAR} value={academicYear} onChange={(e) => setAcademicYear(Number(e.target.value))} />
            </div>
            <div className="field">
              <label className="field-label">ภาคเรียน</label>
              <select className="input" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                <option value={1}>ภาค 1</option>
                <option value={2}>ภาค 2</option>
                <option value={3}>ภาคฤดูร้อน</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label">ประเภทหลักสูตร</label>
              <div className="seg" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {PROGRAMS.map(p => (
                  <button key={p} type="button" className={program === p ? 'is-active' : ''} onClick={() => setProgram(p)}>{p}</button>
                ))}
              </div>
              {program === 'อื่นๆ' && (
                <input className="input" style={{ marginTop: 8 }} placeholder="ระบุประเภทหลักสูตร" value={programCustom} onChange={(e) => setProgramCustom(e.target.value)} />
              )}
            </div>
            <div className="field">
              <label className="field-label">หมวดหมู่วิชา <span className="req">*</span></label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">— เลือก —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {category === 'อื่นๆ' && (
                <input className="input" style={{ marginTop: 8 }} placeholder="ระบุหมวดหมู่" value={categoryCustom} onChange={(e) => setCategoryCustom(e.target.value)} />
              )}
            </div>
          </div>

          <div className="field">
            <label className="field-label">อาจารย์ผู้สอน <span className="req">*</span></label>
            <input className="input" placeholder="เช่น ผศ.ดร.ภัทรชนน วงศ์เกียรติ" value={professor} onChange={(e) => setProfessor(e.target.value)} />
          </div>

          <div className="field">
            <label className="field-label">ชื่อเล่นผู้รีวิว</label>
            <input className="input" placeholder='ใส่ชื่อเล่นได้ ไม่ใส่ก็ได้ (จะแสดงเป็น "นักศึกษาไม่เปิดเผยชื่อ")' value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} maxLength={100} />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">รีวิวยาว · สำคัญที่สุด</div>
        <div className="field">
          <label className="field-label">เล่าประสบการณ์ของคุณให้รุ่นน้องฟัง <span className="req">*</span></label>
          <textarea
            className="input textarea"
            style={{ minHeight: 220, fontSize: 16, lineHeight: 1.8 }}
            placeholder={'ลองเล่า:\n• เนื้อหาเรียนอะไรบ้าง\n• อาจารย์สอนเป็นยังไง\n• งาน/สอบหนักไหม\n• เคล็ดลับเอาตัวรอด\n• เหมาะกับใคร'}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="field-hint">เขียนอย่างน้อย 30 ตัวอักษร — ยิ่งเล่ารายละเอียดยิ่งช่วยรุ่นน้อง</span>
            <span className="caption mono" style={{ color: content.length >= 30 ? 'var(--accent-mint)' : 'var(--ink-4)' }}>
              {content.length}{content.length >= 30 ? ' ✓' : ''}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--accent-rose)', fontSize: 14, fontWeight: 600, marginTop: 12 }}>{error}</div>
      )}

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost btn-lg" onClick={onCancel}>ยกเลิก</button>
        )}
        <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !filled}>
          <IconCheck /> {loading ? 'กำลังโพสต์...' : 'โพสต์รีวิว'}
        </button>
      </div>
    </form>
  )
}
