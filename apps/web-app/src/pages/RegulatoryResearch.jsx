import { useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { regulatoryAPI } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { BtnSecondary, MonoLabel } from "../components/ui";

const styles = {
  panel: {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 24,
    background: "#fff",
  },
  input: {
    flex: 1,
    minWidth: 220,
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "12px 14px",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    color: "#0a0a0a",
    outline: "none",
  },
  answer: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.7,
    color: "#333",
    fontSize: 15,
    margin: 0,
  },
};

export default function RegulatoryResearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runQuery = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    try {
      const response = await regulatoryAPI.query(query);
      setResult(response.data);
    } catch (requestError) {
      setError(requestError.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Regulatory research"
        title="Regulatory Research"
        subtitle="Ask questions against the sourced CPCB and SEBI compliance library."
      />

      <div style={{ display: "grid", gap: 20, maxWidth: 980 }}>
        <section style={styles.panel}>
          <MonoLabel>Ask a question</MonoLabel>
          <form
            onSubmit={runQuery}
            style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What are the EPR requirements for plastic packaging?"
              style={styles.input}
              aria-label="Regulatory question"
            />
            <BtnSecondary type="submit" disabled={loading || !query.trim()}>
              <Search size={15} />
              {loading ? "Searching..." : "Search"}
            </BtnSecondary>
          </form>
          {error && (
            <p style={{ color: "#b42318", fontSize: 13, margin: "14px 0 0" }}>
              {error}
            </p>
          )}
        </section>

        {result && (
          <>
            <section style={styles.panel}>
              <MonoLabel>Answer</MonoLabel>
              <p style={{ ...styles.answer, marginTop: 14 }}>{result.answer}</p>
            </section>

            <section style={styles.panel}>
              <MonoLabel>Sources</MonoLabel>
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                {(result.sources || []).map((source, index) => (
                  <a
                    key={source.url + "-" + index}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      padding: "14px 16px",
                      border: "1px solid var(--border-light)",
                      borderRadius: 8,
                      color: "#0a0a0a",
                      textDecoration: "none",
                    }}
                  >
                    <span>
                      <strong style={{ display: "block", fontSize: 14 }}>
                        {source.name}
                      </strong>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {source.category} - relevance {source.score}
                      </span>
                    </span>
                    <ExternalLink size={16} />
                  </a>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
