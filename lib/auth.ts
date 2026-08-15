import { redirect } from "next/navigation";
import { getServerEnv, isDemoMode } from "@/lib/config";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

export interface AdminUser {
  email: string;
  demo: boolean;
}

export async function getAdminUser(): Promise<AdminUser | null> {
  if (isDemoMode()) return { email: "demo-admin@localhost", demo: true };

  const env = getServerEnv();
  const supabase = await createAuthenticatedSupabaseClient();
  const allowedEmails = [
    env.ADMIN_EMAIL,
    ...(env.ADMIN_EMAILS || "").split(","),
  ]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!supabase || allowedEmails.length === 0) return null;

  const { data, error } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (error || !email || !allowedEmails.includes(email)) return null;
  return { email, demo: false };
}

export async function requireAdmin(returnTo = "/admin") {
  const admin = await getAdminUser();
  if (!admin) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return admin;
}

export async function assertAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("UNAUTHORIZED");
  return admin;
}
