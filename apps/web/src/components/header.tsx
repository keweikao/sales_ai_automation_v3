import { Link, useMatchRoute } from "@tanstack/react-router";
import { BarChart3, Building2, FileText, Home, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const matchRoute = useMatchRoute();

  const links = [
    { to: "/", label: "首頁", icon: Home },
    { to: "/opportunities", label: "商機", icon: Building2 },
    { to: "/conversations", label: "對話", icon: MessageSquare },
    { to: "/reports", label: "報告", icon: FileText },
  ] as const;

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link className="flex items-center gap-2" to="/">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Sales AI</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(({ to, label, icon: Icon }) => {
              const isActive = matchRoute({ to, fuzzy: to !== "/" });
              return (
                <Link
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  key={to}
                  to={to}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
