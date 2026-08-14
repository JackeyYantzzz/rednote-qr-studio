import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin("/admin");
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
