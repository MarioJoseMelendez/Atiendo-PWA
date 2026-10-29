"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid gap-3 rounded-xl bg-card px-4 py-8 ring-1 ring-foreground/10">
      <h1 className="font-heading text-2xl">No se pudo abrir esta pantalla</h1>
      <p className="text-sm text-muted-foreground">
        El inventario sigue guardado en este navegador. Vuelve a intentar.
      </p>
      <div>
        <Button type="button" onClick={() => reset()}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
