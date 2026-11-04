import type { Provider } from "./ai";

export type ProviderConfig = {
  label: string;
  url: string;
  defaultModel: string;
  envKey: string;
  envModel: string;
  extraHeaders?: (request: Request) => Record<string, string>;
};

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  nvidia: {
    label: "NVIDIA",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    defaultModel: "nvidia/llama-3.1-nemotron-70b-instruct",
    envKey: "NVIDIA_API_KEY",
    envModel: "NVIDIA_MODEL",
  },
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openrouter/auto",
    envKey: "OPENROUTER_API_KEY",
    envModel: "OPENROUTER_MODEL",
    extraHeaders: (request) => ({
      "HTTP-Referer": new URL(request.url).origin,
      "X-Title": "Atiendo",
    }),
  },
};

export type ChatTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompletionResult =
  | { ok: true; content: string }
  | { ok: false; error: string };

export function providerError(provider: Provider, status: number): string {
  const label = PROVIDERS[provider].label;
  if (status === 401 || status === 403) {
    return `La clave de ${label} no es válida o no tiene permiso.`;
  }
  if (status === 429) {
    return `${label} está limitando las solicitudes. Espera un momento y vuelve a intentar.`;
  }
  if (status === 404) {
    return `El modelo de ${label} configurado no está disponible.`;
  }
  return `${label} respondió con un error (${status}). Intenta de nuevo.`;
}

export function providerModel(provider: Provider): string {
  const config = PROVIDERS[provider];
  return (process.env[config.envModel] ?? "").trim() || config.defaultModel;
}

export function resolveProviderKeys(
  provided: Partial<Record<Provider, string>>,
  dbKeys: Partial<Record<Provider, string>>,
): Record<Provider, string> {
  return {
    nvidia:
      provided.nvidia ||
      dbKeys.nvidia?.trim() ||
      (process.env.NVIDIA_API_KEY ?? "").trim(),
    openrouter:
      provided.openrouter ||
      dbKeys.openrouter?.trim() ||
      (process.env.OPENROUTER_API_KEY ?? "").trim(),
  };
}

export async function completeChat(
  provider: Provider,
  key: string,
  model: string,
  messages: ChatTurn[],
  request: Request,
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number },
): Promise<CompletionResult> {
  const config = PROVIDERS[provider];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${key}`,
    ...(config.extraHeaders ? config.extraHeaders(request) : {}),
  };

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.2,
        top_p: 0.9,
        max_tokens: options?.maxTokens ?? 2048,
        stream: false,
      }),
      signal: AbortSignal.timeout(options?.timeoutMs ?? 45_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut
        ? `${config.label} tardó demasiado en responder.`
        : `No se pudo conectar con ${config.label}.`,
    };
  }

  if (!response.ok) {
    return { ok: false, error: providerError(provider, response.status) };
  }

  let content: string | undefined;
  try {
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const raw = payload.choices?.[0]?.message?.content;
    content = typeof raw === "string" ? raw : undefined;
  } catch {
    return { ok: false, error: `${config.label} devolvió una respuesta que no se pudo leer.` };
  }

  if (!content) {
    return { ok: false, error: `${config.label} no devolvió contenido.` };
  }

  return { ok: true, content };
}
