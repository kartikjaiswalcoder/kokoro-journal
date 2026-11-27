import { buildPushHTTPRequest } from "@pushforge/builder";

export type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; tag?: string; url?: string };

/** Sends one push. Returns "gone" when the browser revoked the subscription. */
export async function sendPush(sub: StoredSubscription, payload: PushPayload): Promise<"sent" | "gone" | "failed"> {
  const key = process.env["VAPID_PRIVATE_KEY"];
  if (!key) {
    console.error("VAPID_PRIVATE_KEY is not configured");
    return "failed";
  }
  try {
    const { endpoint, headers, body } = await buildPushHTTPRequest({
      privateJWK: JSON.parse(key),
      subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      message: {
        payload: { url: "/", ...payload },
        adminContact: "https://kokoro-journal.lovable.app",
        options: { ttl: 3600, urgency: "high", topic: "kokoro-reminder" },
      },
    });
    const response = await fetch(endpoint, { method: "POST", headers, body, signal: AbortSignal.timeout(10000) });
    if (response.status === 404 || response.status === 410) return "gone";
    if (!response.ok) {
      console.error("Push send failed", response.status, (await response.text()).slice(0, 200));
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("Push send failed", error instanceof Error ? error.message : "unknown");
    return "failed";
  }
}
