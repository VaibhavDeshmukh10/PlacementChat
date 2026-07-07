// Single source of truth for the PlacementDesk palette. Every page imports
// this so colors stay 1:1 across the app.
export const C = {
  white: "#FFFFFF",
  black: "#111412",
  greyLine: "#E4E7E3",
  greyText: "#5B615B",
  greyFaint: "#8B928C",
  green900: "#0E3B26",
  green700: "#1C6B47",
  green500: "#2E9E63",
  green100: "#E6F3EA",
  green050: "#F3F9F5",
  red700: "#B3392C",
  red100: "#FBEAE8",
  placeholder: "#8B928C",
};

// Deterministic initials from a name, e.g. "Ananya Rao" -> "AR"
export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// "3 minutes ago" style relative time from an ISO date string
export function timeAgo(input) {
  if (!input) return "";
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(input).toLocaleDateString();
}

// Short clock time for chat bubbles
export function clockTime(input) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
