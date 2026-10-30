"use client";

import { useEffect } from "react";
import { dismissInstallHint, useInstallHint } from "@/lib/live";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (cancelled) return;
        void registration.update();
      })
      .catch(() => {
        // La app sigue usable si el navegador rechaza el service worker.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

export function InstallHint() {
  const hint = useInstallHint();
  if (hint === "hidden") return null;

  return (
    <div className="rounded-xl bg-[#f3ead7] px-3 py-3 text-[#1c1915] md:bg-white/10 md:text-[#f6f1e6]">
      <p className="text-sm leading-5">
        {hint === "ready"
          ? "Lista para instalar. En Chrome abre los tres puntos y elige Instalar Atiendo."
          : "Para instalarla, abre el menú de Chrome (los tres puntos) y elige Instalar Atiendo."}
      </p>
      <button
        type="button"
        className="mt-2 text-xs font-medium underline underline-offset-2"
        onClick={() => dismissInstallHint()}
      >
        Ocultar
      </button>
    </div>
  );
}
