import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import TeamView from "./team-view";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Bloqueo real en el servidor, no solo esconder el link del nav — un
  // STAFF que entre a esta URL a mano vuelve al dashboard.
  if (session.role !== "OWNER") redirect("/dashboard");

  const staff = await db.user.findMany({
    where: { tenantId: session.tenantId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return <TeamView initialStaff={staff} currentUserId={session.userId} />;
}
