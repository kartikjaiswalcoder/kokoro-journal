import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent }; },
  Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING" },
  ThinkingLevel: { MINIMAL: "minimal" },
}));
import { summarizeEntry, summaryLimits, SUMMARY_MODELS } from "@/lib/summary.server";

const longEntry = Array.from({ length: 7 }, () => "I went for a walk today and spent time with my friends.").join("\n");

describe("Gemini journal summaries", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-key");
    generateContent.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses only fast lite Gemini models, without slow thinking, on the user's text", async () => {
    expect(SUMMARY_MODELS.every((m) => m.includes("flash-lite"))).toBe(true);
    generateContent.mockResolvedValue({ text: JSON.stringify({ lines: ["A calm walk."] }) });
    await summarizeEntry("I walked today and felt calm.");
    const call = generateContent.mock.calls[0]?.[0];
    expect(SUMMARY_MODELS).toContain(call.model);
    expect(call.contents).toBe("I walked today and felt calm.");
    expect(call.config.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
  });

  it("switches models between back-to-back requests", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ lines: ["A calm walk."] }) });
    await summarizeEntry("I walked today and felt calm.");
    await summarizeEntry("I walked today and felt calm.");
    const [first, second] = generateContent.mock.calls.map((c) => c[0].model);
    expect(first).not.toBe(second);
  });

  it("starts another model when the first is slow and uses whichever answers first", async () => {
    generateContent.mockImplementationOnce(() => new Promise(() => {}));
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ lines: ["A calm walk."] }) });
    const started = Date.now();
    expect(await summarizeEntry("I walked today and felt calm.")).toEqual({ summary: "A calm walk." });
    expect(Date.now() - started).toBeLessThan(4000);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("recovers when every model is briefly busy on the first try", async () => {
    for (let i = 0; i < SUMMARY_MODELS.length; i++) generateContent.mockRejectedValueOnce(Object.assign(new Error("busy"), { status: 500 }));
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ lines: ["A calm walk."] }) });
    expect(await summarizeEntry("I walked today and felt calm.")).toEqual({ summary: "A calm walk." });
  });

  it("returns only summaries of 2–4 separate lines", async () => {
    for (const count of [1, 2, 3, 4, 5]) {
      generateContent.mockResolvedValue({ text: JSON.stringify({ lines: Array.from({ length: count }, () => "A journal highlight.") }) });
      const result = await summarizeEntry(longEntry);
      if (count >= 2 && count <= 4) expect(result.summary?.split("\n")).toHaveLength(count);
      else expect(result.summary).toBeUndefined();
    }
  });

  it("falls back and still summarizes when the first model fails (regenerate)", async () => {
    generateContent.mockRejectedValueOnce(Object.assign(new Error("timeout"), { status: 504 }));
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ lines: ["Line one.", "Line two."] }) });
    const result = await summarizeEntry(longEntry);
    expect(result.summary).toBe("Line one.\nLine two.");
  });

  it("shows the friendly error when every attempt fails", async () => {
    generateContent.mockRejectedValue(new Error("down"));
    const result = await summarizeEntry("My day.");
    expect(result.error).toBe("Couldn't summarize your entry right now. Please try again.");
  });

  it("condenses 'today was a bad day' to one shorter phrase", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ lines: ["A bad day."] }) });
    expect(await summarizeEntry("today was a bad day")).toEqual({ summary: "A bad day." });
    expect(summaryLimits("today was a bad day").maxLines).toBe(1);
  });

  it("requires fewer summary lines for each entry of 2–5 lines", async () => {
    for (const count of [2, 3, 4, 5]) {
      const entry = Array.from({ length: count }, () => "I walked outside and felt peaceful today.").join("\n");
      expect(summaryLimits(entry).maxLines).toBe(count - 1);
      generateContent.mockResolvedValue({ text: JSON.stringify({ lines: Array.from({ length: count }, () => "A calm walk.") }) });
      expect((await summarizeEntry(entry)).summary).toBeUndefined();
      generateContent.mockResolvedValue({ text: JSON.stringify({ lines: Array.from({ length: count - 1 }, () => "A calm walk.") }) });
      expect((await summarizeEntry(entry)).summary?.split("\n")).toHaveLength(count - 1);
    }
  });

  it("keeps the 2–4 line rule for 6 and 7 line entries, including long paragraphs", () => {
    for (const count of [6, 7]) {
      expect(summaryLimits(Array.from({ length: count }, () => "I walked today.").join("\n"))).toMatchObject({ minLines: 2, maxLines: 4 });
    }
    expect(summaryLimits("A long journal paragraph. ".repeat(25))).toMatchObject({ minLines: 2, maxLines: 4 });
  });

  it("tells the model the selected mood, optionally, without changing the limits", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ lines: ["A calm walk."] }) });
    await summarizeEntry("I walked today and felt calm.", "calm");
    const config = generateContent.mock.calls[0]?.[0]?.config;
    expect(config.systemInstruction).toContain('mood for this entry as "Calm"');
    expect(config.systemInstruction).toContain("only when it fits naturally");
    generateContent.mockResolvedValue({ text: JSON.stringify({ lines: ["A calm walk."] }) });
    await summarizeEntry("I walked today and felt calm.");
    expect(generateContent.mock.calls[1]?.[0]?.config.systemInstruction).not.toContain("marked their mood");
  });

  it("rejects a summary that expands a very short entry", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ lines: ["Today was a really bad and difficult day."] }) });
    expect((await summarizeEntry("today was a bad day")).summary).toBeUndefined();
  });
});
