import { safeStorage } from "./domain.js";

export const DEFAULT_CONFIG = Object.freeze({
  appName: "Analiza en Casa",
  appUrl: "http://localhost:4173",
  dataMode: "mock",
  supabaseUrl: "",
  supabasePublishableKey: "",
  defaultOrgSlug: "analiza-en-casa-demo",
  notificationsMode: "mock",
  portalTokenTtlHours: 72,
  portalOtpTtlMinutes: 10
});

export async function loadRuntimeConfig() {
  const localOverride = (() => {
    try {
      return JSON.parse(safeStorage.getItem("aec-runtime-config") || "{}");
    } catch {
      return {};
    }
  })();

  let remote = {};
  if (location.protocol === "http:" || location.protocol === "https:") {
    try {
      const response = await fetch("/api/runtime-config", {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (response.ok) remote = await response.json();
    } catch {
      // El modo local puede ejecutarse sin API.
    }
  }

  return {
    ...DEFAULT_CONFIG,
    ...remote,
    ...localOverride
  };
}

export function saveRuntimeConfigOverride(values) {
  safeStorage.setItem("aec-runtime-config", JSON.stringify(values));
}

export const saveRuntimeOverride = saveRuntimeConfigOverride;
