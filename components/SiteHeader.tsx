import Link from "next/link";
import { CompanionControls } from "./companion/Companion";

export function SiteHeader({ active = "schedule" }: { active?: "schedule" | "standings" | null }) {
  return <header className="flow-appbar"><div>
    <Link href="/" className="flow-brand" aria-label="На льду — главная">На льду<span /></Link>
    <nav className="flow-site-nav" aria-label="Главная навигация">
      <Link className={active === "schedule" ? "is-current" : ""} href="/#schedule" aria-current={active === "schedule" ? "page" : undefined}>Расписание</Link>
      <Link className={active === "standings" ? "is-current" : ""} href="/standings" aria-current={active === "standings" ? "page" : undefined}>Таблица</Link>
    </nav>
    <CompanionControls />
  </div></header>;
}
