export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        paddingBottom: 24,
        borderBottom: "1px solid var(--border-light)",
        marginBottom: 28,
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <div>
        {eyebrow && (
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 500,
              color: "var(--success)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              margin: "0 0 8px",
            }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "#0a0a0a",
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: "var(--text-light)",
              margin: "6px 0 0",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div
          style={{
            display: "flex",
            gap: 10,
            flexShrink: 0,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
