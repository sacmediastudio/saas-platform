import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEnabledModules } from "@/lib/modules";
import TeamView from "./team-view";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Bloqueo real en el servidor, no solo esconder el link del nav — un
  // STAFF que entre a esta URL a mano vuelve al dashboard.
  if (session.role !== "OWNER") redirect("/dashboard");

  const [staff, tenant] = await Promise.all([
    db.user.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.tenant.findUnique({ where: { id: session.tenantId } }),
  ]);

  return (
    <TeamView
      initialStaff={staff}
      currentUserId={session.userId}
      enabledModules={tenant ? getEnabledModules(tenant) : []}
    />
  );
}
