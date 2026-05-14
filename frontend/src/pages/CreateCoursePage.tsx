import { useEffect, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import type { Faculty } from '@/types/faculty'
import { fetchFaculties, createCourse } from '@/api/courses'
import { ApiError } from '@/api/client'
import { pickError } from '@/lib/humanErrors'
import { confirmDiscard, confirmSubmit } from '@/lib/confirm'
import { IconBack, IconCheck, IconExternal } from '@/components/Icons'
import { useDataRefresh } from '@/context/DataRefreshContext'

type CourseFormState = {
  course_id: string
  name_th: string
  name_en: string
  credits: number
  faculty_id: number
  description: string
  prerequisite: string
}

type CourseFieldErrors = Partial<Record<keyof CourseFormState, string>>

function validateCourseField<K extends keyof CourseFormState>(key: K, value: CourseFormState[K]): string {
  switch (key) {
    case 'course_id': {
      const v = String(value).trim()
      if (!v) return 'กรอกรหัสวิชาด้วยน้า'
      if (!/^\d{6}$/.test(v)) return 'รหัสวิชาต้องเป็นตัวเลข 6 หลักพอดี'
      return ''
    }
    case 'name_th': {
      const v = String(value).trim()
      if (!v) return 'กรอกชื่อวิชาภาษาไทยด้วยน้า'
      if (v.length < 3) return 'ชื่อวิชาสั้นไปนิด ลองใส่เพิ่มอีกหน่อยนะ'
      return ''
    }
    case 'name_en': {
      const v = String(value).trim()
      if (!v) return 'กรอกชื่อวิชาภาษาอังกฤษด้วยน้า'
      if (v.length < 3) return 'ชื่อวิชาสั้นไปนิด ลองใส่เพิ่มอีกหน่อยนะ'
      if (!/[A-Za-z]/.test(v)) return 'ต้องมีตัวอักษรภาษาอังกฤษอย่างน้อย 1 ตัว'
      return ''
    }
    case 'faculty_id':
      return Number(value) > 0 ? '' : 'เลือกคณะด้วยน้า'
    case 'credits': {
      const n = Number(value)
      return n >= 1 && n <= 6 ? '' : 'หน่วยกิตต้องอยู่ระหว่าง 1–6'
    }
    case 'description': {
      const v = String(value)
      return v.length > 2000 ? 'ยาวเกิน 2000 ตัวอักษร' : ''
    }
    case 'prerequisite': {
      const v = String(value)
      return v.length > 500 ? 'ยาวเกิน 500 ตัวอักษร' : ''
    }
    default:
      return ''
  }
}

export function CreateCoursePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const prefillFacultyCode = params.get('faculty') ?? ''
  const { bump } = useDataRefresh()
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<CourseFieldErrors>({})

  const [form, setForm] = useState<CourseFormState>({
    course_id: '',
    name_th: '',
    name_en: '',
    credits: 3,
    faculty_id: 0,
    description: '',
    prerequisite: '',
  })

  useEffect(() => {
    fetchFaculties().then((list) => {
      setFaculties(list)
      if (prefillFacultyCode) {
        const match = list.find((f) => f.code === prefillFacultyCode)
        if (match) setForm((f) => ({ ...f, faculty_id: match.id }))
      }
    }).catch(console.error)
  }, [prefillFacultyCode])

  const set = <K extends keyof CourseFormState>(k: K, v: CourseFormState[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(fe => ({ ...fe, [k]: '' }))
  }
  const blurValidate = <K extends keyof CourseFormState>(k: K) => {
    setFieldErrors(fe => ({ ...fe, [k]: validateCourseField(k, form[k]) }))
  }

  const requiredFilled = !!(form.course_id && form.name_th && form.name_en && form.faculty_id)

  const dirty = !!(
    form.course_id ||
    form.name_th ||
    form.name_en ||
    form.faculty_id ||
    form.description ||
    form.prerequisite ||
    form.credits !== 3
  )

  const handleCancel = async () => {
    if (dirty) {
      const ok = await confirmDiscard()
      if (!ok) return
    }
    navigate('/')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const keys: (keyof CourseFormState)[] = ['course_id', 'name_th', 'name_en', 'credits', 'faculty_id', 'description', 'prerequisite']
    const next: CourseFieldErrors = {}
    for (const k of keys) {
      const msg = validateCourseField(k, form[k])
      if (msg) next[k] = msg
    }
    setFieldErrors(next)
    if (Object.values(next).some(Boolean)) {
      setError(pickError('REQUIRED_FIELD_MISSING'))
      return
    }
    const ok = await confirmSubmit({
      title: 'ยืนยันเพิ่มรายวิชา?',
      text: 'ตรวจสอบข้อมูลให้ครบถ้วนก่อนเพิ่มเข้าระบบนะ',
      confirmText: 'เพิ่มรายวิชา',
    })
    if (!ok) return
    setError(null); setSubmitting(true)
    try {
      const course = await createCourse({ ...form, credits: Number(form.credits), faculty_id: Number(form.faculty_id) })
      bump('courses')
      navigate(`/courses/${course.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError(pickError('COURSE_ALREADY_EXISTS'))
        else if (err.status === 429) setError(pickError('RATE_LIMITED'))
        else if (err.status >= 400 && err.status < 500) setError(pickError('REQUIRED_FIELD_MISSING'))
        else setError(pickError('SUBMIT_FAILED'))
      } else {
        setError(pickError('NETWORK_ERROR'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fade-in form-page shell-narrow">
      <Link to="/" className="caption" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 16 }}>
        <IconBack /> กลับหน้าหลัก
      </Link>

      <h1 className="h-display" style={{ marginBottom: 8 }}>เพิ่มวิชาใหม่ในระบบ</h1>
      <p className="body-lg" style={{ color: 'var(--ink-3)', marginBottom: 28, maxWidth: 600 }}>
        ถ้ายังหาวิชาที่อยากรีวิวไม่เจอ ช่วยกันเพิ่มได้ ใครก็เพิ่มได้
      </p>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-title">ข้อมูลพื้นฐาน</div>
          <div className="form-stack">
            <div className="form-row">
              <div className="field">
                <label className="field-label">รหัสวิชา <span className="req">*</span></label>
                <input
                  className={`input mono${fieldErrors.course_id ? ' has-error' : ''}`}
                  placeholder="เช่น 204111"
                  value={form.course_id}
                  onChange={(e) => set('course_id', e.target.value)}
                  onBlur={() => blurValidate('course_id')}
                  maxLength={20}
                  inputMode="numeric"
                />
                {fieldErrors.course_id
                  ? <span className="field-error">{fieldErrors.course_id}</span>
                  : <span className="field-hint">รหัส 6 หลักตามระบบลงทะเบียน มช.</span>}
              </div>
              <div className="field">
                <label className="field-label">หน่วยกิต <span className="req">*</span></label>
                <select className="input" value={form.credits} onChange={(e) => set('credits', Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} หน่วยกิต</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="field-label">ชื่อวิชา (ภาษาไทย) <span className="req">*</span></label>
              <input
                className={`input${fieldErrors.name_th ? ' has-error' : ''}`}
                placeholder="เช่น การเขียนโปรแกรมคอมพิวเตอร์เบื้องต้น"
                value={form.name_th}
                onChange={(e) => set('name_th', e.target.value)}
                onBlur={() => blurValidate('name_th')}
                maxLength={255}
              />
              {fieldErrors.name_th && <span className="field-error">{fieldErrors.name_th}</span>}
            </div>

            <div className="field">
              <label className="field-label">ชื่อวิชา (ภาษาอังกฤษ) <span className="req">*</span></label>
              <input
                className={`input${fieldErrors.name_en ? ' has-error' : ''}`}
                placeholder="e.g. Fundamentals of Computer Programming"
                value={form.name_en}
                onChange={(e) => set('name_en', e.target.value)}
                onBlur={() => blurValidate('name_en')}
                maxLength={255}
              />
              {fieldErrors.name_en && <span className="field-error">{fieldErrors.name_en}</span>}
            </div>

            <div className="field">
              <label className="field-label">คณะ <span className="req">*</span></label>
              <select
                className={`input${fieldErrors.faculty_id ? ' has-error' : ''}`}
                value={form.faculty_id}
                onChange={(e) => set('faculty_id', Number(e.target.value))}
                onBlur={() => blurValidate('faculty_id')}
              >
                <option value={0}>— เลือกคณะ —</option>
                {faculties.map(f => <option key={f.id} value={f.id}>{f.name_th}</option>)}
              </select>
              {fieldErrors.faculty_id && <span className="field-error">{fieldErrors.faculty_id}</span>}
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">รายละเอียดวิชา</div>
          <div className="form-stack">
            <div className="field">
              <label className="field-label">คำอธิบายรายวิชา</label>
              <textarea
                className={`input textarea${fieldErrors.description ? ' has-error' : ''}`}
                placeholder="เนื้อหาหลักที่เรียน วัตถุประสงค์ของวิชา หัวข้อสำคัญ ลักษณะการเรียน..."
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                onBlur={() => blurValidate('description')}
                maxLength={2000}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                {fieldErrors.description
                  ? <span className="field-error">{fieldErrors.description}</span>
                  : <span className="field-hint">คัดลอกจาก mis.cmu.ac.th หรือเว็บลงทะเบียนของ มช. ก็ได้</span>}
                <span className="caption mono" style={{ color: form.description.length > 2000 ? 'var(--accent-rose)' : 'var(--ink-4)' }}>{form.description.length}/2000</span>
              </div>
            </div>

            <div className="field">
              <label className="field-label">เงื่อนไขที่ต้องผ่านก่อนเรียน (Prerequisite)</label>
              <input
                className={`input${fieldErrors.prerequisite ? ' has-error' : ''}`}
                placeholder='เช่น 204111 และ 204112 หรือ "ไม่มีเงื่อนไข"'
                value={form.prerequisite}
                onChange={(e) => set('prerequisite', e.target.value)}
                onBlur={() => blurValidate('prerequisite')}
                maxLength={500}
              />
              {fieldErrors.prerequisite
                ? <span className="field-error">{fieldErrors.prerequisite}</span>
                : <span className="field-hint">ระบุรหัสวิชาที่ต้องผ่านก่อน ถ้าไม่มีให้ใส่ "ไม่มี" หรือเว้นว่างได้</span>}
              <div style={{ marginTop: 12, padding: 14, background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <div className="caption" style={{ fontWeight: 600, color: 'var(--ink-1)', marginBottom: 8 }}>
                  ค้นหารายละเอียดวิชาที่จะกรอกได้จาก:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <a href="https://www.mis.cmu.ac.th/tqf/coursepublic.aspx" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 500 }}>
                    <IconExternal /> CMU TQF — ระบบบริหารหลักสูตร (รายละเอียดวิชาทางการ)
                  </a>
                  <a href="https://www1.reg.cmu.ac.th/registrationoffice/searchcourse.php" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 500 }}>
                    <IconExternal /> สำนักทะเบียน มช. — ค้นหาวิชา
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <div style={{ color: 'var(--accent-rose)', fontWeight: 600, marginTop: 12 }}>{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost btn-lg" onClick={handleCancel}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!requiredFilled || submitting}>
            <IconCheck /> {submitting ? 'กำลังบันทึก...' : 'เพิ่มวิชา'}
          </button>
        </div>
      </form>
    </div>
  )
}
