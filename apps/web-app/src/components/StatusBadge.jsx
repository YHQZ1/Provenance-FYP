export const StatusCard = ({
  title,
  value,
  status = "neutral",
  description,
}) => {
  const variants = {
    success: {
      label: "Complete",
      color: "var(--success)",
      bg: "var(--success-bg)",
    },
    warning: {
      label: "Pending",
      color: "var(--warning)",
      bg: "var(--warning-bg)",
    },
    error: { label: "Error", color: "var(--error)", bg: "var(--error-bg)" },
    neutral: { label: "Neutral", color: "var(--text-muted)", bg: "#f5f5f5" },
  };

  const { label, color, bg } = variants[status] || variants.neutral;

  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 500,
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: "0 0 10px",
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#0a0a0a",
              margin: 0,
            }}
          >
            {value}
          </p>
          {description && (
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: "var(--text-light)",
                letterSpacing: "0.04em",
                margin: "8px 0 0",
              }}
            >
              {description}
            </p>
          )}
        </div>
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 6,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            background: bg,
            color,
            flexShrink: 0,
          }}
        >
          {label}
        </span>
      </div>
    </Card>
  );
};
