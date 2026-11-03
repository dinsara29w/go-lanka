"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

import { inviteAdminAction, type InviteActionState } from "../actions";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const initialState: InviteActionState = {};

export function InviteAdminForm({ csrfToken }: { csrfToken: string }) {
  const [state, formAction, pending] = useActionState(inviteAdminAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="_csrf" value={csrfToken} />

      {state.ok && state.message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {state.message}
        </div>
      ) : null}
      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="invite-email" className="text-sm font-medium">
          {strings.admin.inviteEmail}
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {strings.admin.inviteAdmin}
      </Button>
    </form>
  );
}
