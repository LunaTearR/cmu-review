import { useState, useRef, useEffect, useId } from 'react'

export interface SelectOption {
  value: string | number
  label: string
  searchKeys?: string[] // extra strings to match against (e.g. name_en, code)
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

  useEffect(() => {
    if (!open) { setQuery(''); setHighlighted(0) }
  }, [open])

  useEffect(() => { setHighlighted(0) }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (opt: SelectOption) => { onChange(opt.value); setOpen(false) }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } return }
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); scrollHighlighted() }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); scrollHighlighted() }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) select(filtered[highlighted]) }
  }

  const scrollHighlighted = () => {
    const el = listRef.current?.children[highlighted] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }} onKeyDown={handleKeyDown}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); if (!open) setTimeout(() => inputRef.current?.focus(), 0) }}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.5rem 0.75rem',
          background: disabled ? 'var(--cmu-bg)' : '#fff',
          border: '1px solid var(--cmu-border)',
          borderRadius: 8,
          fontSize: '0.9375rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: selected ? 'var(--cmu-text)' : 'var(--cmu-text-muted)',
          minWidth: 140,
          whiteSpace: 'nowrap',
          opacity: disabled ? 0.6 : 1,
          fontFamily: 'inherit',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--cmu-text-muted)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 300,
          background: '#fff',
          border: '1px solid var(--cmu-border)',
          borderRadius: 8,
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          minWidth: '100%',
          maxHeight: 280,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {options.length > 6 && (
            <div style={{ padding: '0.5rem 0.5rem 0' }}>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="พิมพ์เพื่อค้นหา..."
                style={{
                  width: '100%',
                  padding: '0.375rem 0.625rem',
                  border: '1px solid var(--cmu-border)',
                  borderRadius: 6,
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}
          <ul
            ref={listRef}
            role="listbox"
            style={{
              margin: 0,
              padding: '0.375rem 0',
              listStyle: 'none',
              overflowY: 'auto',
              maxHeight: 220,
            }}
          >
            {filtered.length === 0 ? (
              <li style={{ padding: '0.5rem 0.75rem', color: 'var(--cmu-text-muted)', fontSize: '0.875rem' }}>
                ไม่พบผลลัพธ์
              </li>
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
                      padding: '0.4rem 0.75rem',
                      cursor: 'pointer',
                      fontSize: '0.9375rem',
                      background: isHighlighted || isActive ? 'rgba(90,50,150,0.07)' : 'transparent',
                      color: isActive ? 'var(--cmu-primary)' : 'var(--cmu-text)',
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
