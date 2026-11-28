<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Kokoro journal data (journal_entries, app_settings, profiles) is per-user, enforced by RLS on user_id/id = auth.uid(); the home route is client-only and shows sign-in until a session exists.
- Calendar owns date-key navigation; its parent enables it only on the journal with no open popup, keeping keyboard input isolated from other views and editors.
- Journal summaries call Gemini with the official Google SDK in a server-only helper using the GEMINI_API_KEY secret, with a fast-model fallback on timeout; authenticated RPC protects the key.
- Summary length limits are computed and validated in the server helper, including estimated lines for unbroken paragraphs, so brevity does not depend on device width.
- Journal store subscriptions expose an incrementing snapshot version; derived entry lists depend on it so saved summaries update every mounted view.
- Saving changed journal text clears its summary and summary timestamp in the same write so Reflections stops displaying that date until a new summary is saved.
- Notepad summary requests use an in-flight guard and discard results for changed text to avoid duplicate calls and outdated summary writes.
- Mood playlists persist per user through authenticated server functions and RLS; immutable bundled defaults precede sortable custom songs so defaults cannot be removed or reordered.
- Playlist queue rules live in a browser-safe pure module; YouTube search uses an authenticated server function calling the YouTube Data API with the YOUTUBE_API_KEY secret, keeping the key private.
- Custom song rows use invisible dnd-kit mouse, delayed-touch, and keyboard drag targets; selection timers cancel when dragging starts to preserve long-press selection without visible handles.
- Player title overflow is measured in a dedicated browser-safe component and animated only when overflowing, with reduced-motion support, so song text cannot widen the player.
- Ambient theming re-points the sakura color tokens per mood via [data-mood-theme] (set on <html> by the player, and on each playlist dialog); fixed blossom tokens keep Happy entry colors stable, and registered @property tokens give the fade.
- Music player activation colors are color-mix amounts driven by registered percentage properties, never swapped color classes with color transitions, because those restart every frame while sakura tokens fade.
- The playlist dialog edits a local draft; only Play ("Save & Play" when changed) persists and applies it, so closing discards edits; selection rules live in toggleSelection.
- Mood chip double-clicks are detected on the whole chip row (chips resize on select) and deselection is delayed briefly so a double click never closes the player.

- Music plays through two hidden YouTube decks (src/lib/player-decks.ts): the standby deck pre-buffers the likely next song muted so buffered starts are instant; an unbuffered switch stops the old song at once (never keeps it playing while the new one loads).
- Journal saves are optimistic: the store updates its cache first and serializes per-day database writes, reverting on failure, so Save never waits on the network.
- Reminder invite frequency and dismissal live in pure rules (reminder-schedule) plus per-user localStorage keys and the account record; turning reminders off counts as a permanent dismissal for that account.
- Journal photos live in the private journal-photos bucket under {userId}/{date}/, compressed in the browser first; entries store object paths in photos (limit in photo-rules) and views read them through cached, batched signed URLs (src/lib/photos.ts). Notepad photos are a draft saved with the entry by saveEntry; unsaved uploads are deleted on close and removed saved files only after a successful save.
- The notepad root carries data-mood-theme for the day's mood with .mood-scope (fade) and briefly .mood-shifting (pauses inner color transitions); with no mood picked it sets none and inherits the player-driven <html> theme.
- A generated or regenerated AI summary is an unsaved notepad change (enables Save); it is written only when Save is tapped, so closing without saving keeps the stored summary.
- Opening a day from Reflections passes startWithSummary so the notepad and its saved summary popup mount in the same render.
- The per-device notification invite uses shouldOfferDevicePrompt (reminder-schedule) with a per-account, per-device localStorage dismissal; it only shows where permission is still 'default'.
- Photo signed URLs (7-day) are prefetched for every cached entry when src/lib/photos.ts loads and on each store change, persisted in localStorage so links (and the browser image cache) are reused across visits, and each image is pre-decoded once its link is known; sign-out clears the stored links.
- Entry sort orders live in the pure entry-sort module; each list saves its sort per device in localStorage (never auto-reset) while the mood filter stays component state that resets on tab switch, shown as two separate pills because they persist differently.
