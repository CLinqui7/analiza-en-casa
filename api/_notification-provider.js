function providerReference(prefix = "sim") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function notificationProvider(mode = process.env.NOTIFICATIONS_MODE || "mock") {
  if (mode !== "live") {
    return {
      provider: "SIMULATED",
      async deliver() {
        // This is intentionally not a delivery claim. It records only a safe,
        // deterministic simulation result for QA and local development.
        return { state: "SIMULATED", providerReference: providerReference(), errorCode: null };
      }
    };
  }

  return {
    provider: "UNCONFIGURED",
    async deliver() {
      // Provider-specific clients are intentionally not guessed. A configured
      // server-side adapter can replace this interface without changing callers.
      return { state: "FAILED", providerReference: null, errorCode: "PROVIDER_NOT_CONFIGURED" };
    }
  };
}
