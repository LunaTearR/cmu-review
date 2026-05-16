import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchSemanticSearch } from '@/api/semantic'
import type { SemanticHit } from '@/types/semantic'
import { PawRating } from '@/components/PawRating'
import { PawScatter } from '@/components/PawScatter'
import { IconArrow, IconBack } from '@/components/Icons'

const SUGGESTIONS = ['ตัวฟรี', 'ไม่สอบ', 'เกรดดี', 'งานน้อย', 'อาจารย์น่ารัก', 'ไม่เข้าเรียน']

// const TAG_FILTERS: { group: string; tags: string[] }[] = [
//   {
//     group: 'งาน',
//     tags: ['งานน้อย ทำสบาย', 'งานค่อนข้างเยอะ', 'งานสม่ำเสมอตลอดเทอม', 'ส่งงานครบคะแนนไม่ยาก'],
//   },
//   {
//     group: 'สอบ / คะแนน',
//     tags: ['เน้นสอบเป็นหลัก', 'เก็บคะแนนจากงานเป็นหลัก', 'เหมาะกับคนอยากเก็บเกรด', 'ข้อสอบอิงสไลด์ / ที่สอน'],
//   },
//   {
//     group: 'การเข้าเรียน',
//     tags: ['ไม่เช็คชื่อ', 'เช็คชื่อเกือบทุกคาบ', 'มีเรียนออนไลน์', 'เหมาะกับคนไม่ชอบเข้าเรียน'],
//   },
//   {
//     group: 'การสอน',
//     tags: ['สอนเข้าใจง่าย', 'สอนละเอียดเป็นขั้นตอน', 'สอนตามสไลด์', 'เน้นเล่าประสบการณ์ / เคสจริง'],
//   },
// ]

const Sparkle = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4L12 3z" />
    <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7L19 14z" />
    <path d="M5 16l.5 1.4L7 18l-1.5.6L5 16z" />
  </svg>
)

// const Chevron = ({ open }: { open: boolean }) => (
//   <svg
//     width={14}
//     height={14}
//     viewBox="0 0 24 24"
//     fill="none"
//     stroke="currentColor"
//     strokeWidth="2.2"
//     strokeLinecap="round"
//     strokeLinejoin="round"
//     style={{ transition: 'transform .2s var(--t-easing)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
//     aria-hidden
//   >
//     <path d="M6 9l6 6 6-6" />
//   </svg>
// )

function scoreBucket(score: number): { label: string; tone: 'strong' | 'medium' } | null {
  if (score >= 0.75) return { label: 'ตรงมาก', tone: 'strong' }
  if (score >= 0.5) return { label: 'เกี่ยวข้อง', tone: 'medium' }
  return null
}

