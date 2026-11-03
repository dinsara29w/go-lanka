import "server-only";

import { notFound, redirect } from "next/navigation";

import { assertSameOriginRequest, verifyCsrfToken } from "@/server/auth/csrf";
import { type CurrentSession, getCurrentSession } from "@/server/auth/sessions";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "unauthorized" | "forbidden" | "csrf" | "origin",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function getAdminSession(): Promise<CurrentSession | null> {
  return getCurrentSession();
}

export async function requireAdmin(): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function requireOwner(): Promise<CurrentSession> {
  const session = await requireAdmin();
  if (session.admin.role !== "owner") notFound();
  return session;
}

export async function requireAdminApi(): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) throw new AuthError("Authentication required", "unauthorized");
  return session;
}

export async function requireOwnerApi(): Promise<CurrentSession> {
  const session = await requireAdminApi();
  if (session.admin.role !== "owner") throw new AuthError("Owner role required", "forbidden");
  return session;
}

export async function requireAdminMutation(
  csrfToken: string | null | undefined,
): Promise<CurrentSession> {
  try {
    await assertSameOriginRequest();
  } catch {
    throw new AuthError("Invalid request origin", "origin");
  }

  const session = await requireAdminApi();
  if (!verifyCsrfToken(csrfToken, session.csrfToken)) {
    throw new AuthError("Invalid CSRF token", "csrf");
  }
  return session;
}

export async function requireOwnerMutation(
  csrfToken: string | null | undefined,
): Promise<CurrentSession> {
  const session = await requireAdminMutation(csrfToken);
  if (session.admin.role !== "owner") throw new AuthError("Owner role required", "forbidden");
  return session;
}
