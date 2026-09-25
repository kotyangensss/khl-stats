"use client";

import { useState } from "react";
import Image from "next/image";
import type { Team } from "@/lib/types";
import { logoSrc } from "@/lib/format";
import { colors } from "@/lib/theme";
import { teamColors } from "@/lib/team-colors";

export function TeamLogo({ team, size = 44 }: { team: Team; size?: number }) {
  const [broken, setBroken] = useState(false);
  const src = logoSrc(team.logoUrl);
  const accent = teamColors[team.id];

  if (!src || broken) {
    return (
      <span
        title={team.name}
        className="khl-logo"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: accent ? `${accent}33` : colors.border,
          color: accent ?? colors.muted,
          border: accent ? `1.5px solid ${accent}88` : "none",
          fontFamily: "var(--font-display)",
          fontSize: size * 0.32,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {team.name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className="khl-logo"
      style={{
        display: "inline-flex",
        borderRadius: "50%",
        padding: accent ? 2 : 0,
        background: accent ? `linear-gradient(135deg, ${accent}, ${accent}00 70%)` : "none",
        flexShrink: 0,
      }}
    >
      <Image
        src={src}
        alt={team.name}
        width={size}
        height={size}
        unoptimized
        style={{ width: size, height: size, objectFit: "contain", borderRadius: "50%", background: colors.bg }}
        onError={() => setBroken(true)}
      />
    </span>
  );
}
