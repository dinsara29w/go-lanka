"use client";

import { useActionState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

import { completeSetupAction, type AuthActionState } from "../actions";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const initialState: AuthActionState = {};

export function AdminSetupForm({
  token,
  email,
  qrDataUrl,
}: {
  token: string;
  email: string;
  qrDataUrl: string;
}) {
  const [state, formAction, pending] = useActionState(completeSetupAction, initialState);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {strings.admin.setupTitle}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{strings.admin.setupIntro}</p>
        <p className="text-sm font-medium">{email}</p>
      </div>

      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="setup-password" className="text-sm font-medium">
            {strings.admin.newPassword}
          </label>
          <input
            id="setup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="setup-confirm" className="text-sm font-medium">
            {strings.admin.confirmPassword}
          </label>
          <input
            id="setup-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <h2 className="text-sm font-semibold">{strings.admin.enrolTitle}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{strings.admin.enrolBody}</p>
        <Image
          src={qrDataUrl}
          alt="Authenticator app QR code"
          width={256}
          height={256}
          unoptimized
          className="mx-auto rounded-lg bg-white p-2"
        />
        <div>
          <label htmlFor="setup-totp" className="text-sm font-medium">
            {strings.admin.totp}
          </label>
          <input
            id="setup-totp"
            name="totp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className={inputClass}
            placeholder="123456"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? strings.admin.completingSetup : strings.admin.completeSetup}
      </Button>
    </form>
  );
}
