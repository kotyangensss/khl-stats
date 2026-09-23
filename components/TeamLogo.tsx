"use client";

import { useState } from "react";
import type { Team } from "@/lib/types";
import { logoSrc } from "@/lib/format";
import { colors } from "@/lib/theme";

export function TeamLogo({ team, size = 44 }: { team: Team; size?: number }) {
  const [broken, setBroken] = useState(false);
  const src = logoSrc(team.logoUrl);

  if (!src || broken) {
    return (
      <span
        title={team.name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: colors.border,
          color: colors.muted,
          fontFamily: "var(--font-display)",
          fontSize: size * 0.32,
          fontWeight: 600,
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={team.name}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
      onError={() => setBroken(true)}
    />
  );
}
