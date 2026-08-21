import { useState } from "react";

export function BtnPrimary({
  children,
  onClick,
  disabled,
  type = "button",
  style = {},
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 20px",
        borderRadius: 10,
        border: "none",
        background: hov ? "#1a1a1a" : "#0a0a0a",
        color: "#fff",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s, transform 0.1s",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function BtnSecondary({
  children,
  onClick,
  disabled,
  type = "button",
  style = {},
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 20px",
        borderRadius: 10,
        border: `1px solid ${hov ? "#0a0a0a" : "var(--border)"}`,
        background: hov ? "#fafafa" : "#fff",
        color: "#0a0a0a",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "border-color 0.15s, background 0.15s",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function BtnGhost({ children, onClick, style = {} }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 12px",
        borderRadius: 8,
        border: "none",
        background: hov ? "#f5f5f5" : "transparent",
        color: hov ? "#0a0a0a" : "var(--text-light)",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Badge({ children, variant = "neutral" }) {
  const variants = {
    ok: { bg: "var(--success-bg)", color: "var(--success)" },
    success: { bg: "var(--success-bg)", color: "var(--success)" },
    warn: { bg: "#f5f5f5", color: "#0a0a0a" },
    neutral: { bg: "#f5f5f5", color: "var(--text-muted)" },
    dark: { bg: "#0a0a0a", color: "#fff" },
  };
  const s = variants[variant] ?? variants.neutral;
  return (
    <span
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 6,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function ProgressBar({ pct, ok = true, height = 4 }) {
  return (
    <div
      style={{
        height,
        borderRadius: 99,
        background: "var(--border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: 99,
          background: ok ? "var(--success)" : "#0a0a0a",
          width: `${Math.min(100, Math.max(0, pct))}%`,
          transition: "width 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </div>
  );
}

export function MonoLabel({ children, color = "var(--text-muted)" }) {
  return (
    <span
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        fontWeight: 500,
        color,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

export function Toast({ message, visible, icon }) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#0a0a0a",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: 12,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        animation: "toastIn 0.2s ease",
      }}
    >
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }`}</style>
      {icon}
      {message}
    </div>
  );
}
