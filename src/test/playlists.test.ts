import { describe, expect, it } from "vitest";
import { defaultSongs, emptyPlaylist, excludeDefaults, nextSong, playbackQueue, playlistSongs, selectSong, type Playlist } from "@/lib/playlists";
const one = { mood: "happy" as const, title: "One", artist: "Artist", videoId: "abcdefghijk" };
const two = { ...one, title: "Two", videoId: "lmnopqrstuv" };
describe("mood playlists", () => {
  it("keeps default It's You above custom songs regardless of custom order", () => {
    expect(playlistSongs("happy", { ...emptyPlaylist(), songs: [two, one] }).map((s) => s.title)).toEqual(["It's You", "Two", "One"]);
  });
  it("a single selected song is the only looping track", () => {
    const list = selectSong({ ...emptyPlaylist(), songs: [one, two] }, one.videoId, false);
    const queue = playbackQueue("happy", list);
    expect(queue).toEqual([one]);
    expect(nextSong(queue, one.videoId, 1, false)).toEqual(one);
  });
  it("multi-selection plays in the order selected, not arranged", () => {
    let list: Playlist = { ...emptyPlaylist(), songs: [one, two] };
    list = selectSong(list, two.videoId, true); list = selectSong(list, one.videoId, true);
    expect(playbackQueue("happy", list)).toEqual([two, one]);
  });
  it("ordered mode loops the arranged list with defaults first", () => {
    const queue = playbackQueue("happy", { ...emptyPlaylist(), mode: "ordered", songs: [two, one] });
    expect(queue.map((s) => s.title)).toEqual(["It's You", "Two", "One"]);
    expect(nextSong(queue, one.videoId, 1, false)).toEqual(defaultSongs("happy")[0]);
    expect(nextSong(queue, two.videoId, -1, false)).toEqual(defaultSongs("happy")[0]);
  });
  it("exclusion removes defaults from selection and both whole-list modes", () => {
    const id = "-aXiIcxrVWQ";
    const list = excludeDefaults("happy", { ...emptyPlaylist(), songs: [one], selectedIds: [id, one.videoId] }, true);
    expect(list.selectedIds).toEqual([one.videoId]);
    expect(playbackQueue("happy", { ...list, mode: "ordered" })).toEqual([one]);
    expect(playbackQueue("happy", { ...list, mode: "random" })).toEqual([one]);
  });
  it("random skips the current song when other songs exist", () => {
    expect(nextSong([one, two], one.videoId, 1, true, () => 0)).toEqual(two);
  });
  it("empty eligible playlists do not play anything", () => {
    expect(playbackQueue("happy", { ...emptyPlaylist(), excludeDefaults: true })).toEqual([]);
  });
});
import { samePlaylist, toggleSelection, removeSong } from "@/lib/playlists";
const three = { ...one, title: "Three", videoId: "wxyzabcdefg" };
describe("song selection rules", () => {
  const base: Playlist = { ...emptyPlaylist(), songs: [one, two, three] };
  it("a second plain click deselects a single selected song", () => {
    const first = toggleSelection(base, one.videoId, false, false);
    expect(first.playlist.selectedIds).toEqual([one.videoId]);
    expect(first.ordering).toBe(false);
    expect(toggleSelection(first.playlist, one.videoId, false, false).playlist.selectedIds).toEqual([]);
  });
  it("removing a song from an order re-counts the rest", () => {
    let r = toggleSelection(base, one.videoId, false, true);
    r = toggleSelection(r.playlist, two.videoId, r.ordering, true);
    r = toggleSelection(r.playlist, three.videoId, r.ordering, false);
    expect(r.playlist.selectedIds).toEqual([one.videoId, two.videoId, three.videoId]);
    r = toggleSelection(r.playlist, one.videoId, r.ordering, false);
    expect(r.playlist.selectedIds).toEqual([two.videoId, three.videoId]);
    expect(r.ordering).toBe(true);
  });
  it("deselecting every song ends the order so a plain click picks one song", () => {
    let r = toggleSelection(base, one.videoId, false, true);
    expect(r.ordering).toBe(true);
    r = toggleSelection(r.playlist, one.videoId, r.ordering, false);
    expect(r.ordering).toBe(false);
    r = toggleSelection(r.playlist, two.videoId, r.ordering, false);
    expect(r).toEqual({ playlist: { ...base, mode: "selected", selectedIds: [two.videoId] }, ordering: false });
  });
  it("removing the only selected song leaves nothing to play", () => {
    const list = removeSong({ ...base, mode: "selected", selectedIds: [two.videoId] }, two.videoId);
    expect(playbackQueue("happy", list)).toEqual([]);
  });
  it("detects whether a draft differs from the saved playlist", () => {
    expect(samePlaylist(base, { ...base })).toBe(true);
    expect(samePlaylist(base, { ...base, songs: [two, one, three] })).toBe(false);
    expect(samePlaylist(base, { ...base, excludeDefaults: true })).toBe(false);
  });
});
