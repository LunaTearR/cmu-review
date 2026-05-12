import { useEffect, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import type { Faculty } from '@/types/faculty'
import { fetchFaculties, createCourse } from '@/api/courses'
import { ApiError } from '@/api/client'
import { pickError } from '@/lib/humanErrors'
import { IconBack, IconCheck, IconExternal } from '@/components/Icons'
import { useDataRefresh } from '@/context/DataRefreshContext'

export function CreateCoursePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const prefillFacultyCode = params.get('faculty') ?? ''
  const { bump } = useDataRefresh()
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

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

  const filled = form.course_id && form.name_th && form.name_en && form.faculty_id

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!filled) return
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
                <input className="input mono" placeholder="เช่น 204111" value={form.course_id} onChange={(e) => set('course_id', e.target.value)} maxLength={20} />
                <span className="field-hint">รหัส 6 หลักตามระบบลงทะเบียน มช.</span>
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
              <input className="input" placeholder="เช่น การเขียนโปรแกรมคอมพิวเตอร์เบื้องต้น" value={form.name_th} onChange={(e) => set('name_th', e.target.value)} maxLength={255} />
            </div>

            <div className="field">
              <label className="field-label">ชื่อวิชา (ภาษาอังกฤษ) <span className="req">*</span></label>
              <input className="input" placeholder="e.g. Fundamentals of Computer Programming" value={form.name_en} onChange={(e) => set('name_en', e.target.value)} maxLength={255} />
            </div>

            <div className="field">
              <label className="field-label">คณะ <span className="req">*</span></label>
              <select className="input" value={form.faculty_id} onChange={(e) => set('faculty_id', Number(e.target.value))}>
                <option value={0}>— เลือกคณะ —</option>
                {faculties.map(f => <option key={f.id} value={f.id}>{f.name_th}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">รายละเอียดวิชา</div>
          <div className="form-stack">
            <div className="field">
              <label className="field-label">คำอธิบายรายวิชา</label>
              <textarea
                className="input textarea"
                placeholder="เนื้อหาหลักที่เรียน วัตถุประสงค์ของวิชา หัวข้อสำคัญ ลักษณะการเรียน..."
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                maxLength={2000}
              />
              <span className="field-hint">คัดลอกจาก mis.cmu.ac.th หรือเว็บลงทะเบียนของ มช. ก็ได้</span>
            </div>

            <div className="field">
              <label className="field-label">เงื่อนไขที่ต้องผ่านก่อนเรียน (Prerequisite)</label>
              <input
                className="input"
                placeholder='เช่น 204111 และ 204112 หรือ "ไม่มีเงื่อนไข"'
                value={form.prerequisite}
                onChange={(e) => set('prerequisite', e.target.value)}
                maxLength={500}
              />
              <span className="field-hint">ระบุรหัสวิชาที่ต้องผ่านก่อน ถ้าไม่มีให้ใส่ "ไม่มี" หรือเว้นว่างได้</span>
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
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate('/')}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!filled || submitting}>
            <IconCheck /> {submitting ? 'กำลังบันทึก...' : 'เพิ่มวิชา'}
          </button>
        </div>
      </form>
    </div>
  )
}
