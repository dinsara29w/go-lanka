import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { requireAdmin } from "@/server/auth/require-admin";
import { listSessionsForAdmin } from "@/server/auth/sessions";

import { revokeAllOtherSessionsAction, revokeSessionAction } from "../actions";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminSessionsPage() {
  const session = await requireAdmin();
  const sessions = await listSessionsForAdmin(session.admin.id);
  const activeSessions = sessions.filter((item) => item.isActive);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.settings}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {strings.admin.activeSessions}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {strings.admin.sessionsIntro}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <form action={revokeAllOtherSessionsAction}>
          <input type="hidden" name="_csrf" value={session.csrfToken} />
          <Button type="submit" variant="outline">
            {strings.admin.revokeAllOthers}
          </Button>
        </form>
      </div>

      {activeSessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          {strings.admin.noSessions}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {activeSessions.map((item) => {
              const isCurrent = item.id === session.sessionId;
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {isCurrent ? strings.admin.currentSession : item.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {strings.admin.lastSeen}: {dateFormatter.format(item.lastSeenAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {strings.admin.expires}: {dateFormatter.format(item.absoluteExpiresAt)}
                    </p>
                    {item.ipHash ? (
                      <p className="font-mono text-xs text-muted-foreground">
                        {strings.admin.ipHash}: {item.ipHash.slice(0, 12)}…
                      </p>
                    ) : null}
                  </div>

                  {!isCurrent ? (
                    <form action={revokeSessionAction}>
                      <input type="hidden" name="_csrf" value={session.csrfToken} />
                      <input type="hidden" name="sessionId" value={item.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        {strings.admin.revoke}
                      </Button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
