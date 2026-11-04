import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Provider } from "./ai";
import {
  appendChat,
  clearChat,
  emptyChats,
  readChats,
  type ChatLog,
  type ChatMessage,
  type ChatScope,
} from "./chat";
import { isStore } from "./storage";
import type { Store } from "./types";

export type DbKeys = Partial<Record<Provider, string>>;

export type Db = {
  version: 1;
  keys: DbKeys;
  store: Store | null;
  chats: ChatLog;
  updatedAt: string;
};

function defaultPath(): string {
  const configured = (process.env.ATIENDO_DB_PATH ?? "").trim();
  if (configured) return path.resolve(configured);
  const dataHome =
    (process.env.XDG_DATA_HOME ?? "").trim() || path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, "atiendo", "atiendo.json");
}

const DB_PATH = defaultPath();

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function readKeys(value: unknown): DbKeys {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const keys: DbKeys = {};
  if (typeof record.nvidia === "string" && record.nvidia.trim()) {
    keys.nvidia = record.nvidia.trim();
  }
  if (typeof record.openrouter === "string" && record.openrouter.trim()) {
    keys.openrouter = record.openrouter.trim();
  }
  return keys;
}

async function readDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(/*turbopackIgnore: true*/ DB_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const record =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    return {
      version: 1,
      keys: readKeys(record.keys),
      store: isStore(record.store) ? record.store : null,
      chats: readChats(record.chats),
      updatedAt:
        typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
    };
  } catch {
    return {
      version: 1,
      keys: {},
      store: null,
      chats: emptyChats(),
      updatedAt: new Date().toISOString(),
    };
  }
}

async function writeDb(db: Db): Promise<void> {
  const directory = path.dirname(DB_PATH);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const temp = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(/*turbopackIgnore: true*/ temp, JSON.stringify(db, null, 2), {
    mode: 0o600,
  });
  await fs.rename(temp, DB_PATH);
}

export function getDb(): Promise<Db> {
  return readDb();
}

export function saveKey(provider: Provider, key: string): Promise<void> {
  const value = key.trim();
  if (!value) return Promise.resolve();
  return enqueue(async () => {
    const db = await readDb();
    db.keys[provider] = value;
    db.updatedAt = new Date().toISOString();
    await writeDb(db);
  });
}

export function saveStore(store: Store): Promise<void> {
  return enqueue(async () => {
    const db = await readDb();
    db.store = store;
    db.updatedAt = new Date().toISOString();
    await writeDb(db);
  });
}

export function appendChatMessages(
  scope: ChatScope,
  messages: ChatMessage[],
): Promise<void> {
  if (messages.length === 0) return Promise.resolve();
  return enqueue(async () => {
    const db = await readDb();
    db.chats = appendChat(db.chats, scope, messages);
    db.updatedAt = new Date().toISOString();
    await writeDb(db);
  });
}

export function clearChatMessages(scope: ChatScope): Promise<void> {
  return enqueue(async () => {
    const db = await readDb();
    db.chats = clearChat(db.chats, scope);
    db.updatedAt = new Date().toISOString();
    await writeDb(db);
  });
}
