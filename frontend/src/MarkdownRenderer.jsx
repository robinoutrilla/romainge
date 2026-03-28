// ═══════════════════════════════════════════════════════════════
// MarkdownRenderer.jsx — Renders agent markdown responses
// ═══════════════════════════════════════════════════════════════

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownRenderer({ text, theme }) {
  const th = theme || {};
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p style={{ margin: "0 0 8px", lineHeight: 1.6 }}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong style={{ color: th.accent || "#00cec9", fontWeight: 600 }}>{children}</strong>
        ),
        ul: ({ children }) => (
          <ul style={{ paddingLeft: 18, margin: "4px 0 8px" }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ paddingLeft: 18, margin: "4px 0 8px" }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ marginBottom: 3, lineHeight: 1.5 }}>{children}</li>
        ),
        code: ({ inline, children }) =>
          inline ? (
            <code style={{
              background: th.bgTertiary || "rgba(255,255,255,0.08)",
              padding: "1px 5px", borderRadius: 4, fontSize: "0.9em",
              fontFamily: "'DM Mono', monospace",
            }}>{children}</code>
          ) : (
            <pre style={{
              background: th.bgTertiary || "rgba(255,255,255,0.05)",
              borderRadius: 8, padding: 12, overflowX: "auto",
              fontSize: "0.85em", margin: "8px 0",
            }}>
              <code>{children}</code>
            </pre>
          ),
        table: ({ children }) => (
          <div style={{ overflowX: "auto", margin: "8px 0" }}>
            <table style={{
              borderCollapse: "collapse", width: "100%", fontSize: "0.88em",
            }}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th style={{
            textAlign: "left", padding: "6px 10px",
            borderBottom: `2px solid ${th.border || "rgba(255,255,255,0.1)"}`,
            color: th.accent || "#00cec9", fontWeight: 600, whiteSpace: "nowrap",
          }}>{children}</th>
        ),
        td: ({ children }) => (
          <td style={{
            padding: "5px 10px",
            borderBottom: `1px solid ${th.border || "rgba(255,255,255,0.04)"}`,
          }}>{children}</td>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{
            color: th.accent || "#00cec9", textDecoration: "underline",
          }}>{children}</a>
        ),
        blockquote: ({ children }) => (
          <blockquote style={{
            borderLeft: `3px solid ${th.accent || "#00cec9"}`,
            paddingLeft: 12, margin: "8px 0",
            color: th.textSecondary || "rgba(232,230,227,0.6)",
          }}>{children}</blockquote>
        ),
        h1: ({ children }) => <h4 style={{ margin: "12px 0 6px", fontSize: "1.1em" }}>{children}</h4>,
        h2: ({ children }) => <h5 style={{ margin: "10px 0 4px", fontSize: "1.05em" }}>{children}</h5>,
        h3: ({ children }) => <h6 style={{ margin: "8px 0 4px", fontSize: "1em" }}>{children}</h6>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
