"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { ApiError, api, tokens } from "@/lib/api";

/**
 * Sign in / create account.
 *
 * The demo credentials are printed on the form on purpose: a reviewer opening
 * this cold should be inside the app in one click, not hunting through a README.
 */

const DEMO_EMAIL = "demo@coinfold.app";
const DEMO_PASSWORD = "coinfold-demo-2026";

const inputClass =
  "h-11 min-h-11 w-full rounded-[var(--r-control)] border border-border bg-surface-1 px-3 " +
  "text-[14px] text-text placeholder:text-text-faint transition-colors " +
  "duration-[var(--t-interaction)] hover:border-border-strong focus:border-accent focus:outline-none";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);

      try {
        const result =
          mode === "signin"
            ? await api.login(email.trim(), password)
            : await api.register(email.trim(), displayName.trim(), password);

        tokens.set(result.tokens.access_token, result.tokens.refresh_token);
        router.replace("/app");
      } catch (cause) {
        setError(cause instanceof ApiError ? cause : null);
        setBusy(false);
      }
    },
    [mode, email, password, displayName, router],
  );

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <a href="/" className="text-[15px] font-semibold tracking-[-0.01em] text-text">
          coinfold
        </a>

        <h1 className="mt-6 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-text">
          {mode === "signin" ? "Welcome back." : "Create your account."}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-text-dim">
          {mode === "signin"
            ? "Sign in to see your statement and spend your coins."
            : "You start with the full sample statement and its coin balance."}
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
          {mode === "register" && (
            <label className="block">
              <span className="mb-1.5 block text-[12px] tracking-[0.02em] text-text-faint">
                Your name
              </span>
              <input
                type="text"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                className={inputClass}
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[12px] tracking-[0.02em] text-text-faint">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] tracking-[0.02em] text-text-faint">
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className={inputClass}
            />
            {mode === "register" && (
              <span className="mt-1.5 block text-[12px] text-text-faint">
                At least 10 characters. Length beats punctuation.
              </span>
            )}
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-[var(--r-control)] border px-3 py-2.5"
              style={{
                borderColor: "color-mix(in oklab, var(--danger) 35%, transparent)",
                background: "color-mix(in oklab, var(--danger) 8%, transparent)",
              }}
            >
              <p className="text-[13px] font-medium" style={{ color: "var(--danger)" }}>
                {error.fault.what}
              </p>
              <p className="mt-1 text-[12px] text-text-dim">{error.fault.action}</p>
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "register" : "signin");
            setError(null);
          }}
          className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-text-dim underline-offset-4 transition-colors hover:text-text hover:underline"
        >
          {mode === "signin" ? "Create an account instead" : "I already have an account"}
          <ArrowRight size={13} aria-hidden />
        </button>

        {mode === "signin" && (
          <div className="mt-8 border-t border-border pt-5">
            <p className="text-[12px] tracking-[0.02em] text-text-faint">Reviewer demo account</p>
            <p className="mt-1.5 font-mono text-[12px] text-text-dim">
              {DEMO_EMAIL} · {DEMO_PASSWORD}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-text-faint">
              Already filled in above. It holds the full 10,000-row statement.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
