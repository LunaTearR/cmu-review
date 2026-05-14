import type { CourseInsight, CourseInsightGroup, CourseInsightTag } from '@/types/course'

interface Props {
  insight: CourseInsight
}

const MIN_REVIEWS_FOR_INSIGHT = 3

export function CourseInsightPanel({ insight }: Props) {
  // Hide entirely below the floor — stats from <3 reviews aren't trustworthy.
  if (insight.total_reviews < MIN_REVIEWS_FOR_INSIGHT) return null
  if (insight.groups.length === 0 && insight.badges.length === 0 && insight.warnings.length === 0) {
    return null
  }

  const showPct = insight.total_reviews >= insight.min_reviews_for_stats
  const hasBadges = insight.badges.length > 0
  const hasWarnings = insight.warnings.length > 0
  const hasGroups = insight.groups.length > 0

  return (
    <div className="card card-pad">
      <div className="caption" style={{ marginBottom: 10 }}>ไฮไลต์จากแท็กรีวิว</div>

      {hasBadges && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: hasWarnings || hasGroups ? 10 : 0 }}>
          {insight.badges.map(b => (
            <span
              key={b}
              className="tag"
              style={{
                background: 'color-mix(in srgb, var(--accent-mint) 18%, transparent)',
                color: 'var(--accent-mint)',
                border: '1px solid color-mix(in srgb, var(--accent-mint) 45%, transparent)',
                fontWeight: 600,
              }}
              title="ผลสรุปจากการติ๊กของผู้รีวิว"
            >
              ✓ {b}
            </span>
          ))}
        </div>
      )}

      {hasWarnings && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: hasGroups ? 14 : 0 }}>
          {insight.warnings.map(w => (
            <span
              key={w}
              className="tag"
              style={{
                background: 'color-mix(in srgb, var(--accent-rose) 14%, transparent)',
                color: 'var(--accent-rose)',
                border: '1px solid color-mix(in srgb, var(--accent-rose) 40%, transparent)',
                fontWeight: 600,
              }}
              title="คำเตือนจากการติ๊กของผู้รีวิว"
            >
              ⚠ {w}
            </span>
          ))}
        </div>
      )}

      {hasGroups && (
        <>
          {(hasBadges || hasWarnings) && <hr className="divider" style={{ margin: '4px 0 14px' }} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {insight.groups.map(g => (
              <GroupBlock key={g.key} group={g} showPct={showPct} />
            ))}
          </div>
        </>
      )}

      <div className="caption" style={{ marginTop: 14, color: 'var(--ink-4)' }}>
        จาก {insight.total_reviews} รีวิวทั้งหมด
      </div>
    </div>
  )
}

function GroupBlock({ group, showPct }: { group: CourseInsightGroup; showPct: boolean }) {
  if (group.tags.length === 0) return null

  return (
    <div>
      <div
        className="caption"
        style={{
          marginBottom: 8,
          fontWeight: 600,
          color: 'var(--brand-deep)',
          letterSpacing: '0.02em',
        }}
      >
        {group.title}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {group.tags.map(t => (
          <TagRow key={t.tag} tag={t} base={group.base} showPct={showPct} />
        ))}
      </div>

      <div className="caption" style={{ marginTop: 8, color: 'var(--ink-4)' }}>
        สรุปจาก {group.base} รีวิวที่ให้ข้อมูลด้านนี้
      </div>
    </div>
  )
}

function TagRow({
  tag,
  base,
  showPct,
}: {
  tag: CourseInsightTag
  base: number
  showPct: boolean
}) {
  // Bar width is count / group base, never count / total reviews.
  const widthPct = base > 0 ? Math.min(100, (tag.count / base) * 100) : 0

  const label = showPct
    ? `${tag.count} คน (${tag.percentage.toFixed(0)}%)`
    : `${tag.count} คนพูดถึง`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, rowGap: 4 }}>
      <span className="body-sm" style={{ color: 'var(--ink-1)' }}>{tag.tag}</span>
      <span className="caption mono" style={{ color: 'var(--ink-3)' }}>{label}</span>
      <div
        style={{
          gridColumn: '1 / -1',
          height: 6,
          background: 'var(--bg-soft)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${widthPct}%`,
            height: '100%',
            background: 'var(--brand)',
            borderRadius: 999,
            transition: 'width .25s ease',
          }}
        />
      </div>
    </div>
  )
}
