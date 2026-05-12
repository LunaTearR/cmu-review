import { useState, useRef, useEffect, useId } from 'react'

export interface SelectOption {
  value: string | number
  label: string
  searchKeys?: string[]
}

interface Props {
  options: SelectOption[]
  value: string | number
  onChange: (value: string | number) => void
  placeholder?: string
  disabled?: boolean
}

export function SearchableSelect({ options, value, onChange, placeholder = 'เลือก...', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [highlighted, setHighlighted] = useState(0)
  const id = useId()

  const selected = options.find(o => o.value === value)

  const filtered = query
    ? options.filter(o => {
        const q = query.toLowerCase()
        if (o.label.toLowerCase().includes(q)) return true
        return o.searchKeys?.some(k => k.toLowerCase().includes(q)) ?? false
      })
    : options

  useEffect(() => { if (!open) { setQuery(''); setHighlighted(0) } }, [open])
  useEffect(() => { setHighlighted(0) }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (opt: SelectOption) => { onChange(opt.value); setOpen(false) }

  const scrollHighlighted = () => {
    const el = listRef.current?.children[highlighted] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) }
      return
    }
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); scrollHighlighted() }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); scrollHighlighted() }
    if (e.key === 'Enter')     { e.preventDefault(); if (filtered[highlighted]) select(filtered[highlighted]) }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', minWidth: 0 }} onKeyDown={handleKeyDown}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); if (!open) setTimeout(() => inputRef.current?.focus(), 0) }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="input"
        style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          padding: '10px 14px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: selected ? 'var(--ink-1)' : 'var(--ink-4)',
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--ink-4)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--shadow-lg)',
          minWidth: '100%', maxHeight: 280,
          display: 'flex', flexDirection: 'column',
        }}>
          {options.length > 6 && (
            <div style={{ padding: '8px 8px 0' }}>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="พิมพ์เพื่อค้นหา..."
                className="input"
                style={{ padding: '8px 10px', fontSize: 14 }}
              />
            </div>
          )}
          <ul
            ref={listRef}
            role="listbox"
            style={{ margin: 0, padding: '6px 0', listStyle: 'none', overflowY: 'auto', maxHeight: 220 }}
          >
            {filtered.length === 0 ? (
              <li style={{ padding: '8px 14px', color: 'var(--ink-4)', fontSize: 14 }}>ไม่พบผลลัพธ์</li>
            ) : (
              filtered.map((opt, i) => {
                const isActive = opt.value === value
                const isHighlighted = i === highlighted
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => select(opt)}
                    onMouseEnter={() => setHighlighted(i)}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      fontSize: 14,
                      background: isHighlighted || isActive ? 'var(--bg-soft)' : 'transparent',
                      color: isActive ? 'var(--brand-deep)' : 'var(--ink-2)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
