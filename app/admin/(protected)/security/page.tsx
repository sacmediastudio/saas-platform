import { requireAdmin } from "@/lib/admin-auth";
import SecurityView from "./security-view";

export default async function AdminSecurityPage() {
  const admin = await requireAdmin();
  return <SecurityView initialEnabled={admin.twoFactorEnabled} />;
}
