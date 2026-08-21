"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";

import { AuthError, AuthField, AuthShell, authInputClass } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { ApiError, api, tokens } from "@/lib/api";

/**
 * Create an account.
 *
 * A new account is given its own copy of the sample statement and its own coin
 * ledger, so it lands on a populated dashboard rather than an empty one. That
 * is stated on the form, because a signup that silently pre-fills your account
 * with data would otherwise be alarming.
 *
 * Password rules are validated live and shown as a checklist. The API is the
 * authority — this is only so the user is not told "too short" after a round
 * trip.
 */

const MIN_PASSWORD = 10;

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const rules = useMemo(
    () => [
      { label: `At least ${MIN_PASSWORD} characters`, met: password.length >= MIN_PASSWORD },
      { label: "Not only letters", met: /[^a-zA-Z]/.test(password) },
    ],
    [password],
  );

  const canSubmit =
    displayName.trim().length > 0 && email.trim().length > 0 && rules.every((r) => r.met);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!canSubmit) return;
      setBusy(true);
      setError(null);
      try {
        const result = await api.register(email.trim(), displayName.trim(), password);
        tokens.set(result.tokens.access_token, result.tokens.refresh_token);
        router.replace("/app");
      } catch (cause) {
        setError(cause instanceof ApiError ? cause : null);
        setBusy(false);
      }
    },
    [canSubmit, email, displayName, password, router],
  );

  return (
    <AuthShell
      image="/img/auth-signup.jpg"
      imagePosition="50% 45%"
      eyebrow="Start earning"
      headline={<>A coin for every hundred rupees.</>}
      blurb="Your account arrives with the full sample statement already loaded, so there is something to look at from the first second."
      stats={[
        ["1 coin", "per ₹100"],
        ["6", "rewards"],
        ["₹1,000", "top reward"],
      ]}
    >
      <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-text">
        Create your account
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-text-dim">
        Takes about fifteen seconds. No card required.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <AuthField label="Your name">
          <input
            type="text"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
            placeholder="Aarav Mehta"
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="Password">
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            className={authInputClass}
          />
        </AuthField>

        {/* Live checklist rather than an error after submitting. Length is the
            property that actually resists guessing, so it leads. */}
        <ul className="space-y-1.5">
          {rules.map((rule) => (
            <li key={rule.label} className="flex items-center gap-2 text-[12px]">
              <span
                aria-hidden
                className="grid size-4 shrink-0 place-items-center rounded-full border transition-colors"
                style={{
                  borderColor: rule.met ? "var(--accent)" : "var(--border-strong)",
                  background: rule.met ? "var(--accent)" : "transparent",
                  color: "var(--on-accent)",
                }}
              >
                {rule.met && <Check size={10} strokeWidth={3} />}
              </span>
              <span style={{ color: rule.met ? "var(--text-dim)" : "var(--text-faint)" }}>
                {rule.label}
              </span>
            </li>
          ))}
        </ul>

        {error && <AuthError what={error.fault.what} action={error.fault.action} />}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          disabled={!canSubmit}
          className="w-full"
        >
          Create account
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-text-dim underline-offset-4 transition-colors hover:text-text hover:underline"
      >
        I already have an account
        <ArrowRight size={13} aria-hidden />
      </Link>

      <p className="mt-8 border-t border-border pt-5 text-[12px] leading-relaxed text-text-faint">
        New accounts receive their own copy of the sample statement — 10,000 transactions and the
        coin ledger derived from them — so the dashboard is populated immediately.
      </p>
    </AuthShell>
  );
}
