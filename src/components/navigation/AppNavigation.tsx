"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Presentation,
  MessageCircle,
  Library,
  UserRound,
} from "lucide-react";
import { APP_DESTINATIONS, buildAppHref } from "@/lib/navigation";

interface AppNavigationProps {
  userId?: string;
  busy?: boolean;
  className?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home: House,
  "Live Demo": Presentation,
  Chat: MessageCircle,
  Library,
  Profile: UserRound,
};

export default function AppNavigation({
  userId,
  busy = false,
  className = "",
}: AppNavigationProps) {
  const pathname = usePathname();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (busy && !window.confirm("PADAYON is still working. Leave this page?")) {
      e.preventDefault();
    }
  };

  return (
    <nav aria-label="Primary navigation" className={className}>
      <ul className="flex items-center gap-1 sm:gap-2">
        {APP_DESTINATIONS.map(({ href, label }) => {
          const Icon = iconMap[label];
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={buildAppHref(href, userId)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                onClick={handleClick}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-blue-100 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="hidden sm:inline">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
