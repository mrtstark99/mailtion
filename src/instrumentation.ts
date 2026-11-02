// Runs once when the Next.js server starts.
// Asks the Cloudflare buffer Worker to push back any email it held while Mailtion was down.
// The cron trigger on the Worker does the same within a minute; this just makes it immediate.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const syncUrl = process.env.MAIL_BUFFER_SYNC_URL;
  if (!syncUrl) return;

  // Wait until the server is listening: the Worker delivers through the public webhook
  setTimeout(async () => {
    try {
      // Same secret the webhook route checks (Settings first, then env)
      const { getSettings } = await import("./lib/mail-service");
      const secret = getSettings()["webhook_secret"] || process.env.WEBHOOK_SECRET;
      if (!secret) return;

      const res = await fetch(syncUrl, {
        method: "POST",
        headers: { "x-webhook-secret": secret },
        signal: AbortSignal.timeout(60_000),
      });
      console.log(`[mail-buffer] sync ${res.status}: ${await res.text()}`);
    } catch (err) {
      console.error("[mail-buffer] sync failed:", err);
    }
  }, 10_000);
}
