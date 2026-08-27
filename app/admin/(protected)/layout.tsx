import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LayoutDashboard, Building2, History, Users, Megaphone, Shield, Send, Sparkles } from "lucide-react";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import AdminLogoutButton from "@/components/admin-logout-button";

export const metadata: Metadata = { title: "Zertoo | Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const admin = await db.adminUser.findUnique({ where: { id: session.adminId } });
  if (!admin) redirect("/admin/login");

  const pendingRequestsCount = await db.moduleActivationRequest.count({ where: { status: "pending" } });

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#002D09] flex flex-col">
      <div className="grid md:grid-cols-[248px_1fr] flex-1">
        <aside className="bg-white border-r border-black/[0.06] p-5 flex flex-col gap-6 sticky top-0 h-screen">
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
            <Link
              href="/admin/customers"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#343233] hover:bg-[#F7F8F4] hover:text-[#002D09]"
            >
              <Users size={16} aria-hidden />
              Clientes
            </Link>
            <Link
              href="/admin/campaigns"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#343233] hover:bg-[#F7F8F4] hover:text-[#002D09]"
            >
              <Megaphone size={16} aria-hidden />
              Campañas
            </Link>
            <Link
              href="/admin/module-requests"
              className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#343233] hover:bg-[#F7F8F4] hover:text-[#002D09]"
            >
              <span className="flex items-center gap-2.5">
                <Send size={16} aria-hidden />
                Solicitudes
              </span>
              {pendingRequestsCount > 0 && (
                <span className="text-[10px] font-bold bg-[#E7FF00] text-[#002D09] rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                  {pendingRequestsCount}
                </span>
              )}
            </Link>
            <Link
              href="/admin/now"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#343233] hover:bg-[#F7F8F4] hover:text-[#002D09]"
            >
              <Sparkles size={16} aria-hidden />
              Zertoo Eats
            </Link>
            <Link
              href="/admin/security"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#343233] hover:bg-[#F7F8F4] hover:text-[#002D09]"
            >
              <Shield size={16} aria-hidden />
              Seguridad
            </Link>
          </nav>

          <div className="pt-4 border-t border-[#002D09]/[0.08]">
            <p className="text-xs text-[#343233]/60 mb-2 truncate">{admin.email}</p>
            <AdminLogoutButton />
          </div>
        </aside>
        <main className="p-5 sm:p-6 md:p-9">
          <div className="max-w-5xl flex flex-col gap-5">{children}</div>
        </main>
      </div>

      <footer className="bg-white border-t border-black/[0.06] px-5 md:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Zertoo" className="h-5 w-auto opacity-70" />
        <p className="text-xs text-[#343233]/50">© {new Date().getFullYear()} Zertoo. Un producto de Certucce Digital LLC. Panel de administración.</p>
      </footer>
    </div>
  );
}
