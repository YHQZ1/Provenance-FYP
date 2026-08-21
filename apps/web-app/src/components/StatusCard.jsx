import { Card } from "./Card.jsx";

const STATUS_CONFIG = {
  success: { label: "Complete", color: "#059669", bg: "#ecfdf5" },
  warning: { label: "Pending", color: "#d97706", bg: "#fffbeb" },
  error: { label: "Error", color: "#dc2626", bg: "#fef2f2" },
  neutral: { label: "Neutral", color: "#737373", bg: "#f5f5f5" },
};

export const StatusCard = ({
  title,
  value,
  status = "neutral",
  description,
}) => {
  const { label, color, bg } = STATUS_CONFIG[status] ?? STATUS_CONFIG.neutral;

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
              color: "#737373",
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
                color: "#a3a3a3",
                letterSpacing: "0.04em",
                marginTop: 8,
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
            borderRadius: 4,
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

export default StatusCard;
