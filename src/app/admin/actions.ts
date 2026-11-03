"use server";

import { redirect } from "next/navigation";

import { requireAdminMutation } from "@/server/auth/require-admin";
import { revokeCurrentSession } from "@/server/auth/sessions";

export async function logoutAction(formData: FormData): Promise<void> {
  const csrf = formData.get("_csrf");
  await requireAdminMutation(typeof csrf === "string" ? csrf : null);
  await revokeCurrentSession();
  redirect("/admin/login");
}