function parseTags(raw: string | null): string[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildHighlightTokens(query: string, tags: string[]): string[] {
  const fromQuery = query
    .split(/\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 2)
  const fromTags = tags.flatMap(t =>
    t
      .split(/[\s/]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 2),
  )
  const dedup = Array.from(new Set([...fromQuery, ...fromTags]))
  return dedup.sort((a, b) => b.length - a.length)
}

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>
  const pat = new RegExp(`(${tokens.map(escapeRe).join('|')})`, 'gi')
  const parts = text.split(pat)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            style={{
              background: 'color-mix(in oklab, var(--accent-rose) 30%, var(--surface))',
              color: 'var(--ink-1)',
              padding: '0 3px',
              borderRadius: 3,
              fontWeight: 700,
              boxShadow: '0 0 0 1px color-mix(in oklab, var(--accent-rose) 40%, transparent)',
            }}
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

// function useIsWide(minPx = 1024) {
//   const query = `(min-width: ${minPx}px)`
//   const [wide, setWide] = useState<boolean>(() =>
//     typeof window !== 'undefined' ? window.matchMedia(query).matches : true,
//   )
//   useEffect(() => {
//     const mql = window.matchMedia(query)
//     const fn = (e: MediaQueryListEvent) => setWide(e.matches)
//     mql.addEventListener('change', fn)
//     return () => mql.removeEventListener('change', fn)
//   }, [query])
//   return wide
// }

export function DiscoverPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''
  const initialTags = parseTags(searchParams.get('tags'))
  // const isWide = useIsWide(1024)
  const [input, setInput] = useState(initialQuery)
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery)
  const [activeTags, setActiveTags] = useState<string[]>(initialTags)
  // const [filterOpen, setFilterOpen] = useState<boolean>(isWide)
  const [hits, setHits] = useState<SemanticHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // useEffect(() => {
  //   setFilterOpen(isWide)
  // }, [isWide])

  useEffect(() => {
    const q = searchParams.get('q')?.trim() ?? ''
    const tags = parseTags(searchParams.get('tags'))
    setSubmittedQuery(q)
    setInput(q)
    setActiveTags(tags)
    if (!q) {
      setHits([])
      setError(null)
      return
    }
    if (q.length < 3) {
      setError('พิมพ์อย่างน้อย 3 ตัวอักษร')
      setHits([])
      return
    }
    setLoading(true)
    setError(null)
    fetchSemanticSearch(q, 12, tags)
      .then(r => setHits(r.data ?? []))
      .catch((e: Error) => setError(e.message || 'ค้นหาไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [searchParams])

  const writeUrl = (q: string, tags: string[]) => {
    const next: Record<string, string> = {}
    if (q.trim()) next.q = q.trim()
    if (tags.length > 0) next.tags = tags.join(',')
    setSearchParams(next)
  }

  const submit = (q: string) => {
    const t = q.trim()
    if (!t) return
    writeUrl(t, activeTags)
  }

  // const toggleTag = (tag: string) => {
  //   const next = activeTags.includes(tag)
  //     ? activeTags.filter(t => t !== tag)
  //     : [...activeTags, tag]
  //   setActiveTags(next)
  //   if (submittedQuery) writeUrl(submittedQuery, next)
  //   else if (input.trim()) writeUrl(input, next)
  // }

  const clearTags = () => {
    setActiveTags([])
    if (submittedQuery) writeUrl(submittedQuery, [])
  }

  const onSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit(input)
  }

  const showEmpty = !loading && !error && submittedQuery && hits.length === 0
  const showLanding = !submittedQuery && !loading
  const visibleHits = useMemo(() => hits.filter(h => scoreBucket(h.score) !== null), [hits])
  const highlightTokens = useMemo(
    () => buildHighlightTokens(submittedQuery, activeTags),
    [submittedQuery, activeTags],
  )

  return (
    <div className="fade-in">
      <section
        className="section"
        style={{
          paddingTop: 'clamp(32px, 6vw, 56px)',
          paddingBottom: 28,
          background:
            'linear-gradient(135deg, var(--brand-tint) 0%, color-mix(in oklab, var(--accent-rose) 14%, var(--bg-soft)) 100%)',
          borderBottom: '1px solid var(--border)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <PawScatter count={2} seed={903} sizeMin={360} sizeMax={580} />
        <div className="shell" style={{ position: 'relative' }}>
          <button
            onClick={() => navigate("/")}
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 16 }}
          >
            <IconBack /> กลับ
          </button>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 'var(--r-pill)',
              background: 'color-mix(in oklab, var(--brand) 32%, var(--surface))',
              color: 'var(--brand-deep)',
              border: '1px solid color-mix(in oklab, var(--brand) 35%, transparent)',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            <Sparkle size={16} /> ค้นหาสิ่งที่คุณต้องการ · ขับเคลื่อนด้วย AI
          </div>
          <h1 className="h-1" style={{ margin: '0 0 6px', color: 'var(--brand-deep)' }}>
            บอกเราว่าอยากได้วิชาแบบไหน
          </h1>
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
            ลองพิมพ์ค้นหาได้เลย เช่น "ตัวฟรี", "อาจารย์น่ารัก ให้เกรดดี"
          </p>

          <div className="search-hero" style={{ marginTop: 22, maxWidth: 720 }}>
            <Sparkle size={20} />
            <input
              placeholder='ลองพิมพ์ เช่น "ตัวฟรี", "อาจารย์น่ารัก ให้เกรดดี"'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onSubmit}
              autoFocus
              aria-label="ค้นหาด้วยภาษาธรรมชาติ"
            />
            <button className="btn btn-primary" onClick={() => submit(input)}>
              ค้นหา
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <span
              className="caption"
              style={{
                color: 'var(--ink-2)',
                fontWeight: 600,
                marginRight: 2,
              }}
            >
              ลองดู:
            </span>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="tag"
                style={{
                  cursor: 'pointer',
                  border: '1px solid color-mix(in oklab, var(--brand) 35%, var(--border-strong))',
                  background: 'var(--surface)',
                  color: 'var(--ink-1)',
                  fontWeight: 600,
                  fontSize: 13,
                  padding: '5px 12px',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* <FilterPanel
            open={filterOpen}
            onToggle={() => setFilterOpen(v => !v)}
            activeTags={activeTags}
            toggleTag={toggleTag}
            clearTags={clearTags}
          /> */}

          <p
            className="caption"
            style={{
              marginTop: 14,
              color: 'color-mix(in oklab, var(--brand-deep) 60%, var(--ink-3))',
            }}
          >
            ℹ ระบบใช้ AI ของ Google ในการประมวลผล — อาจจะไม่แม่นยำ 100% แต่จะพยายามหาวิชาที่ตรงกับความต้องการของคุณมากที่สุด
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          {loading && (
            <div className="responsive-grid-2">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="card"
                  style={{
                    minHeight: 180,
                    padding: 'clamp(16px, 2.5vw, 24px)',
                    animation: 'fadeIn .34s var(--t-easing) both',
                  }}
                >
                  <div style={{ height: 16, width: '35%', background: 'var(--border-strong)', borderRadius: 6, marginBottom: 12, opacity: 0.55 }} />
                  <div style={{ height: 22, width: '75%', background: 'var(--border-strong)', borderRadius: 6, marginBottom: 8, opacity: 0.7 }} />
                  <div style={{ height: 14, width: '90%', background: 'var(--border-strong)', borderRadius: 6, marginBottom: 18, opacity: 0.45 }} />
                  <div style={{ height: 60, background: 'var(--bg-soft)', borderRadius: 8 }} />
                </div>
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--ink-2)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
              <h3 className="h-3" style={{ margin: 0 }}>เกิดข้อผิดพลาด</h3>
              <p className="body" style={{ marginTop: 8, color: 'var(--ink-2)' }}>{error}</p>
            </div>
          )}

          {showEmpty && (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>🐾</div>
              <h3 className="h-3" style={{ margin: 0 }}>
                ยังไม่เจอวิชาที่ตรงกับ "{submittedQuery}"
                {activeTags.length > 0 && ' ภายใต้แท็กที่เลือก'}
              </h3>
              <p className="body" style={{ marginTop: 8, color: 'var(--ink-2)' }}>
                {activeTags.length > 0
                  ? 'ลองเอาแท็กออกบางอัน หรือเปลี่ยนคำค้น'
                  : 'ลองค้นด้วยคำอื่น หรือดูตัวอย่างด้านบน'}
              </p>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {activeTags.length > 0 && (
                  <button onClick={clearTags} className="btn btn-ghost btn-sm">
                    ล้างแท็ก
                  </button>
                )}
                <Link
                  to={`/search?q=${encodeURIComponent(submittedQuery)}`}
                  className="btn btn-ghost btn-sm"
                >
                  ลองค้นแบบรหัส/ชื่อวิชาแทน <IconArrow />
                </Link>
              </div>
            </div>
          )}

          {showLanding && (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
              <h3 className="h-3" style={{ margin: 0 }}>เริ่มต้นด้วยการพิมพ์ หรือเลือกตัวอย่างด้านบน</h3>
              <p className="body" style={{ marginTop: 8, color: 'var(--ink-2)', maxWidth: 480, marginInline: 'auto' }}>
                ระบบจะมองหาวิชาที่รีวิวจริงจากเพื่อนๆ ตรงกับสิ่งที่คุณค้น
              </p>
            </div>
          )}

          {!loading && !error && visibleHits.length > 0 && (
            <>
              <div className="section-head" style={{ marginBottom: 18, alignItems: 'baseline' }}>
                <div>
                  <div className="eyebrow">ผลค้นหา</div>
                  <h2 className="h-2" style={{ margin: 0 }}>
                    พบ {visibleHits.length} วิชาที่เกี่ยวข้องกับ "{submittedQuery}"
                  </h2>
                </div>
              </div>
              <div className="responsive-grid-2">
                {visibleHits.map(hit => (
                  <HitCard
                    key={hit.course.id}
                    hit={hit}
                    highlightTokens={highlightTokens}
                    activeTags={activeTags}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

// function FilterPanel({
//   open,
//   onToggle,
//   activeTags,
//   toggleTag,
//   clearTags,
// }: {
//   open: boolean
//   onToggle: () => void
//   activeTags: string[]
//   toggleTag: (t: string) => void
//   clearTags: () => void
// }) {
//   const count = activeTags.length
//   return (
//     <div style={{ marginTop: 20 }}>
//       <div
//         style={{
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'space-between',
//           gap: 8,
//           flexWrap: 'wrap',
//         }}
//       >
//         <button
//           type="button"
//           onClick={onToggle}
//           aria-expanded={open}
//           aria-controls="discover-filter-body"
//           className="btn btn-ghost btn-sm"
//           style={{
//             display: 'inline-flex',
//             alignItems: 'center',
//             gap: 8,
//             padding: '8px 14px',
//             minHeight: 40,
//             fontWeight: 600,
//             color: 'var(--brand-deep)',
//             border: '1px solid color-mix(in oklab, var(--brand) 25%, var(--border))',
//             background: 'var(--surface)',
//           }}
//         >
//           ปรับการค้นหา
//           {count > 0 && (
//             <span
//               style={{
//                 display: 'inline-flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 minWidth: 20,
//                 height: 20,
//                 padding: '0 6px',
//                 fontSize: 12,
//                 fontWeight: 700,
//                 color: 'white',
//                 background: 'var(--accent-rose)',
//                 borderRadius: 999,
//               }}
//             >
//               {count}
//             </span>
//           )}
//           <Chevron open={open} />
//         </button>
//         {count > 0 && (
//           <button
//             type="button"
//             onClick={clearTags}
//             className="btn btn-ghost btn-sm"
//             style={{ padding: '4px 10px' }}
//           >
//             ล้างทั้งหมด
//           </button>
//         )}
//       </div>

//       {!open && count > 0 && (
//         <div
//           style={{
//             marginTop: 10,
//             display: 'flex',
//             gap: 6,
//             overflowX: 'auto',
//             paddingBottom: 4,
//             WebkitOverflowScrolling: 'touch',
//           }}
//         >
//           {activeTags.map(t => (
//             <button
//               key={t}
//               onClick={() => toggleTag(t)}
//               className="tag"
//               title="คลิกเพื่อเอาออก"
//               style={{
//                 cursor: 'pointer',
//                 flexShrink: 0,
//                 fontSize: 12.5,
//                 background: 'color-mix(in oklab, var(--accent-rose) 22%, var(--surface))',
//                 color: 'var(--accent-rose)',
//                 border: '1px solid var(--accent-rose)',
//                 fontWeight: 600,
//               }}
//             >
//               {t} ✕
//             </button>
//           ))}
//         </div>
//       )}

//       <div
//         id="discover-filter-body"
//         hidden={!open}
//         style={{
//           marginTop: 12,
//           padding: 'clamp(14px, 2vw, 20px)',
//           background: 'var(--surface)',
//           border: '1px solid var(--border)',
//           borderRadius: 'var(--r-md)',
//           boxShadow: 'var(--shadow-sm)',
//           display: 'grid',
//           gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
//           gap: 18,
//         }}
//       >
//         {TAG_FILTERS.map(grp => (
//           <div key={grp.group}>
//             <div
//               style={{
//                 marginBottom: 8,
//                 color: 'var(--ink-1)',
//                 fontWeight: 700,
//                 fontSize: 12,
//                 letterSpacing: '0.05em',
//                 textTransform: 'uppercase',
//               }}
//             >
//               {grp.group}
//             </div>
//             <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
//               {grp.tags.map(tag => {
//                 const active = activeTags.includes(tag)
//                 return (
//                   <button
//                     key={tag}
//                     onClick={() => toggleTag(tag)}
//                     className="tag"
//                     aria-pressed={active}
//                     style={{
//                       cursor: 'pointer',
//                       fontSize: 12.5,
//                       padding: '5px 11px',
//                       border: active
//                         ? '1px solid var(--accent-rose)'
//                         : '1px solid color-mix(in oklab, var(--brand) 35%, var(--border-strong))',
//                       background: active
//                         ? 'color-mix(in oklab, var(--accent-rose) 22%, var(--surface))'
//                         : 'var(--surface)',
//                       color: active ? 'var(--accent-rose)' : 'var(--ink-1)',
//                       fontWeight: active ? 700 : 600,
//                     }}
//                   >
//                     {active ? '✓ ' : ''}{tag}
//                   </button>
//                 )
//               })}
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   )
// }

function HitCard({
  hit,
  highlightTokens,
  activeTags,
}: {
  hit: SemanticHit
  highlightTokens: string[]
  activeTags: string[]
}) {
  const bucket = scoreBucket(hit.score)
  if (!bucket) return null
  const isStrong = bucket.tone === 'strong'

  const matchedTagsInCard = activeTags.slice(0, 2)

  return (
    <Link
      to={`/courses/${hit.course.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <article
        className="card card-hover"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          height: '100%',
          padding: 'clamp(16px, 2.5vw, 24px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span className="cc-code">{hit.course.course_id}</span>
            <h3 className="cc-title line-clamp-2" style={{ margin: 0, lineHeight: 1.4 }}>{hit.course.name_th}</h3>
            <div className="cc-title-en line-clamp-1">{hit.course.name_en}</div>
          </div>
          <span
            className="tag"
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: isStrong
                ? 'color-mix(in oklab, var(--accent-rose) 22%, transparent)'
                : 'color-mix(in oklab, var(--brand) 18%, transparent)',
              color: isStrong ? 'var(--accent-rose)' : 'var(--brand-deep)',
              border: '1px solid currentColor',
              fontWeight: 600,
            }}
          >
            <Sparkle size={12} /> {bucket.label}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
            fontSize: 13,
            color: 'var(--ink-2)',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--brand-deep)' }}>ตรงเพราะ:</span>
          {matchedTagsInCard.length > 0 ? (
            matchedTagsInCard.map(t => (
              <span
                key={t}
                className="tag"
                style={{
                  fontSize: 11.5,
                  padding: '2px 8px',
                  background: 'color-mix(in oklab, var(--accent-rose) 18%, var(--surface))',
                  color: 'var(--accent-rose)',
                  border: '1px solid color-mix(in oklab, var(--accent-rose) 50%, transparent)',
                  fontWeight: 600,
                }}
              >
                {t}
              </span>
            ))
          ) : (
            <span>มีรีวิวจริงพูดถึงเรื่องนี้</span>
          )}
          {hit.matched_count > 1 && (
            <span style={{ marginLeft: 'auto' }}>· {hit.matched_count} รีวิวใกล้เคียง</span>
          )}
        </div>

        {hit.top_review_text && (
          <blockquote
            style={{
              margin: 0,
              padding: '12px 14px',
              borderRadius: 'var(--r-md)',
              background: 'var(--bg-soft)',
              borderLeft: '3px solid var(--brand)',
              color: 'var(--ink-1)',
              fontSize: 14.5,
              lineHeight: 1.65,
            }}
          >
            <div className="caption" style={{ marginBottom: 4, color: 'var(--ink-3)' }}>
              💬 รีวิวที่ตรงที่สุด
            </div>
            <span className="line-clamp-3" style={{ display: '-webkit-box' }}>
              <Highlight text={hit.top_review_text} tokens={highlightTokens} />
            </span>
          </blockquote>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 'auto',
            paddingTop: 12,
            borderTop: '1px dashed var(--border)',
          }}
        >
          <span className="tag" style={{ fontSize: 11.5 }}>{hit.course.faculty.name_th}</span>
          <span className="tag tag-brand" style={{ fontSize: 11.5 }}>{hit.course.credits} หน่วยกิต</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <PawRating value={hit.course.avg_rating} />
            {hit.course.review_count > 0 && (
              <span className="body-sm mono" style={{ fontWeight: 600 }}>
                {hit.course.avg_rating.toFixed(1)}
              </span>
            )}
            <span className="caption">· {hit.course.review_count} รีวิว</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
