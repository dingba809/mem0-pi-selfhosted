import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SelfHostedMem0Client } from "../selfhosted-client.ts";
import type { Mem0Config, ScopeContext } from "../types.ts";
import { resolveAddParams } from "../memory/scoping.ts";
import { captureEvent } from "../telemetry.ts";
import { createMemoryLifecycle } from "../core/lifecycle.ts";

export { extractConversation } from "../core/lifecycle.ts";

export function setupAutoCapture(
  pi: ExtensionAPI,
  mem0: SelfHostedMem0Client,
  config: Mem0Config,
  getScopeCtx: () => ScopeContext,
  telemetryCtx?: { apiKey?: string },
  lifecycle: ReturnType<typeof createMemoryLifecycle> = createMemoryLifecycle(),
): void {
  if (!config.autoCapture) return;

  pi.on("agent_end", async (event) => {
    const messages = event.messages ?? [];
    const conversation = lifecycle.prepareConversation(messages);
    if (conversation.length === 0) return;

    const scopeCtx = getScopeCtx();
    const addParams = resolveAddParams("project", scopeCtx);

    try {
      await mem0.add(conversation, addParams);
      captureEvent("pi.capture.auto", { success: true, message_count: conversation.length }, telemetryCtx);
    } catch (err: unknown) {
      captureEvent("pi.capture.auto", {
        success: false,
        error_type: err instanceof Error ? err.name : "unknown",
      }, telemetryCtx);
      console.error("[mem0] auto-capture failed:", err);
    }
  });
}
