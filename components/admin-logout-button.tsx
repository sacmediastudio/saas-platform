"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-[#343233]/70 hover:text-red-600">
      <LogOut size={15} aria-hidden />
      Cerrar sesión
    </button>
  );
}
