"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

import { forgotPasswordAction, type AuthActionState } from "../actions";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const initialState: AuthActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {strings.admin.forgotTitle}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{strings.admin.forgotIntro}</p>
      </div>

      {state.message ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          {state.message}
        </div>
      ) : null}

      <div>
        <label htmlFor="forgot-email" className="text-sm font-medium">
          {strings.admin.email}
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? strings.admin.sendingReset : strings.admin.sendReset}
      </Button>

      <div className="text-center text-sm">
        <Link
          href="/admin/login"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {strings.admin.signIn}
        </Link>
      </div>
    </form>
  );
}
