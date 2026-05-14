interface AISummaryCardProps {
  summary: string
}

const SparkleIcon = () => (
  <svg
    width="20"
    height="20"
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
    <path d="M5 16l.5 1.4L7 18l-1.5.6L5 20l-.5-1.4L3 18l1.5-.6L5 16z" />
  </svg>
)

export function AISummaryCard({ summary }: AISummaryCardProps) {
  if (!summary || !summary.trim()) return null

  return (
    <section
      aria-label="สรุปรีวิวจากนักศึกษาโดย AI"
      style={{
        marginBottom: 24,
        padding: '20px 22px',
        borderRadius: 'var(--r-lg)',
        background:
          'linear-gradient(135deg, var(--brand-tint) 0%, color-mix(in oklab, var(--accent-rose) 14%, var(--bg-soft)) 100%)',
        border: '1px solid color-mix(in oklab, var(--brand) 30%, var(--border))',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          color: 'var(--brand-deep)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 'var(--r-pill)',
            background: 'color-mix(in oklab, var(--brand) 22%, transparent)',
            color: 'var(--brand-deep)',
          }}
        >
          <SparkleIcon />
        </span>
        <div>
          <h2
            className="h-3"
            style={{ margin: 0, color: 'var(--brand-deep)', lineHeight: 1.2 }}
          >
            สรุปรีวิวจากนักศึกษาโดย AI
          </h2>
          <div
            className="caption"
            style={{
              marginTop: 2,
              color: 'color-mix(in oklab, var(--brand-deep) 70%, var(--ink-3))',
            }}
          >
            สังเคราะห์จากรีวิวจริงของผู้เรียนวิชานี้
          </div>
        </div>
      </header>

      <p
        className="body"
        style={{
          margin: 0,
          color: 'var(--ink-1)',
          lineHeight: 1.85,
          whiteSpace: 'pre-wrap',
          textWrap: 'pretty',
          fontSize: 15.5,
        }}
      >
        {summary}
      </p>
    </section>
  )
}
