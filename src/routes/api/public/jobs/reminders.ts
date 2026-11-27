import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { reminderAction, REMINDER_MESSAGES } from "@/lib/reminder-schedule";
import type { ReminderAction } from "@/lib/reminder-schedule";

// Called every minute by the scheduler: sends each person's daily reminder at their
// chosen local time, and a gentle follow-up 15 minutes later if they still haven't written.
export const Route = createFileRoute("/api/public/jobs/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPush } = await import("@/lib/push.server");
        const { data: settings, error } = await supabaseAdmin
          .from("app_settings")
          .select("user_id,reminder_time,reminder_timezone,reminder_sent_on,reminder_missed_sent_on")
          .not("reminder_time", "is", null);
        if (error) return Response.json({ error: "settings unavailable" }, { status: 500 });

        const now = new Date();
        const due: { userId: string; action: Exclude<ReminderAction, null>; dateKey: string }[] = [];
        for (const row of settings ?? []) {
          const { action, dateKey } = reminderAction({
            now,
            timeZone: row.reminder_timezone ?? "UTC",
            reminderTime: row.reminder_time,
            sentOn: row.reminder_sent_on,
            missedSentOn: row.reminder_missed_sent_on,
          });
          if (action) due.push({ userId: row.user_id, action, dateKey });
        }
        if (!due.length) return Response.json({ sent: 0 });

        // Nobody is nudged on a day they've already written.
        const { data: entries } = await supabaseAdmin
          .from("journal_entries")
          .select("user_id,entry_date,content")
          .in("user_id", due.map((d) => d.userId))
          .in("entry_date", [...new Set(due.map((d) => d.dateKey))]);
        const wrote = new Set((entries ?? []).filter((e) => e.content.trim()).map((e) => `${e.user_id}|${e.entry_date}`));

        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id,user_id,endpoint,p256dh,auth")
          .in("user_id", due.map((d) => d.userId));

        let sent = 0;
        for (const item of due) {
          // Mark first so an overlapping tick can't send twice.
          const update = item.action === "remind"
            ? { reminder_sent_on: item.dateKey, ...(wrote.has(`${item.userId}|${item.dateKey}`) ? { reminder_missed_sent_on: item.dateKey } : {}) }
            : { reminder_missed_sent_on: item.dateKey };
          await supabaseAdmin.from("app_settings").update(update).eq("user_id", item.userId);
          if (wrote.has(`${item.userId}|${item.dateKey}`)) continue;
          const message = REMINDER_MESSAGES[item.action];
          for (const sub of (subs ?? []).filter((s) => s.user_id === item.userId)) {
            const result = await sendPush(sub, { ...message, url: "/" });
            if (result === "sent") sent++;
            if (result === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
        return Response.json({ sent });
      },
    },
  },
});
