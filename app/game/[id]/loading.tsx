import type { CSSProperties } from "react";
import { colors } from "@/lib/theme";

const bar = (width: string, height: string, extra?: CSSProperties): CSSProperties => ({
  width,
  height,
  borderRadius: "6px",
  background: colors.borderSoft,
  animation: "khl-skeleton-pulse 1.2s ease-in-out infinite",
  ...extra,
});

function TeamSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      <div style={bar("120px", "120px", { borderRadius: "50%" })} />
      <div style={bar("9rem", "1.4rem")} />
    </div>
  );
}

function RecentRowSkeleton() {
  return (
    <div style={{ padding: "0.9rem 0", borderBottom: `1px solid ${colors.borderSoft}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.7rem" }}>
          <div style={bar("6rem", "1rem")} />
          <div style={bar("56px", "56px", { borderRadius: "50%", flexShrink: 0 })} />
        </div>
        <div style={bar("3rem", "1.4rem")} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
          <div style={bar("56px", "56px", { borderRadius: "50%", flexShrink: 0 })} />
          <div style={bar("6rem", "1rem")} />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: "clamp(1.25rem, 5vw, 3rem)" }}>
      <style>{`
        @keyframes khl-skeleton-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.85; }
        }
      `}</style>

      <span style={{ color: colors.muted, fontFamily: "var(--font-display)", fontSize: "0.9rem" }}>
        ← Расписание
      </span>

      <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={bar("16rem", "0.9rem")} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "clamp(1.5rem, 6vw, 4rem)",
            flexWrap: "wrap",
            marginTop: "2.5rem",
          }}
        >
          <TeamSkeleton />
          <div style={{ display: "flex", justifyContent: "center", minWidth: "8rem" }}>
            <div style={bar("6rem", "3rem")} />
          </div>
          <TeamSkeleton />
        </div>
      </div>

      <section style={{ maxWidth: "1120px", margin: "2.5rem auto 0" }}>
        <div style={{ borderTop: `1px solid ${colors.border}` }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.75rem 0.5rem",
                borderTop: i > 0 ? `1px solid ${colors.borderSoft}` : undefined,
              }}
            >
              <div style={bar("1.5rem", "1rem")} />
              <div style={bar("26px", "26px", { borderRadius: "50%", flexShrink: 0 })} />
              <div style={bar("8rem", "1rem")} />
              <div style={{ flex: 1 }} />
              <div style={bar("60%", "1rem", { maxWidth: "36rem" })} />
            </div>
          ))}
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "clamp(1.5rem, 5vw, 3rem)",
          marginTop: "3.5rem",
        }}
      >
        {[0, 1].map((col) => (
          <div key={col}>
            <div style={bar("11rem", "0.85rem", { marginBottom: "0.75rem" })} />
            <RecentRowSkeleton />
            <RecentRowSkeleton />
            <RecentRowSkeleton />
          </div>
        ))}
      </div>
    </main>
  );
}