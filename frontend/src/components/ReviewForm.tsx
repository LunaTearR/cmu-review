import { useState } from 'react'
import type { CreateReviewPayload } from '@/types/review'
import { Rating } from './Rating'
import { ApiError } from '@/api/client'
import { pickError } from '@/lib/humanErrors'
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

const PROGRAMS = ['ภาคปกติ', 'ภาคพิเศษ', 'นานาชาติ', 'อื่นๆ']
const CATEGORIES = [
  'หมวดวิชาบังคับ',
  'หมวดวิชาเอกเลือก',
  'หมวดหมู่วิชาโท',
  'หมวดวิชาเลือกทั่วไป (GE)',
  'หมวดวิชาฟรี',
  'อื่นๆ',
]

type ReviewFieldKey =
  | 'rating'
  | 'grade'
  | 'academicYear'
  | 'program'
  | 'programCustom'
  | 'category'
  | 'categoryCustom'
  | 'professor'
  | 'reviewerName'
  | 'content'

type ReviewFieldErrors = Partial<Record<ReviewFieldKey, string>>

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
  const [fieldErrors, setFieldErrors] = useState<ReviewFieldErrors>({})

  const programValue = program === 'อื่นๆ' ? programCustom.trim() : program
  const categoryValue = category === 'อื่นๆ' ? categoryCustom.trim() : category

  const validateField = (key: ReviewFieldKey): string => {
    switch (key) {
      case 'rating': return rating > 0 ? '' : 'อย่าลืมแตะหัวใจให้คะแนนนะ'
      case 'grade': return grade ? '' : 'เลือกเกรดที่ได้ด้วยน้า'
      case 'academicYear': {
        const n = Number(academicYear)
        if (!Number.isInteger(n) || n < 2560 || n > CURRENT_YEAR) return `ปีการศึกษาต้องอยู่ระหว่าง 2560–${CURRENT_YEAR}`
        return ''
      }
      case 'program': return ''
      case 'programCustom': {
        if (program === 'อื่นๆ' && !programCustom.trim()) return 'ระบุประเภทหลักสูตรด้วยน้า'
        return ''
      }
      case 'category': return category ? '' : 'เลือกหมวดหมู่วิชาด้วยน้า'
      case 'categoryCustom': {
        if (category === 'อื่นๆ' && !categoryCustom.trim()) return 'ระบุหมวดหมู่ด้วยน้า'
        return ''
      }
      case 'professor': {
        const v = professor.trim()
        if (!v) return 'กรอกชื่ออาจารย์ผู้สอนด้วยน้า'
        if (v.length < 2) return 'ชื่ออาจารย์สั้นไปนิด'
        return ''
      }
      case 'reviewerName':
        return reviewerName.length > 100 ? 'ชื่อเล่นยาวเกิน 100 ตัวอักษร' : ''
      case 'content': {
        const len = content.trim().length
        if (!len) return 'เล่าประสบการณ์ให้รุ่นน้องฟังหน่อยนะ'
        if (len < 30) return `รีวิวสั้นไป ยังขาดอีก ${30 - len} ตัวอักษร`
        if (content.length > 2000) return 'รีวิวยาวเกิน 2000 ตัวอักษร'
        return ''
      }
      default: return ''
    }
  }

  const blurValidate = (key: ReviewFieldKey) => {
    setFieldErrors(fe => ({ ...fe, [key]: validateField(key) }))
  }
  const clearError = (key: ReviewFieldKey) => {
    if (fieldErrors[key]) setFieldErrors(fe => ({ ...fe, [key]: '' }))
  }

  const requiredFilled =
    rating > 0 &&
    !!grade &&
    !!professor.trim() &&
    content.trim().length >= 30 &&
    !!categoryValue &&
    (program !== 'อื่นๆ' || !!programCustom.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const keys: ReviewFieldKey[] = ['rating', 'grade', 'academicYear', 'programCustom', 'category', 'categoryCustom', 'professor', 'reviewerName', 'content']
    const next: ReviewFieldErrors = {}
    for (const k of keys) {
      const msg = validateField(k)
      if (msg) next[k] = msg
    }
    setFieldErrors(next)
    if (Object.values(next).some(Boolean)) {
      if (next.rating) return setError(pickError('RATING_MISSING'))
      if (next.content && content.trim().length < 30) return setError(pickError('REVIEW_TOO_SHORT'))
      return setError(pickError('REQUIRED_FIELD_MISSING'))
    }

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
        professor: professor.trim(),
        reviewer_name: reviewerName.trim() || undefined,
      })
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError(pickError('COURSE_ALREADY_REVIEWED'))
        else if (err.status === 429) setError(pickError('RATE_LIMITED'))
        else setError(pickError('SUBMIT_FAILED'))
      } else {
        setError(pickError('NETWORK_ERROR'))
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
              <select
                className={`input${fieldErrors.grade ? ' has-error' : ''}`}
                value={grade}
                onChange={(e) => { setGrade(e.target.value); clearError('grade') }}
                onBlur={() => blurValidate('grade')}
              >
                <option value="">— เลือก —</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {fieldErrors.grade && <span className="field-error">{fieldErrors.grade}</span>}
            </div>
            <div className="field">
              <label className="field-label">ปีการศึกษา</label>
              <input
                className={`input${fieldErrors.academicYear ? ' has-error' : ''}`}
                type="number"
                min={2560}
                max={CURRENT_YEAR}
                value={academicYear}
                onChange={(e) => { setAcademicYear(Number(e.target.value)); clearError('academicYear') }}
                onBlur={() => blurValidate('academicYear')}
              />
              {fieldErrors.academicYear && <span className="field-error">{fieldErrors.academicYear}</span>}
            </div>
            <div className="field">
              <label className="field-label">ภาคเรียน</label>
              <select className="input" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                <option value={1}>ภาคเรียนที่ 1</option>
                <option value={2}>ภาคเรียนที่ 2</option>
                <option value={3}>ภาคฤดูร้อน</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label">ประเภทหลักสูตร</label>
              <div className="seg" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {PROGRAMS.map(p => (
                  <button key={p} type="button" className={program === p ? 'is-active' : ''} onClick={() => { setProgram(p); clearError('programCustom') }}>{p}</button>
                ))}
              </div>
              {program === 'อื่นๆ' && (
                <>
                  <input
                    className={`input${fieldErrors.programCustom ? ' has-error' : ''}`}
                    style={{ marginTop: 8 }}
                    placeholder="ระบุประเภทหลักสูตร"
                    value={programCustom}
                    onChange={(e) => { setProgramCustom(e.target.value); clearError('programCustom') }}
                    onBlur={() => blurValidate('programCustom')}
                    maxLength={100}
                  />
                  {fieldErrors.programCustom && <span className="field-error">{fieldErrors.programCustom}</span>}
                </>
              )}
            </div>
            <div className="field">
              <label className="field-label">หมวดหมู่วิชา <span className="req">*</span></label>
              <select
                className={`input${fieldErrors.category ? ' has-error' : ''}`}
                value={category}
                onChange={(e) => { setCategory(e.target.value); clearError('category'); clearError('categoryCustom') }}
                onBlur={() => blurValidate('category')}
              >
                <option value="">— เลือก —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
              {category === 'อื่นๆ' && (
                <>
                  <input
                    className={`input${fieldErrors.categoryCustom ? ' has-error' : ''}`}
                    style={{ marginTop: 8 }}
                    placeholder="ระบุหมวดหมู่"
                    value={categoryCustom}
                    onChange={(e) => { setCategoryCustom(e.target.value); clearError('categoryCustom') }}
                    onBlur={() => blurValidate('categoryCustom')}
                    maxLength={100}
                  />
                  {fieldErrors.categoryCustom && <span className="field-error">{fieldErrors.categoryCustom}</span>}
                </>
              )}
            </div>
          </div>

          <div className="field">
            <label className="field-label">อาจารย์ผู้สอน <span className="req">*</span></label>
            <input
              className={`input${fieldErrors.professor ? ' has-error' : ''}`}
              placeholder="เช่น ผศ.ดร.ภัทรชนน วงศ์เกียรติ"
              value={professor}
              onChange={(e) => { setProfessor(e.target.value); clearError('professor') }}
              onBlur={() => blurValidate('professor')}
              maxLength={150}
            />
            {fieldErrors.professor && <span className="field-error">{fieldErrors.professor}</span>}
          </div>

          <div className="field">
            <label className="field-label">ชื่อเล่นผู้รีวิว</label>
            <input
              className={`input${fieldErrors.reviewerName ? ' has-error' : ''}`}
              placeholder='ใส่ชื่อเล่นได้ ไม่ใส่ก็ได้ (จะแสดงเป็น "นักศึกษาไม่เปิดเผยชื่อ")'
              value={reviewerName}
              onChange={(e) => { setReviewerName(e.target.value); clearError('reviewerName') }}
              onBlur={() => blurValidate('reviewerName')}
              maxLength={100}
            />
            {fieldErrors.reviewerName && <span className="field-error">{fieldErrors.reviewerName}</span>}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">รีวิวยาว · สำคัญที่สุด</div>
        <div className="field">
          <label className="field-label">เล่าประสบการณ์ของคุณให้รุ่นน้องฟัง <span className="req">*</span></label>
          <textarea
            className={`input textarea${fieldErrors.content ? ' has-error' : ''}`}
            style={{ minHeight: 220, fontSize: 16, lineHeight: 1.8 }}
            placeholder={'ลองเล่า:\n• เนื้อหาเรียนอะไรบ้าง\n• อาจารย์สอนเป็นยังไง\n• งาน/สอบหนักไหม\n• เคล็ดลับเอาตัวรอด\n• เหมาะกับใคร'}
            value={content}
            onChange={(e) => { setContent(e.target.value); clearError('content') }}
            onBlur={() => blurValidate('content')}
            maxLength={2000}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            {fieldErrors.content
              ? <span className="field-error">{fieldErrors.content}</span>
              : <span className="field-hint">เขียนอย่างน้อย 30 ตัวอักษร — ยิ่งเล่ารายละเอียดยิ่งช่วยรุ่นน้อง</span>}
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
        <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !requiredFilled}>
          <IconCheck /> {loading ? 'กำลังโพสต์...' : 'โพสต์รีวิว'}
        </button>
      </div>
    </form>
  )
}
