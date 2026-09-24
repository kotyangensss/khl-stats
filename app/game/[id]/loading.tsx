import { colors } from "@/lib/theme";

export default function Loading() {
  return (
    <main style={{ minHeight: "100vh", background: colors.bg, padding: "clamp(1.25rem, 5vw, 3rem)" }}>
      <div style={{ height: "1rem", width: "7rem", background: colors.border, borderRadius: "4px" }} />
      <div style={{ maxWidth: "42rem", margin: "3rem auto", display: "grid", justifyItems: "center", gap: "1.5rem" }}>
        <div style={{ height: "1rem", width: "14rem", background: colors.border, borderRadius: "4px" }} />
        <div style={{ width: "8rem", aspectRatio: "1", borderRadius: "50%", background: colors.border }} />
        <div style={{ height: "4rem", width: "14rem", background: colors.border, borderRadius: "6px" }} />
      </div>
    </main>
  );
}
