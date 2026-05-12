import type { Faculty } from '@/types/faculty'
import { IconFilter, IconClose } from './Icons'

interface Props {
  faculties: Faculty[]
  facCode: string
  cats: string[]
  credits: number[]
  categories: string[]
  creditOptions: number[]
  activeCount: number
  open: boolean
  variant?: 'inline' | 'drawer'
  onSelectFaculty: (code: string) => void
  onToggleCat: (cat: string) => void
  onToggleCredit: (n: number) => void
  onClear: () => void
  onClose: () => void
}

export function CourseFilterPanel({
  faculties, facCode, cats, credits, categories, creditOptions, activeCount, open, variant = 'inline',
  onSelectFaculty, onToggleCat, onToggleCredit, onClear, onClose,
}: Props) {
  const variantClass = variant === 'drawer' ? 'is-drawer' : 'is-inline'
  return (
    <aside
      className={`filter-panel ${variantClass} ${open ? 'is-open' : ''}`}
      role={variant === 'drawer' ? 'dialog' : undefined}
      aria-label="ตัวกรอง"
      aria-hidden={variant === 'drawer' ? !open : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h3 className="h-3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconFilter /> ตัวกรอง
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeCount > 0 && (
            <button onClick={onClear} className="caption" style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--brand-deep)' }}>
              ล้าง ({activeCount})
            </button>
          )}
          <button
            className="filter-drawer-close"
            onClick={onClose}
            aria-label="ปิดตัวกรอง"
            type="button"
          >
            <IconClose />
          </button>
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-group-label">หมวดหมู่วิชา</div>
        {categories.map(c => (
          <div key={c} className="checkbox-row" onClick={() => onToggleCat(c)}>
            <span className={`cbox ${cats.includes(c) ? 'is-on' : ''}`} />
            <span>{c}</span>
          </div>
        ))}
      </div>

      <div className="filter-group" role="radiogroup" aria-label="คณะ">
        <div className="filter-group-label">คณะ (เลือกได้ 1)</div>
        <div className="fac-scroll" style={{ maxHeight: 260, overflowY: 'auto', marginRight: -6, paddingRight: 6 }}>
          {faculties.map(f => {
            const on = facCode === f.code
            return (
              <div
                key={f.id}
                className={`radio-row ${on ? 'is-on' : ''}`}
                onClick={() => onSelectFaculty(f.code)}
                role="radio"
                aria-checked={on}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectFaculty(f.code) } }}
              >
                <span className={`rbox ${on ? 'is-on' : ''}`} />
                <span className="truncate" style={{ flex: 1 }}>{f.name_th}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-group-label">หน่วยกิต</div>
        {creditOptions.map(n => (
          <div key={n} className="checkbox-row" onClick={() => onToggleCredit(n)}>
            <span className={`cbox ${credits.includes(n) ? 'is-on' : ''}`} />
            <span>{n} หน่วยกิต</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
