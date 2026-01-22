import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  FileText,
  Home,
  MessageSquare,
  Shield,
} from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

// Import Playfair Display and JetBrains Mono
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/800.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";

export default function Header() {
  const matchRoute = useMatchRoute();

  const links = [
    { to: "/", label: "首頁", icon: Home },
    { to: "/opportunities", label: "商機", icon: Building2 },
    { to: "/conversations", label: "對話", icon: MessageSquare },
    { to: "/reports", label: "報告", icon: FileText },
    { to: "/admin/team", label: "團隊管理", icon: Shield },
  ] as const;

  return (
    <>
      <style>
        {`
          @keyframes pulse-icon {
            0%, 100% {
              filter: drop-shadow(0 0 4px rgba(99, 94, 246, 0.5));
            }
            50% {
              filter: drop-shadow(0 0 8px rgba(99, 94, 246, 0.8));
            }
          }

          @keyframes slide-in {
            from {
              transform: scaleX(0);
            }
            to {
              transform: scaleX(1);
            }
          }

          .header-container {
            position: relative;
            background: linear-gradient(135deg, rgb(15 23 42) 0%, rgb(30 41 59) 100%);
            border-bottom: 1px solid rgb(51 65 85);
          }

          .header-container::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, rgb(99 94 246), rgb(139 92 246), rgb(99 94 246), transparent);
            opacity: 0.6;
          }

          .header-content {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 4rem;
            padding: 0 1.5rem;
          }

          .header-left {
            display: flex;
            align-items: center;
            gap: 2rem;
          }

          .header-logo {
            display: flex;
            align-items: center;
            gap: 0.625rem;
            text-decoration: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .header-logo:hover .header-logo-icon {
            animation: pulse-icon 2s ease-in-out infinite;
          }

          .header-logo-icon {
            width: 1.75rem;
            height: 1.75rem;
            color: rgb(99 94 246);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .header-logo-text {
            font-family: 'Playfair Display', serif;
            font-size: 1.375rem;
            font-weight: 700;
            background: linear-gradient(135deg, rgb(226 232 240) 0%, rgb(148 163 184) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.01em;
          }

          .header-nav {
            display: none;
            align-items: center;
            gap: 0.5rem;
          }

          @media (min-width: 768px) {
            .header-nav {
              display: flex;
            }
          }

          .header-nav-link {
            position: relative;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 1rem;
            border-radius: 0.5rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            font-weight: 500;
            color: rgb(148 163 184);
            text-decoration: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
          }

          .header-nav-link::before {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            width: 0;
            height: 2px;
            background: linear-gradient(90deg, rgb(99 94 246), rgb(139 92 246));
            transform: translateX(-50%);
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .header-nav-link:hover {
            color: rgb(226 232 240);
            background: rgba(30, 41, 59, 0.5);
          }

          .header-nav-link:hover::before {
            width: 80%;
          }

          .header-nav-link-icon {
            width: 1rem;
            height: 1rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .header-nav-link:hover .header-nav-link-icon {
            color: rgb(99 94 246);
            transform: translateY(-2px);
          }

          .header-nav-link-active {
            color: rgb(2 6 23);
            background: linear-gradient(135deg, rgb(99 94 246) 0%, rgb(139 92 246) 100%);
            font-weight: 600;
            box-shadow: 0 0 20px rgba(99, 94, 246, 0.3);
          }

          .header-nav-link-active::before {
            display: none;
          }

          .header-nav-link-active .header-nav-link-icon {
            color: rgb(2 6 23);
          }

          .header-nav-link-active:hover {
            background: linear-gradient(135deg, rgb(124 58 237) 0%, rgb(109 40 217) 100%);
            box-shadow: 0 0 30px rgba(99, 94, 246, 0.5);
          }

          .header-right {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
        `}
      </style>

      <header className="header-container">
        <div className="header-content">
          <div className="header-left">
            <Link className="header-logo" to="/">
              <BarChart3 className="header-logo-icon" />
              <span className="header-logo-text">Sales Intelligence</span>
            </Link>
            <nav className="header-nav">
              {links.map(({ to, label, icon: Icon }) => {
                const isActive = matchRoute({ to, fuzzy: to !== "/" });
                return (
                  <Link
                    className={
                      isActive
                        ? "header-nav-link header-nav-link-active"
                        : "header-nav-link"
                    }
                    key={to}
                    to={to}
                  >
                    <Icon className="header-nav-link-icon" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="header-right">
            <ModeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
    </>
  );
}
