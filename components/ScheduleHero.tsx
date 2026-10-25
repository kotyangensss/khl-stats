"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Game } from "@/lib/types";
import { formatDayHeading } from "@/lib/format";
import { motionProgress, selectFeaturedGame } from "@/lib/schedule-presentation";
import { SiteHeader } from "./SiteHeader";
import { TeamLogo } from "./TeamLogo";
import { GameStatus } from "./GameStatus";

export function ScheduleHero({ date, games }: { date: string; games: Game[] }) {
  const intro = useRef<HTMLElement>(null);
  const rail = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const featured = selectFeaturedGame(games);

  useEffect(() => {
    const scene = intro.current;
    const strip = rail.current;
    const content = track.current;
    if (!scene) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 700px)");
    let frame = 0;
    let introTop = 0, introDistance = 0, railTop = 0, railDistance = 0;
    function paint() {
      frame = 0;
      if (reduced.matches || compact.matches) {
        scene!.style.setProperty("--intro-progress", "0");
        content?.style.removeProperty("transform");
        return;
      }
      scene!.style.setProperty("--intro-progress", String(motionProgress(window.scrollY, introTop, introDistance)));
      if (content) content.style.transform = `translate3d(${-motionProgress(window.scrollY, railTop, railDistance) * railDistance}px,0,0)`;
    }
    function queue() { if (!frame) frame = requestAnimationFrame(paint); }
    function measure() {
      introTop = scene!.getBoundingClientRect().top + window.scrollY;
      introDistance = scene!.offsetHeight - window.innerHeight;
      if (strip && content) {
        railDistance = Math.max(0, content.scrollWidth - strip.clientWidth);
        strip.style.setProperty("--rail-distance", `${railDistance}px`);
        railTop = strip.getBoundingClientRect().top + window.scrollY;
      }
      queue();
    }
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    if (content) observer.observe(content);
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", measure);
    reduced.addEventListener("change", measure);
    compact.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", measure);
      reduced.removeEventListener("change", measure);
      compact.removeEventListener("change", measure);
    };
  }, [games.length]);

  function revealMatch(index: number) {
    const strip = rail.current;
    const content = track.current;
    const panel = content?.children[index] as HTMLElement | undefined;
    if (!strip || !content || !panel) return;
    if (matchMedia("(prefers-reduced-motion: reduce), (max-width: 700px)").matches) return;
    const distance = Math.max(0, content.scrollWidth - strip.clientWidth);
    const target = strip.getBoundingClientRect().top + window.scrollY + Math.min(panel.offsetLeft, distance);
    window.scrollTo({ top: target, behavior: "instant" });
  }

  return <>
    <section ref={intro} className="hockey-intro" aria-label="День хоккея">
      <div className="intro-stage">
        <Image className="hero-photo" src="/images/hockey-hero-red.webp" fill priority sizes="100vw" alt="Хоккеист в чёрно-красной форме с ястребом на груди" />
        <SiteHeader />
        <h1 className="hero-title"><span>ДЕНЬ</span><span>ХОККЕЯ.</span></h1>
        <div className="hero-bottom">
          <div className="featured-match">
            <div className="featured-caption"><a href="#nearest">{formatDayHeading(date)} ↓</a><span>{featured?.status === "LIVE" ? "Сейчас на льду" : "Ближайший матч"}</span></div>
            {featured ? <>
              <div className="featured-body"><div className="featured-teams">
                {[featured.teamA, featured.teamB].map(team => <div key={team.id}><TeamLogo team={team} size={30} ring={false} /><span>{team.name}</span></div>)}
              </div><GameStatus game={featured} /></div>
              <div className="featured-actions"><Link className="solid-link" href={`/game/${featured.id}`}>Открыть матч ↗</Link><a href="#nearest">Все матчи дня ↓</a></div>
            </> : <p>Матчей на этот день нет. <a href="#schedule">Перейти к расписанию ↓</a></p>}
          </div>
          <a className="scroll-cue" href="#nearest"><span>↓</span> Листайте вниз — дальше матчи</a>
        </div>
      </div>
    </section>
    <section ref={rail} id="nearest" className={`nearest-scene ${games.length ? "" : "is-empty"}`} aria-labelledby="nearest-heading">
      <div className="nearest-stage">
        <div className="nearest-heading"><div><p className="eyebrow">{formatDayHeading(date)} · МСК</p><h2 id="nearest-heading">БЛИЖАЙШИЕ<br />НА ЛЬДУ.</h2></div><a href="#schedule">К календарю ↓</a></div>
        {games.length ? <div ref={track} className="match-track">
          {games.map((game, index) => <article key={game.id} className="match-panel" onFocusCapture={() => revealMatch(index)}>
            <div className="panel-top"><span>{String(index + 1).padStart(2, "0")} / {String(games.length).padStart(2, "0")}</span><GameStatus game={game} /></div>
            <Link href={`/game/${game.id}`} className="panel-match" aria-label={`${game.teamA.name} — ${game.teamB.name}, открыть матч`}>
              <span><TeamLogo team={game.teamA} size={76} ring={false} /><strong>{game.teamA.name}</strong></span>
              <span className="versus">×</span>
              <span><TeamLogo team={game.teamB} size={76} ring={false} /><strong>{game.teamB.name}</strong></span>
            </Link>
            <div className="panel-bottom"><span>{game.venue || game.arena?.city || "Регулярный чемпионат"}</span><Link href={`/game/${game.id}`}>Открыть матч ↗</Link></div>
          </article>)}
        </div> : <p className="nearest-empty">На этот день матчей не запланировано.</p>}
      </div>
    </section>
  </>;
}
