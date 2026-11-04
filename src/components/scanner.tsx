"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Settings } from "lucide-react";

type Phase = "idle" | "starting" | "live" | "error";

type CameraFailure = {
  message: string;
  permission: boolean;
};

let scannerQueue: Promise<void> = Promise.resolve();

function enqueueScanner(task: () => Promise<void>): Promise<void> {
  const run = scannerQueue.then(task, task);
  scannerQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function cameraFailure(error: unknown): CameraFailure {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return {
      permission: true,
      message:
        "Chrome bloqueó la cámara para este sitio. Abre los ajustes y permite la cámara, o escribe el código.",
    };
  }
  if (/NotFound|NotReadable|Overconstrained|no camera|devices/i.test(text)) {
    return {
      permission: false,
      message: "No hay una cámara disponible en este equipo. Escribe el código que va debajo del QR.",
    };
  }
  if (/secure|https|insecure/i.test(text)) {
    return {
      permission: false,
      message: "La cámara necesita Chrome en https o en localhost.",
    };
  }
  return {
    permission: false,
    message: "No se pudo abrir la cámara. Puedes cobrar igual escribiendo el código.",
  };
}

function cameraSettingsUrl(): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Chrome puede negar el portapapeles; se intenta el método anterior.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

export function Scanner({ onScan }: { onScan: (raw: string) => void }) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [failure, setFailure] = useState<CameraFailure | null>(null);
  const [settingsUrl, setSettingsUrl] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [session, setSession] = useState(0);

  function retry() {
    setFailure(null);
    setSettingsUrl(null);
    setSettingsNotice(null);
    setPhase("starting");
    setSession((value) => value + 1);
  }

  async function openSettings() {
    if (!settingsUrl) return;
    const copied = await copyText(settingsUrl);
    setSettingsNotice(
      copied
        ? "Dirección copiada. Si Chrome no abrió los ajustes, pégala en la barra de direcciones."
        : "Copia esta dirección en la barra de direcciones de Chrome:",
    );
    try {
      window.location.assign(settingsUrl);
    } catch {
      // Chrome no permite abrir chrome:// desde una página.
    }
  }

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
        setFailure(null);
        setSettingsUrl(null);
        setSettingsNotice(null);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      } catch (error) {
        if (!cancelled) {
          const next = cameraFailure(error);
          setPhase("error");
          setFailure(next);
          setSettingsUrl(next.permission ? cameraSettingsUrl() : null);
          setSettingsNotice(null);
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
              onClick={retry}
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
      {phase === "error" && failure ? (
        <div className="grid gap-3" role="alert">
          <p className="text-sm text-destructive">{failure.message}</p>
          <div className="flex flex-wrap gap-2">
            {failure.permission ? (
              <Button type="button" onClick={() => void openSettings()}>
                <Settings />
                Abrir ajustes de cámara
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={retry}>
              Reintentar cámara
            </Button>
          </div>
          {settingsUrl ? (
            <div className="grid gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {settingsNotice ??
                  "El botón copia la dirección exacta de los ajustes de este sitio."}
              </p>
              <code className="break-all text-[11px] text-muted-foreground">{settingsUrl}</code>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
