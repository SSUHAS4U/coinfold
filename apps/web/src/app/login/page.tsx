"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { AuthError, AuthField, AuthShell, authInputClass } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { ApiError, api, tokens } from "@/lib/api";

/**
 * Sign in.
 *
 * The demo credentials are printed on the form on purpose: a reviewer opening
 * this cold should be inside the app in one click, not hunting through a README.
 */

const DEMO_EMAIL = "demo@coinfold.app";
const DEMO_PASSWORD = "coinfold-demo-2026";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const result = await api.login(email.trim(), password);
        tokens.set(result.tokens.access_token, result.tokens.refresh_token);
        router.replace("/app");
      } catch (cause) {
        setError(cause instanceof ApiError ? cause : null);
        setBusy(false);
      }
    },
    [email, password, router],
  );

  return (
    <AuthShell
      image="/img/auth-signin.jpg"
      imagePosition="55% 50%"
      eyebrow="Welcome back"
      headline={<>Pay the bill. Keep the change.</>}
      blurb="Ten thousand transactions, fourteen months, and every coin traceable to the payment that earned it."
      stats={[
        ["10,000", "transactions"],
        ["3,62,629", "coins earned"],
        ["14", "months"],
      ]}
    >
      <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-text">
        Sign in
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-text-dim">
        See your statement and spend your coins.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <AuthField label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="Password">
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className={authInputClass}
          />
        </AuthField>

        {error && <AuthError what={error.fault.what} action={error.fault.action} />}

        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>

      <Link
        href="/signup"
        className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-text-dim underline-offset-4 transition-colors hover:text-text hover:underline"
      >
        Create an account instead
        <ArrowRight size={13} aria-hidden />
      </Link>

      <div className="mt-8 border-t border-border pt-5">
        <p className="text-[12px] tracking-[0.02em] text-text-faint">Reviewer demo account</p>
        <p className="mt-1.5 font-mono text-[12px] text-text-dim">
          {DEMO_EMAIL} · {DEMO_PASSWORD}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-faint">
          Already filled in above. It holds the full 10,000-row statement.
        </p>
      </div>
    </AuthShell>
  );
}
