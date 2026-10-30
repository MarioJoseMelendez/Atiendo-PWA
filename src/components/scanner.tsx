"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

type Phase = "idle" | "starting" | "live" | "error";

let scannerQueue: Promise<void> = Promise.resolve();

function enqueueScanner(task: () => Promise<void>): Promise<void> {
  const run = scannerQueue.then(task, task);
  scannerQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function cameraErrorMessage(error: unknown): string {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return "Chrome bloqueó la cámara. Ábrela en el candado de la barra y vuelve a intentar, o escribe el código.";
  }
  if (/NotFound|NotReadable|Overconstrained|no camera|devices/i.test(text)) {
    return "No hay una cámara disponible en este equipo. Escribe el código que va debajo del QR.";
  }
  if (/secure|https|insecure/i.test(text)) {
    return "La cámara necesita Chrome en https o en localhost.";
  }
  return "No se pudo abrir la cámara. Puedes cobrar igual escribiendo el código.";
}

export function Scanner({ onScan }: { onScan: (raw: string) => void }) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (session === 0) return;
    let cancelled = false;
    let release: (() => void) | null = null;

    void enqueueScanner(async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode("atiendo-reader", { verbose: false });
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            aspectRatio: 1,
            qrbox: (width, height) => {
              const edge = Math.max(140, Math.floor(Math.min(width, height) * 0.72));
              return { width: edge, height: edge };
            },
          },
          (text) => onScanRef.current(text),
          () => undefined,
        );
        if (cancelled) return;
        setPhase("live");
        setMessage(null);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      } catch (error) {
        if (!cancelled) {
          setPhase("error");
          setMessage(cameraErrorMessage(error));
        }
      } finally {
        if (scanner.isScanning) {
          await scanner.stop().catch(() => undefined);
        }
        try {
          scanner.clear();
        } catch {
          // El visor ya se limpió.
        }
      }
    });

    return () => {
      cancelled = true;
      release?.();
    };
  }, [session]);

  return (
    <div className="grid gap-3">
      <div id="atiendo-reader" className={phase === "idle" ? "hidden" : "block"} />
      {phase === "idle" ? (
        <div className="grid min-h-64 place-items-center rounded-2xl bg-[#173328] px-6 text-center text-[#f6f1e6]">
          <div className="grid gap-3">
            <p className="font-heading text-2xl">Cobra con la cámara</p>
            <p className="text-sm text-[#f6f1e6]/75">
              Apunta al QR del artículo. El nombre que va debajo te dice si es pieza o paquete.
            </p>
            <Button
              type="button"
              className="mx-auto h-11 bg-[#f3ead7] text-[#173328] hover:bg-[#fffaf3]"
              onClick={() => {
                setMessage(null);
                setPhase("starting");
                setSession((value) => value + 1);
              }}
            >
              <Camera />
              Activar cámara
            </Button>
          </div>
        </div>
      ) : null}
      {phase === "starting" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Abriendo la cámara…
        </p>
      ) : null}
      {phase === "live" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Cámara lista. El mismo QR no se suma otra vez hasta que lo apartes un momento.
        </p>
      ) : null}
      {phase === "error" && message ? (
        <div className="grid gap-2" role="alert">
          <p className="text-sm text-destructive">{message}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMessage(null);
              setPhase("starting");
              setSession((value) => value + 1);
            }}
          >
            Reintentar cámara
          </Button>
        </div>
      ) : null}
    </div>
  );
}
