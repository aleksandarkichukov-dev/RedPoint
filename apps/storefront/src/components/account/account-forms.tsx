"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  loginAction,
  registerAction,
  type AccountState,
} from "@/lib/customer-actions";

/**
 * The two forms, side by side in the same file because they are two halves of
 * one decision: somebody arriving here either has an account or is about to.
 *
 * Errors are monochrome, like every other error in this shop — the red is
 * reserved for sale signage and nothing else. A failed login is a hard black
 * message, not a red one.
 */

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="border-l-2 border-primary pl-3 font-body text-body font-semibold">
      {children}
    </p>
  );
}

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(loginAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Problem>{state.error}</Problem>}

      <Input label="Имейл" name="email" type="email" autoComplete="email" required />
      <Input
        label="Парола"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "влизаме…" : "влез"}
      </Button>

      {googleEnabled && <GoogleButton label="влез с Google" />}
    </form>
  );
}

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(registerAction, {});
  const error = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Problem>{state.error}</Problem>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Име" name="firstName" autoComplete="given-name" required error={error("firstName")} />
        <Input label="Фамилия" name="lastName" autoComplete="family-name" required error={error("lastName")} />
      </div>
      <Input label="Имейл" name="email" type="email" autoComplete="email" required error={error("email")} />
      <Input
        label="Парола"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={error("password")}
        helper="Поне 8 знака."
      />

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "създаваме…" : "създай профил"}
      </Button>

      {googleEnabled && <GoogleButton label="продължи с Google" />}

      <p className="font-body text-body text-muted-text">
        Създавайки профил, приемате{" "}
        <Link href="/legal/terms" className="underline underline-offset-4">
          Общите условия
        </Link>{" "}
        и{" "}
        <Link href="/legal/privacy" className="underline underline-offset-4">
          Политиката за лични данни
        </Link>
        .
      </p>
    </form>
  );
}

/**
 * A link, not a button inside the form.
 *
 * Google's flow is a redirect the backend starts, so this must not submit the
 * form it sits in — a button inside a <form> does that by default, and the
 * result is an empty login attempt racing a redirect.
 */
function GoogleButton({ label }: { label: string }) {
  return (
    <a
      href="/account/google/start"
      className="flex h-10 w-fit items-center gap-3 border-2 border-primary px-4 font-body text-control text-primary active:translate-y-px"
    >
      {/* Google's own mark, four colours, as their brand terms require. It is
          the one place in this shop where a colour other than the sale red
          appears, and it is not ours to restyle. */}
      <svg viewBox="0 0 48 48" aria-hidden className="size-5">
        <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36.2 45 30.6 45 24z" />
        <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46z" />
        <path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 9.9l7.1-5.5z" />
        <path fill="#EA4335" d="M24 10.5c3.3 0 6.1 1.1 8.4 3.3l6.1-6.1C34.9 4.2 29.9 2 24 2 15.4 2 8.1 6.9 4.4 14.1l7.1 5.5c1.8-5.3 6.7-9.1 12.5-9.1z" />
      </svg>
      {label}
    </a>
  );
}
