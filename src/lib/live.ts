"use client";

import { useSyncExternalStore } from "react";

const SERVER_TODAY = "";

function subscribePing(callback: () => void): () => void {
  const id = window.setTimeout(callback, 0);
  return () => window.clearTimeout(id);
}

export function useGuatemalaToday(dayKey: (date: Date) => string): string {
  return useSyncExternalStore(subscribePing, () => dayKey(new Date()), () => SERVER_TODAY);
}

function readHash(): string {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return hash || "todo";
}

function subscribeHash(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  const id = window.setTimeout(callback, 0);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.clearTimeout(id);
  };
}

export function useLabelGroup(): string {
  return useSyncExternalStore(subscribeHash, readHash, () => "todo");
}

export function replaceLabelGroup(groupId: string): void {
  const url = groupId === "todo" ? "/etiquetas#todo" : `/etiquetas#${encodeURIComponent(groupId)}`;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

let installReady = false;
const INSTALL_HIDDEN = "hidden";

function installKey(): string {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const dismissed =
    localStorage.getItem("atiendo.hideInstallHint") === "1" ||
    localStorage.getItem("estante.hideInstallHint") === "1";
  if (standalone || dismissed) return INSTALL_HIDDEN;
  return installReady ? "ready" : "hint";
}

function subscribeInstall(callback: () => void): () => void {
  const onPrompt = () => {
    installReady = true;
    callback();
  };
  const media = window.matchMedia("(display-mode: standalone)");
  const id = window.setTimeout(callback, 0);
  window.addEventListener("atiendo-install-hint", callback);
  window.addEventListener("beforeinstallprompt", onPrompt);
  media.addEventListener("change", callback);
  return () => {
    window.clearTimeout(id);
    window.removeEventListener("atiendo-install-hint", callback);
    window.removeEventListener("beforeinstallprompt", onPrompt);
    media.removeEventListener("change", callback);
  };
}

export function useInstallHint(): "hidden" | "ready" | "hint" {
  const value = useSyncExternalStore(subscribeInstall, installKey, () => INSTALL_HIDDEN);
  if (value === "ready" || value === "hint") return value;
  return "hidden";
}

export function dismissInstallHint(): void {
  localStorage.setItem("atiendo.hideInstallHint", "1");
  window.dispatchEvent(new Event("atiendo-install-hint"));
}
