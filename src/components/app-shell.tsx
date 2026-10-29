"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, BookOpen, QrCode } from "lucide-react";
import type { ReactNode } from "react";
import { InventoryProvider } from "@/components/inventory-provider";
import { InstallHint, PwaRegister } from "@/components/pwa-register";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Inventario", icon: BookOpen },
  { href: "/etiquetas", label: "Etiquetas", icon: QrCode },
  { href: "/caja", label: "Caja", icon: Banknote },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <InventoryProvider>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-[#173328] text-[#f6f1e6] print:hidden md:flex">
          <div className="flex items-center gap-3 px-5 pt-6">
            <span className="grid size-10 place-items-center rounded-lg bg-[#f3ead7] text-[#173328]">
              <BookOpen className="size-5" />
            </span>
            <div>
              <p className="font-heading text-xl leading-none">Estante</p>
              <p className="mt-1 text-xs text-[#f6f1e6]/70">Librería · solo efectivo</p>
            </div>
          </div>
          <nav className="mt-8 grid gap-1 px-3" aria-label="Secciones">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                    active ? "bg-[#f3ead7] text-[#173328]" : "text-[#f6f1e6]/85 hover:bg-white/10",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto grid gap-3 px-4 pb-5">
            <InstallHint />
            <p className="text-xs leading-5 text-[#f6f1e6]/60">
              El inventario y las ventas se quedan en este navegador.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between bg-[#173328] px-4 py-3 text-[#f6f1e6] print:hidden md:hidden">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4" />
              <p className="font-heading text-lg leading-none">Estante</p>
            </div>
            <p className="text-xs text-[#f6f1e6]/70">Solo efectivo</p>
          </header>
          <div className="px-4 pt-3 print:hidden md:hidden">
            <InstallHint />
          </div>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 print:max-w-none print:p-0 md:px-8 md:py-8 md:pb-10">
            {children}
          </main>
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e3d5bb] bg-[#fffaf3]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden md:hidden"
        aria-label="Secciones"
      >
        <ul className="grid grid-cols-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                    active ? "text-[#1e3d32]" : "text-[#645c52]",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <PwaRegister />
    </InventoryProvider>
  );
}
