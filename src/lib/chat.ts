import { isProvider, type Provider } from "./ai";

export type ChatScope = "business" | "inventory";
export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  at: string;
  provider?: Provider;
  model?: string;
};

export type ChatLog = Record<ChatScope, ChatMessage[]>;

export const MAX_CHAT_MESSAGES = 80;
export const MAX_CHAT_CONTENT = 4_000;

export function isChatScope(value: unknown): value is ChatScope {
  return value === "business" || value === "inventory";
}

export function emptyChats(): ChatLog {
  return { business: [], inventory: [] };
}

export function readChatMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const role = record.role === "user" || record.role === "assistant" ? record.role : null;
  const content = typeof record.content === "string" ? record.content.trim() : "";
  const at = typeof record.at === "string" ? record.at : "";
  if (!id || !role || !content || !at) return null;
  const message: ChatMessage = {
    id,
    role,
    content: content.slice(0, MAX_CHAT_CONTENT),
    at,
  };
  if (isProvider(record.provider)) message.provider = record.provider;
  if (typeof record.model === "string" && record.model.trim()) {
    message.model = record.model.trim();
  }
  return message;
}

export function readChats(value: unknown): ChatLog {
  const chats = emptyChats();
  if (!value || typeof value !== "object") return chats;
  const record = value as Record<string, unknown>;
  for (const scope of ["business", "inventory"] as const) {
    const list = record[scope];
    if (!Array.isArray(list)) continue;
    chats[scope] = list
      .map(readChatMessage)
      .filter((message): message is ChatMessage => message !== null)
      .slice(-MAX_CHAT_MESSAGES);
  }
  return chats;
}

export function appendChat(
  chats: ChatLog,
  scope: ChatScope,
  messages: ChatMessage[],
): ChatLog {
  return {
    ...chats,
    [scope]: [...chats[scope], ...messages].slice(-MAX_CHAT_MESSAGES),
  };
}

export function clearChat(chats: ChatLog, scope: ChatScope): ChatLog {
  return { ...chats, [scope]: [] };
}
