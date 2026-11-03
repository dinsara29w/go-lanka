import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/server/auth/sessions";

import { AdminLoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const session = await getCurrentSession();
  if (session) redirect("/admin");

  return <AdminLoginForm />;
}
