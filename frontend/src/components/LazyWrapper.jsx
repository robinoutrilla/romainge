import React from "react";

function DefaultLoader({ th }) {
  const color = th?.accent || "#6366f1";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 0",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              opacity: 0.4,
              animation: `lazyDot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes lazyDot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default function LazyWrapper({ children, fallback, th }) {
  return (
    <React.Suspense fallback={fallback || <DefaultLoader th={th} />}>
      {children}
    </React.Suspense>
  );
}
