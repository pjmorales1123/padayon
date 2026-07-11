// Route helpers that preserve the selected learner persona across app pages.
export const APP_DESTINATIONS = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Live Demo" },
  { href: "/chat", label: "Chat" },
  { href: "/library", label: "Library" },
  { href: "/profile", label: "Profile" },
] as const;

export function buildAppHref(path: string, userId?: string): string {
  if (!userId) return path;
  const params = new URLSearchParams({ userId });
  return `${path}?${params.toString()}`;
}
