import { useQuery } from "@tanstack/react-query";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  Building2,
  CheckSquare,
  FileText,
  Home,
  Menu,
  Shield,
} from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

export default function MobileNav() {
  const matchRoute = useMatchRoute();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);

  // 獲取當前用戶角色（只在登入時查詢）
  const { data: userProfile } = useQuery({
    queryKey: ["user", "profile"],
    queryFn: () => client.team.getCurrentUserProfile(),
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // 5 分鐘快取
  });

  const userRole = userProfile?.role;
  const canAccessTeamManagement =
    userRole === "admin" || userRole === "manager";

  const baseLinks = [
    { to: "/", label: "首頁", icon: Home },
    { to: "/opportunities", label: "機會", icon: Building2 },
    { to: "/reports", label: "報告", icon: FileText },
    { to: "/todos", label: "待辦", icon: CheckSquare },
  ] as const;

  // 只有 admin 和 manager 可看到團隊管理
  const links = canAccessTeamManagement
    ? ([
        ...baseLinks,
        { to: "/admin/team", label: "團隊管理", icon: Shield },
      ] as const)
    : baseLinks;

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger className="rounded-md p-2 transition-colors hover:bg-accent md:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">開啟選單</span>
      </SheetTrigger>
      <SheetContent
        className="w-full bg-gradient-to-b from-slate-900 to-slate-800 sm:w-80"
        side="left"
      >
        <SheetHeader>
          <SheetTitle className="text-slate-100">導航選單</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-2">
          {links.map(({ to, label, icon: Icon }) => {
            const isActive = matchRoute({ to, fuzzy: to !== "/" });
            return (
              <SheetClose asChild key={to}>
                <Link
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 ${
                    isActive
                      ? "bg-[var(--ds-accent)] text-white shadow-lg"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                  onClick={() => setOpen(false)}
                  to={to}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
