import { colors } from "@/lib/theme";

export default function Loading() {
  return (
    <main style={{ minHeight: "100vh", background: colors.bg, paddingBottom: "4rem" }}>
      <div style={{ padding: "clamp(1.25rem, 5vw, 3rem)" }}>
        <div style={{ height: "1rem", width: "7rem", background: colors.border, borderRadius: "4px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginTop: "2rem" }}>
          <div style={{ width: "5rem", height: "5rem", borderRadius: "50%", background: colors.border }} />
          <div style={{ height: "2.5rem", width: "14rem", background: colors.border, borderRadius: "6px" }} />
        </div>
      </div>
      <section style={{ padding: "0 clamp(1.25rem, 5vw, 3rem)" }}>
        <div style={{ height: "1rem", width: "11rem", background: colors.border, borderRadius: "4px" }} />
        <div style={{ height: "8rem", marginTop: "1rem", borderBottom: `1px solid ${colors.border}` }} />
        <div style={{ height: "8rem", borderBottom: `1px solid ${colors.border}` }} />
      </section>
    </main>
  );
}
