"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

import { loginAction, type AuthActionState } from "../actions";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const initialState: AuthActionState = {};

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {strings.admin.signInTitle}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{strings.admin.signInIntro}</p>
      </div>

      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="admin-email" className="text-sm font-medium">
          {strings.admin.email}
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="admin-password" className="text-sm font-medium">
          {strings.admin.password}
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="admin-totp" className="text-sm font-medium">
          {strings.admin.totp}
        </label>
        <input
          id="admin-totp"
          name="totp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          className={inputClass}
          placeholder="123456"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? strings.admin.signingIn : strings.admin.signIn}
      </Button>

      <div className="text-center text-sm">
        <Link
          href="/admin/forgot-password"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {strings.admin.forgotPassword}
        </Link>
      </div>
    </form>
  );
}
