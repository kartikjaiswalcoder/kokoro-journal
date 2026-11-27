import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Calendar from "@/components/Calendar";

vi.mock("@/lib/useStore", () => ({ useStore: () => 0 }));
vi.mock("@/lib/store", () => ({ getEntryDates: () => new Set(), getEntry: () => undefined }));
vi.mock("@/lib/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dates")>();
  return { ...actual, todayKey: () => "2026-11-03" };
});
afterEach(cleanup);

function mount(keyboardEnabled = true, month0 = 10, selectedKey = "2026-11-03") {
  const onSelect = vi.fn();
  render(<Calendar year={2026} month0={month0} selectedKey={selectedKey}
    onPrev={() => {}} onNext={() => {}} onToday={() => {}}
    onOpen={() => {}} onSelect={onSelect} keyboardEnabled={keyboardEnabled} />);
  return onSelect;
}

test.each([
  ["ArrowLeft", "2026-11-02"], ["a", "2026-11-02"],
  ["ArrowRight", "2026-11-04"], ["d", "2026-11-04"],
  ["ArrowDown", "2026-11-10"], ["s", "2026-11-10"],
])("%s moves to %s", (key, expected) => {
  const onSelect = mount();
  fireEvent.keyDown(document.body, { key });
  expect(onSelect).toHaveBeenCalledWith(expected);
});

test("keys never leave the open month at its edges", () => {
  const first = mount(true, 10, "2026-11-01");
  fireEvent.keyDown(document.body, { key: "a" });
  expect(first).toHaveBeenCalledWith("2026-11-01");
  cleanup();
  const last = mount(true, 10, "2026-11-30");
  fireEvent.keyDown(document.body, { key: "d" });
  expect(last).toHaveBeenCalledWith("2026-11-30");
});

test("a weekly move that would cross the month stays put", () => {
  const onSelect = mount(true, 10, "2026-11-03");
  fireEvent.keyDown(document.body, { key: "w" });
  expect(onSelect).toHaveBeenCalledWith("2026-11-03");
});

test("keys restore navigation after the selection was hidden", () => {
  const onSelect = mount();
  fireEvent.pointerDown(document.body);
  expect(screen.getByRole("button", { name: "2026-11-03" }).getAttribute("aria-pressed")).toBe("false");
  fireEvent.keyDown(document.body, { key: "d" });
  expect(onSelect).toHaveBeenCalledWith("2026-11-03");
  expect(screen.getByRole("button", { name: "2026-11-03" }).getAttribute("aria-pressed")).toBe("true");
});

test("a hidden selection spawns on today in the current month without moving", () => {
  const onSelect = mount(true, 10, "2026-11-20");
  fireEvent.pointerDown(document.body);
  fireEvent.keyDown(document.body, { key: "d" });
  expect(onSelect).toHaveBeenCalledWith("2026-11-03");
});

test("a hidden selection spawns on the month's first day in another month", () => {
  const onSelect = mount(true, 11, "2026-11-20");
  fireEvent.pointerDown(document.body);
  fireEvent.keyDown(document.body, { key: "d" });
  expect(onSelect).toHaveBeenCalledWith("2026-12-01");
});

test("a second press moves the spawned selector", () => {
  const onSelect = vi.fn();
  const props = { onPrev: () => {}, onNext: () => {}, onToday: () => {}, onOpen: () => {} };
  const { rerender } = render(<Calendar year={2026} month0={11} selectedKey="2026-11-20"
    {...props} onSelect={onSelect} keyboardEnabled={true} />);
  fireEvent.keyDown(document.body, { key: "d" });
  expect(onSelect).toHaveBeenCalledWith("2026-12-01");
  // The parent applies the selection before the next press.
  rerender(<Calendar year={2026} month0={11} selectedKey="2026-12-01"
    {...props} onSelect={onSelect} keyboardEnabled={true} />);
  fireEvent.keyDown(document.body, { key: "d" });
  expect(onSelect).toHaveBeenLastCalledWith("2026-12-02");
});

test("a visible selection still resumes from the selected date", () => {
  const onSelect = mount(true, 10, "2026-11-20");
  fireEvent.keyDown(document.body, { key: "d" });
  expect(onSelect).toHaveBeenCalledWith("2026-11-21");
});

test("enter opens the notepad of the date the selector is on", () => {
  const onOpen = vi.fn();
  render(<Calendar year={2026} month0={10} selectedKey="2026-11-03"
    onPrev={() => {}} onNext={() => {}} onToday={() => {}}
    onOpen={onOpen} onSelect={() => {}} keyboardEnabled={true} />);
  fireEvent.keyDown(document.body, { key: "Enter" });
  expect(onOpen).toHaveBeenCalledWith("2026-11-03");
  cleanup();
  const hiddenOpen = vi.fn();
  render(<Calendar year={2026} month0={10} selectedKey="2026-11-03"
    onPrev={() => {}} onNext={() => {}} onToday={() => {}}
    onOpen={hiddenOpen} onSelect={() => {}} keyboardEnabled={true} />);
  fireEvent.pointerDown(document.body);
  fireEvent.keyDown(document.body, { key: "Enter" });
  expect(hiddenOpen).not.toHaveBeenCalled();
});

test("typing and inactive journal views do not move dates", () => {
  const onSelect = mount();
  const input = document.createElement("textarea");
  document.body.append(input);
  fireEvent.keyDown(input, { key: "w" });
  expect(onSelect).not.toHaveBeenCalled();
  input.remove();
  cleanup();
  const inactiveSelect = mount(false);
  fireEvent.keyDown(document.body, { key: "ArrowRight" });
  expect(inactiveSelect).not.toHaveBeenCalled();
});
