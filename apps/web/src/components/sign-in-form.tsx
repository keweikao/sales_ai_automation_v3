import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

// Import Playfair Display and JetBrains Mono
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";

export default function SignInForm() {
  const _navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social(
      {
        provider: "google",
        callbackURL: "/dashboard",
      },
      {
        onError: (error) => {
          toast.error(error.error.message || error.error.statusText);
        },
      }
    );
  };

  if (isPending) {
    return <Loader />;
  }

  return (
    <>
      <style>
        {`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 200%; }
          }

          @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes pulse-glow {
            0%, 100% {
              box-shadow: 0 0 20px rgba(99, 94, 246, 0.3), 0 0 40px rgba(99, 94, 246, 0.1);
            }
            50% {
              box-shadow: 0 0 30px rgba(99, 94, 246, 0.5), 0 0 60px rgba(99, 94, 246, 0.2);
            }
          }

          @keyframes scanline {
            0% {
              transform: translateY(-100%);
            }
            100% {
              transform: translateY(100%);
            }
          }

          .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            background: linear-gradient(135deg, rgb(2 6 23) 0%, rgb(15 23 42) 50%, rgb(30 41 59) 100%);
            position: relative;
            overflow: hidden;
          }

          .login-container::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image:
              linear-gradient(to right, rgb(71 85 105 / 0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(71 85 105 / 0.15) 1px, transparent 1px);
            background-size: 60px 60px;
            pointer-events: none;
            animation: fadeInUp 1s ease-out backwards;
          }

          .login-container::after {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(99, 94, 246, 0.03) 0%, transparent 70%);
            animation: rotate 30s linear infinite;
            pointer-events: none;
          }

          .login-card {
            position: relative;
            z-index: 10;
            width: 100%;
            max-width: 480px;
            padding: 3rem;
            border-radius: 1rem;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
            backdrop-filter: blur(20px);
            border: 1px solid rgb(51 65 85);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            animation: fadeInUp 0.8s ease-out backwards;
            animation-delay: 0.2s;
          }

          .login-card::before {
            content: '';
            position: absolute;
            inset: -1px;
            border-radius: 1rem;
            padding: 1px;
            background: linear-gradient(135deg, rgb(99 94 246), rgb(139 92 246), rgb(99 94 246));
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            opacity: 0.5;
            pointer-events: none;
          }

          .login-card::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, rgb(99 94 246), transparent);
            animation: shimmer 3s infinite;
            pointer-events: none;
          }

          .login-title {
            font-family: 'Playfair Display', serif;
            font-size: 2.5rem;
            font-weight: 700;
            text-align: center;
            margin-bottom: 0.75rem;
            background: linear-gradient(135deg, rgb(226 232 240) 0%, rgb(148 163 184) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.02em;
            line-height: 1.2;
            animation: fadeInUp 0.8s ease-out backwards;
            animation-delay: 0.4s;
          }

          .login-subtitle {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            font-weight: 400;
            text-align: center;
            color: rgb(148 163 184);
            margin-bottom: 2.5rem;
            line-height: 1.6;
            animation: fadeInUp 0.8s ease-out backwards;
            animation-delay: 0.5s;
          }

          .security-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            margin-bottom: 2rem;
            padding: 0.75rem 1.25rem;
            border-radius: 0.5rem;
            background: rgba(99, 94, 246, 0.1);
            border: 1px solid rgba(99, 94, 246, 0.3);
            animation: fadeInUp 0.8s ease-out backwards, pulse-glow 3s ease-in-out infinite;
            animation-delay: 0.6s;
          }

          .security-badge-icon {
            width: 1rem;
            height: 1rem;
            color: rgb(99 94 246);
          }

          .security-badge-text {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: rgb(99 94 246);
          }

          .google-signin-button {
            position: relative;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9375rem;
            font-weight: 600;
            color: rgb(2 6 23);
            background: linear-gradient(135deg, rgb(99 94 246) 0%, rgb(139 92 246) 100%);
            border: none;
            cursor: pointer;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            animation: fadeInUp 0.8s ease-out backwards;
            animation-delay: 0.7s;
          }

          .google-signin-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transition: left 0.5s;
          }

          .google-signin-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 0 40px rgba(99, 94, 246, 0.6), 0 10px 30px rgba(0, 0, 0, 0.3);
          }

          .google-signin-button:hover::before {
            left: 100%;
          }

          .google-signin-button:active {
            transform: translateY(0);
          }

          .google-icon {
            width: 1.5rem;
            height: 1.5rem;
            position: relative;
            z-index: 1;
          }

          .login-footer {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid rgb(51 65 85);
            text-align: center;
            animation: fadeInUp 0.8s ease-out backwards;
            animation-delay: 0.8s;
          }

          .login-footer-text {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            color: rgb(148 163 184);
            line-height: 1.6;
          }

          .login-footer-highlight {
            color: rgb(99 94 246);
            font-weight: 600;
          }

          .decorative-lines {
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 200px;
            transform: translateY(-50%);
            overflow: hidden;
            pointer-events: none;
            opacity: 0.1;
          }

          .decorative-line {
            position: absolute;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgb(99 94 246), transparent);
          }

          .decorative-line:nth-child(1) { top: 20%; animation: scanline 8s linear infinite; }
          .decorative-line:nth-child(2) { top: 40%; animation: scanline 10s linear infinite; animation-delay: 2s; }
          .decorative-line:nth-child(3) { top: 60%; animation: scanline 12s linear infinite; animation-delay: 4s; }
          .decorative-line:nth-child(4) { top: 80%; animation: scanline 9s linear infinite; animation-delay: 6s; }
        `}
      </style>

      <div className="login-container">
        <div className="decorative-lines">
          <div className="decorative-line" />
          <div className="decorative-line" />
          <div className="decorative-line" />
          <div className="decorative-line" />
        </div>

        <div className="login-card">
          <h1 className="login-title">Sales Intelligence</h1>
          <p className="login-subtitle">
            使用您的 Google 帳號登入 Sales AI Automation
          </p>

          <div className="security-badge">
            <svg
              className="security-badge-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 12l2 2 4-4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="security-badge-text">Secure Authentication</span>
          </div>

          <button
            className="google-signin-button"
            onClick={handleGoogleSignIn}
            type="button"
          >
            <svg className="google-icon" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            使用 Google 登入
          </button>

          <div className="login-footer">
            <p className="login-footer-text">
              僅限 <span className="login-footer-highlight">@ichef.com.tw</span>{" "}
              組織帳號使用
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
