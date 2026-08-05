/** SQLite stores `datetime('now')` output, which is UTC without a zone marker. */
function parseSqliteDate(value: string): Date {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

export function relativeTime(value: string): string {
  const then = parseSqliteDate(value).getTime();
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  const units: [number, string][] = [
    [60, "m"],
    [3600, "h"],
    [86400, "d"],
    [2592000, "mo"],
    [31536000, "y"],
  ];
  if (seconds < 60) return "just now";
  for (let i = 1; i < units.length; i++) {
    if (seconds < units[i][0]) {
      return `${Math.floor(seconds / units[i - 1][0])}${units[i - 1][1]} ago`;
    }
  }
  return `${Math.floor(seconds / 31536000)}y ago`;
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** The Exit Index band, used for colour and for the plain-English caption. */
export function indexBand(index: number | null): {
  label: string;
  caption: string;
  color: string;
} {
  if (index === null) {
    return {
      label: "Not enough data",
      caption: "Fewer than three stories. We show them, but we will not score a company on them.",
      color: "text-muted",
    };
  }
  if (index >= 70)
    return {
      label: "Severe pattern",
      caption: "Most people here left over the environment, and would warn others away.",
      color: "text-alarm",
    };
  if (index >= 45)
    return {
      label: "Recurring problems",
      caption: "A clear pattern in the reasons people gave for leaving.",
      color: "text-ember",
    };
  if (index >= 25)
    return {
      label: "Mixed",
      caption: "Some environment complaints alongside ordinary career moves.",
      color: "text-paper",
    };
  return {
    label: "Mostly ordinary exits",
    caption: "People here mostly left for better offers rather than to escape.",
    color: "text-acid",
  };
}
