type Group = { title: string; tags: string[] }

const GROUPS: Group[] = [
  {
    title: 'การเข้าเรียน / เช็คชื่อ',
    tags: [
      'ไม่เช็คชื่อ',
      'เช็คชื่อเกือบทุกคาบ',
      'ไม่บังคับเข้าเรียน',
      'มีเรียนออนไลน์',
      'ไม่มีคลาสเรียน',
    ],
  },
  {
    title: 'ภาระงานระหว่างเทอม',
    tags: [
      'งานน้อย ทำสบาย',
      'งานสม่ำเสมอตลอดเทอม',
      'งานค่อนข้างเยอะ',
      'มีโปรเจกต์ใหญ่ปลายเทอม',
      'มีแล็บ / ปฏิบัติการ',
      'งานกลุ่มเป็นหลัก',
      'งานเดี่ยวเป็นหลัก',
    ],
  },
  {
    title: 'การวัดผล / การให้คะแนน',
    tags: [
      'เน้นสอบเป็นหลัก',
      'ข้อสอบอิงสไลด์ / ที่สอน',
      'เก็บคะแนนจากงานเป็นหลัก',
      'ส่งงานครบคะแนนไม่ยาก',
      'ข้อสอบยาก ต้องอ่านเพิ่ม',
    ],
  },
  {
    title: 'ลักษณะการสอน',
    tags: [
      'สอนเข้าใจง่าย',
      'สอนละเอียดเป็นขั้นตอน',
      'สอนไว ต้องตามเอง',
      'สอนตามสไลด์',
      'เน้นเล่าประสบการณ์ / เคสจริง',
      'ต้องอ่านและศึกษาด้วยตัวเองเยอะ',
    ],
  },
  {
    title: 'เหมาะกับนักศึกษาแบบไหน',
    tags: [
      'เหมาะกับคนไม่ชอบเข้าเรียน',
      'เหมาะกับคนอยากเก็บเกรด',
      'เหมาะกับคนขยันทำงานสม่ำเสมอ',
      'เหมาะกับคนชอบทำงานกลุ่ม',
      'ควรมีพื้นฐานมาก่อน',
      'เหมาะกับคนอยากนำความรู้ไปใช้จริง',
    ],
  },
]

export const INSIGHT_TAGS = GROUPS.flatMap(g => g.tags)

interface Props {
  value: string[]
  onChange: (next: string[]) => void
}

export function InsightCheckboxes({ value, onChange }: Props) {
  const selected = new Set(value)

  const toggle = (tag: string) => {
    const next = new Set(selected)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    onChange(GROUPS.flatMap(g => g.tags).filter(t => next.has(t)))
  }

  return (
    <div className="form-section">
      <div className="form-section-title">สรุปสั้นๆ ด้วยการติ๊ก</div>
      <div className="field-hint" style={{ marginTop: -4, marginBottom: 12 }}>
        เลือกแทนการพิมพ์ได้เลย (ไม่บังคับ)
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {GROUPS.map(g => (
          <fieldset
            key={g.title}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              padding: '12px 14px',
              margin: 0,
              background: 'var(--bg-soft)',
            }}
          >
            <legend
              style={{
                padding: '0 6px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--brand-deep)',
              }}
            >
              {g.title}
            </legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {g.tags.map(tag => {
                const on = selected.has(tag)
                return (
                  <label
                    key={tag}
                    className={`insight-chip${on ? ' is-on' : ''}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: `1px solid ${on ? 'var(--brand-deep)' : 'var(--border-strong)'}`,
                      background: on ? 'var(--brand-tint)' : 'var(--bg)',
                      color: on ? 'var(--brand-ink)' : 'var(--ink-2)',
                      fontSize: 13,
                      fontWeight: on ? 600 : 500,
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'background .15s, border-color .15s, color .15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(tag)}
                      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                      aria-label={tag}
                    />
                    <span aria-hidden="true" style={{ fontSize: 12 }}>{on ? '✓' : '+'}</span>
                    <span>{tag}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  )
}
