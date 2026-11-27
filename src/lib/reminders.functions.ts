import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendPush } from "./push.server";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
});

// Links this browser's notification subscription to the signed-in person. An endpoint
// belongs to one browser, so a previous owner (another account on the same device) is replaced.
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(subscriptionSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint).neq("user_id", context.userId);
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      { user_id: context.userId, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error("This device couldn't be set up for reminders. Please try again.");
    return { ok: true };
  });

export const sendTestReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: subs, error } = await context.supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", context.userId);
    if (error) throw new Error("Couldn't send a test right now.");
    let sent = 0;
    for (const sub of subs ?? []) {
      const result = await sendPush(sub, { title: "Kokoro · 心", body: "Reminders are on 🌸 See you at your writing time.", tag: "kokoro-test" });
      if (result === "sent") sent++;
      if (result === "gone") await context.supabase.from("push_subscriptions").delete().eq("id", sub.id);
    }
    return { sent };
  });
