import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { single, selectRows, update, generate } = vi.hoisted(() => ({ single: vi.fn(), selectRows: vi.fn(), update: vi.fn(), generate: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => generate }));
vi.mock("@/lib/ai-summary.functions", () => ({ generateSummary: {} }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({
    select: () => ({ order: selectRows }),
    update: (payload: unknown) => { update(payload); return { eq: () => ({ select: () => ({ single }) }) }; },
  }) },
}));
import { refreshFromServer, saveAISummary, saveEntry, getEntry } from "@/lib/store";
import Reflections from "@/components/Reflections";
import Notepad from "@/components/Notepad";
import type { JournalEntry } from "@/types";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const savedRow: JournalEntry = { id: "entry-1", entry_date: "2026-10-01", content: "A quiet walk.", mood: null, created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-02T00:00:00Z", ai_summary: "A peaceful walk.", ai_summary_created_at: "2026-10-02T00:00:00Z" };

async function loadRow(row = savedRow) {
  selectRows.mockResolvedValue({ data: [row], error: null });
  await refreshFromServer();
}

describe("Shared saved summaries", () => {
  it("clears a rewritten entry's summary in the saved row and mounted Reflections immediately", async () => {
    await loadRow();
    render(<Reflections onOpen={() => {}} />);
    expect(getEntry(savedRow.entry_date)?.ai_summary).toBe(savedRow.ai_summary);
    const changed = { ...savedRow, content: "A different day at work.", ai_summary: null, ai_summary_created_at: null };
    single.mockResolvedValue({ data: changed, error: null });
    await act(async () => { await saveEntry(savedRow.entry_date, changed.content, null); });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ ai_summary: null, ai_summary_created_at: null }));
    expect(getEntry(savedRow.entry_date)?.ai_summary).toBeNull();
    expect(screen.queryByText(`"${savedRow.ai_summary}"`)).not.toBeInTheDocument();
    single.mockResolvedValue({ data: { ...changed, ai_summary: "A working day." }, error: null });
    await act(async () => { await saveAISummary(savedRow.entry_date, "A working day."); });
    expect(getEntry(savedRow.entry_date)?.ai_summary).toBe("A working day.");
    expect(screen.getByText('"A working day."')).toBeInTheDocument();
  });

  it("shows a saved entry immediately, before the database answers", async () => {
    await loadRow();
    let answer: ((value: unknown) => void) | undefined;
    single.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    const write = saveEntry(savedRow.entry_date, "Instant words.", null);
    expect(getEntry(savedRow.entry_date)?.content).toBe("Instant words.");
    await waitFor(() => expect(answer).toBeDefined());
    answer?.({ data: { ...savedRow, content: "Instant words.", ai_summary: null }, error: null });
    await write;
    expect(getEntry(savedRow.entry_date)?.content).toBe("Instant words.");
    single.mockReset();
  });

  it("keeps the summary when saved text is unchanged", async () => {
    await loadRow();
    single.mockResolvedValue({ data: savedRow, error: null });
    await saveEntry(savedRow.entry_date, savedRow.content, null);
    expect(update.mock.calls[0]?.[0]).not.toHaveProperty("ai_summary");
    expect(getEntry(savedRow.entry_date)?.ai_summary).toBe(savedRow.ai_summary);
  });

  it("clears the summary when only the mood changes", async () => {
    await loadRow();
    const changed = { ...savedRow, mood: "calm" as const, ai_summary: null, ai_summary_created_at: null };
    single.mockResolvedValue({ data: changed, error: null });
    await saveEntry(savedRow.entry_date, savedRow.content, "calm");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ ai_summary: null, ai_summary_created_at: null }));
    expect(getEntry(savedRow.entry_date)?.ai_summary).toBeNull();
  });

  it("sends the notepad mood and prevents duplicate rapid summary requests", async () => {
    await loadRow({ ...savedRow, ai_summary: null, ai_summary_created_at: null });
    let finish: ((value: { summary: string }) => void) | undefined;
    generate.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    single.mockResolvedValue({ data: { ...savedRow, ai_summary: "Quiet outdoors." }, error: null });
    render(<Notepad dateKey={savedRow.entry_date} onClose={() => {}} />);
    fireEvent.click(screen.getByTitle("Calm"));
    const summaryButton = screen.getByRole("button", { name: "AI Summary" });
    fireEvent.click(summaryButton);
    fireEvent.click(summaryButton);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith({ data: { entry: savedRow.content, mood: "calm" } });
    await act(async () => { finish?.({ summary: "Quiet outdoors." }); });
    // Mood isn't saved yet, so the summary stays pending until Save.
    expect(getEntry(savedRow.entry_date)?.ai_summary).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(getEntry(savedRow.entry_date)?.ai_summary).toBe("Quiet outdoors."));
  });

  it("saving edited text does not restore the notepad's remembered old summary", async () => {
    await loadRow();
    const changed = { ...savedRow, content: "New text for this day.", ai_summary: null, ai_summary_created_at: null };
    single.mockResolvedValue({ data: changed, error: null });
    const view = render(<Notepad dateKey={savedRow.entry_date} onClose={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: changed.content } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(getEntry(savedRow.entry_date)?.ai_summary).toBeNull());
    view.unmount();
    generate.mockResolvedValue({ error: "Temporary failure" });
    render(<Notepad dateKey={savedRow.entry_date} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "AI Summary" }));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("A peaceful walk.")).not.toBeInTheDocument();
  });

  it("updates an already-open Reflections list and the notepad's stored summary without reload", async () => {
    const row = { id: "entry-1", entry_date: "2026-10-01", content: "A quiet walk.", mood: null, created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-02T00:00:00Z", ai_summary: "A peaceful walk.", ai_summary_created_at: "2026-10-02T00:00:00Z" };
    selectRows.mockResolvedValue({ data: [row], error: null });
    await refreshFromServer();
    render(<Reflections onOpen={() => {}} />);
    for (const summary of ["A calm outing.", "Quiet time outdoors."]) {
      single.mockResolvedValue({ data: { ...row, ai_summary: summary }, error: null });
      await act(async () => { await saveAISummary(row.entry_date, summary); });
      await waitFor(() => expect(screen.getByText(`"${summary}"`)).toBeInTheDocument());
      expect(getEntry(row.entry_date)?.ai_summary).toBe(summary);
      expect(screen.queryByText('"A peaceful walk."')).not.toBeInTheDocument();
    }
  });
  it("treats a regenerated summary as an unsaved change that is stored only on Save", async () => {
    await loadRow();
    generate.mockResolvedValue({ summary: "A fresh look at the walk." });
    single.mockResolvedValue({ data: { ...savedRow, ai_summary: "A fresh look at the walk." }, error: null });
    render(<Notepad dateKey={savedRow.entry_date} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "AI Summary" }));
    fireEvent.click(await screen.findByRole("button", { name: "Regenerate" }));
    await screen.findByText("A fresh look at the walk.");
    expect(getEntry(savedRow.entry_date)?.ai_summary).toBe(savedRow.ai_summary);
    expect(update).not.toHaveBeenCalled();
    const save = await screen.findByRole("button", { name: "Save" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(getEntry(savedRow.entry_date)?.ai_summary).toBe("A fresh look at the walk."));
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
  });

  it("opens the saved summary together with the notepad when started from Reflections", async () => {
    await loadRow();
    render(<Notepad dateKey={savedRow.entry_date} startWithSummary onClose={() => {}} />);
    expect(screen.getByText("A peaceful walk.")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue(savedRow.content);
    expect(generate).not.toHaveBeenCalled();
  });
});