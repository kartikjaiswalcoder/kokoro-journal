import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyPlaylist } from "@/lib/playlists";

const song = { title: "A new song", artist: "Artist", videoId: "abcdefghijk" };
const search = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => search }));
vi.mock("@/lib/playlists.functions", () => ({ searchSongs: vi.fn() }));
import MoodPlaylist from "@/components/MoodPlaylist";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function addSong() {
  fireEvent.change(screen.getByRole("textbox", { name: "Search songs" }), { target: { value: "A new song" } });
  fireEvent.click(await screen.findByRole("button", { name: "Add A new song" }));
}

describe("playlist changes apply only on Play", () => {
  it("adding a song is saved and played only after Save & Play", async () => {
    search.mockResolvedValue({ songs: [song], error: null });
    const onSave = vi.fn(); const onPlay = vi.fn();
    const playlist = { ...emptyPlaylist(), mode: "random" as const, excludeDefaults: true };
    render(<MoodPlaylist mood="calm" playlist={playlist} onSave={onSave} onPlay={onPlay} onClose={vi.fn()} error={null} />);
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    await addSong();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save & Play" }));
    const expected = { ...playlist, songs: [{ ...song, mood: "calm" }] };
    expect(onSave).toHaveBeenCalledExactlyOnceWith(expected);
    expect(onPlay).toHaveBeenCalledExactlyOnceWith(expected);
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
  });

  it("closing without Play discards changes", async () => {
    search.mockResolvedValue({ songs: [song], error: null });
    const onSave = vi.fn(); const onClose = vi.fn();
    const playlist = { ...emptyPlaylist(), songs: [{ ...song, mood: "calm" as const }], mode: "selected" as const, selectedIds: [song.videoId] };
    render(<MoodPlaylist mood="calm" playlist={playlist} onSave={onSave} onPlay={vi.fn()} onClose={onClose} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: `Remove ${song.title}` }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows Play when nothing changed and Save & Play after a change", () => {
    const playlist = { ...emptyPlaylist(), mode: "random" as const };
    render(<MoodPlaylist mood="happy" playlist={playlist} onSave={vi.fn()} onPlay={vi.fn()} onClose={vi.fn()} error={null} />);
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Play in order" }));
    expect(screen.getByRole("button", { name: "Save & Play" })).toBeEnabled();
  });
});
