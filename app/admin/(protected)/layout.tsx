import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LayoutDashboard, Building2, History } from "lucide-react";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import AdminLogoutButton from "@/components/admin-logout-button";

export const metadata: Metadata = { title: "Zertoo | Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const admin = await db.adminUser.findUnique({ where: { id: session.adminId } });
  if (!admin) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-white text-[#002D09] grid md:grid-cols-[240px_1fr]">
      <aside className="border-r border-[#002D09]/[0.08] p-5 flex flex-col gap-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Zertoo" className="h-6 w-auto mb-1" />
          <p className="text-[10px] font-bold tracking-wider text-[#343233]/50">ADMIN</p>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#343233] hover:bg-[#F7F8F4] hover:text-[#002D09]"
          >
            <LayoutDashboard size={16} aria-hidden />
            Resumen
          </Link>
          <Link
            href="/admin/tenants"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#343233] hover:bg-[#F7F8F4] hover:text-[#002D09]"
          >
            <Building2 size={16} aria-hidden />
            Negocios
          </Link>
          <Link
            href="/admin/activity"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#343233] hover:bg-[#F7F8F4] hover:text-[#002D09]"
          >
            <History size={16} aria-hidden />
            Actividad
          </Link>
        </nav>

        <div className="pt-4 border-t border-[#002D09]/[0.08]">
          <p className="text-xs text-[#343233]/60 mb-2 truncate">{admin.email}</p>
          <AdminLogoutButton />
        </div>
      </aside>
      <main className="p-6 md:p-8">{children}</main>
    </div>
  );
}
