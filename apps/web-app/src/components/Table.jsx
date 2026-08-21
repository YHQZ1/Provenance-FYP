export const Table = ({ headers, rows }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr
          style={{
            borderBottom: "1px solid var(--border-light)",
            background: "#fafafa",
          }}
        >
          {headers.map((h, i) => (
            <th
              key={i}
              style={{
                padding: "12px 16px",
                textAlign: "left",
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--text-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr
            key={ri}
            style={{
              borderBottom: "1px solid var(--border-light)",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {row.map((cell, ci) => (
              <td key={ci} style={{ padding: "14px 16px", color: "#0a0a0a" }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
