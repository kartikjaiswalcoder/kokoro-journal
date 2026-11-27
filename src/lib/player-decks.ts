import type { YTNamespace, YTPlayer } from "./youtube";

// Two hidden YouTube players ("decks"). The active deck is the one you hear; the standby deck
// quietly pre-loads the song most likely to play next (muted, then paused once buffered), so
// pressing play, switching moods and skipping can start at once. A switch that isn't buffered
// yet stops the old song immediately and plays the new one as soon as it loads.

type Deck = {
  player: YTPlayer | null;
  videoId: string | null;
  start: number;
  warming: boolean; // muted pre-load in progress; pauses itself once it starts
  buffered: boolean;
  failed: boolean;
  selfPaused: boolean; // the next PAUSED event is our own warm-up pause
};

export type DeckEvents = {
  onReady: () => void;
  onPlayingChange: (playing: boolean) => void;
  onEnded: () => void;
  onError: () => void;
  onStarted: (videoId: string) => void;
};

function emptyDeck(): Deck {
  return { player: null, videoId: null, start: 0, warming: false, buffered: false, failed: false, selfPaused: false };
}

export class DualDeck {
  private decks: [Deck, Deck] = [emptyDeck(), emptyDeck()];
  private active = 0;
  private pendingSwap: number | null = null;
  private swapTimer: ReturnType<typeof setTimeout> | undefined;
  private wantPlay = false;
  private volume = 50;
  private readyCount = 0;
  private PLAYING = 1;
  private PAUSED = 2;
  private ENDED = 0;

  constructor(private events: DeckEvents) {}

  get wantsPlay(): boolean {
    return this.wantPlay;
  }

  mount(YT: YTNamespace, hosts: [HTMLElement, HTMLElement]) {
    this.PLAYING = YT.PlayerState.PLAYING;
    this.PAUSED = YT.PlayerState.PAUSED;
    this.ENDED = YT.PlayerState.ENDED;
    hosts.forEach((host, i) => {
      const player: YTPlayer = new YT.Player(host, {
        height: "1",
        width: "1",
        playerVars: { controls: 0, playsinline: 1, rel: 0, disablekb: 1 },
        events: {
          onReady: () => {
            this.decks[i]!.player = player;
            player.mute();
            this.readyCount += 1;
            if (this.readyCount === 2) this.events.onReady();
          },
          onStateChange: (event) => this.handleState(i, event.data),
          onError: () => this.handleError(i),
        },
      });
    });
  }

  destroy() {
    clearTimeout(this.swapTimer);
    for (const d of this.decks) d.player?.destroy();
    this.decks = [emptyDeck(), emptyDeck()];
  }

  private deck(i: number): Deck {
    return this.decks[i]!;
  }

  private applyAudio(i: number) {
    const d = this.deck(i);
    if (!d.player) return;
    d.player.setVolume(this.volume);
    if (i === this.active && !d.warming) d.player.unMute();
    else d.player.mute();
  }

  private handleState(i: number, state: number) {
    const d = this.deck(i);
    if (state === this.PLAYING) {
      d.buffered = true;
      if (this.pendingSwap === i) {
        d.warming = false;
        this.finishSwap();
        return;
      }
      if (d.warming) {
        d.warming = false;
        if (!(i === this.active && this.wantPlay)) {
          d.selfPaused = true;
          d.player?.pauseVideo();
          return;
        }
        this.applyAudio(i);
      }
      if (i !== this.active) {
        d.player?.pauseVideo();
        return;
      }
      this.wantPlay = true;
      this.events.onPlayingChange(true);
      if (d.videoId) this.events.onStarted(d.videoId);
      return;
    }
    if (state === this.PAUSED && d.selfPaused) {
      d.selfPaused = false;
      return;
    }
    if (i !== this.active) return;
    if (state === this.ENDED) {
      this.events.onEnded();
      return;
    }
    if (state === this.PAUSED) {
      this.wantPlay = false;
      this.events.onPlayingChange(false);
    }
  }

  private handleError(i: number) {
    const d = this.deck(i);
    d.failed = true;
    d.warming = false;
    if (i === this.pendingSwap) {
      clearTimeout(this.swapTimer);
      this.pendingSwap = null;
      this.swapTo(i);
    } else if (i !== this.active) {
      return;
    }
    this.wantPlay = false;
    this.events.onError();
    this.events.onPlayingChange(false);
  }

  // Load a song on the standby deck without making it audible.
  private prepare(videoId: string, start: number): number {
    const s = 1 - this.active;
    const d = this.deck(s);
    if (!d.player) return s;
    if (d.videoId === videoId && !d.failed) {
      if (Math.abs(d.start - start) > 1) {
        d.player.seekTo(start, true);
        d.start = start;
      }
      return s;
    }
    Object.assign(d, { videoId, start, warming: true, buffered: false, failed: false, selfPaused: false });
    d.player.mute();
    d.player.loadVideoById({ videoId, startSeconds: start });
    return s;
  }

  private swapTo(target: number) {
    const old = this.active;
    if (old !== target) {
      const o = this.deck(old);
      o.player?.pauseVideo();
      o.player?.mute();
    }
    this.active = target;
    this.applyAudio(target);
  }

  private finishSwap() {
    const target = this.pendingSwap;
    if (target === null) return;
    clearTimeout(this.swapTimer);
    this.pendingSwap = null;
    const d = this.deck(target);
    d.warming = false;
    this.swapTo(target);
    if (this.wantPlay) {
      d.player?.playVideo();
      this.events.onPlayingChange(true);
      if (d.videoId) this.events.onStarted(d.videoId);
    }
  }

  // Quietly pre-load a song that will probably be asked for soon.
  warm(videoId: string) {
    if (this.pendingSwap !== null) return;
    if (this.deck(this.active).videoId === videoId && !this.deck(this.active).failed) return;
    this.prepare(videoId, 0);
  }

  load(videoId: string, { play, start }: { play: boolean; start?: number | undefined }) {
    const pending = this.pendingSwap;
    if (pending !== null) {
      if (play && this.deck(pending).videoId === videoId) return;
      clearTimeout(this.swapTimer);
      this.pendingSwap = null;
    }
    const cur = this.deck(this.active);
    if (!cur.player) return;
    if (cur.videoId === videoId && !cur.failed) {
      if (start !== undefined) cur.player.seekTo(start, true);
      if (play) this.play();
      else this.pause();
      return;
    }
    const target = this.prepare(videoId, start ?? 0);
    const t = this.deck(target);
    if (!play) {
      this.wantPlay = false;
      this.swapTo(target);
      this.events.onPlayingChange(false);
      return;
    }
    this.wantPlay = true;
    if (t.buffered) {
      t.warming = false;
      this.swapTo(target);
      t.player?.playVideo();
      this.events.onPlayingChange(true);
      return;
    }
    // Not buffered yet: stop the old song right away and start the new one as fast as it loads.
    t.warming = false;
    t.selfPaused = false;
    this.swapTo(target);
    t.player?.playVideo();
    this.events.onPlayingChange(true);
  }

  play() {
    if (this.pendingSwap !== null) {
      this.wantPlay = true;
      return;
    }
    const d = this.deck(this.active);
    if (!d.player || !d.videoId || d.failed) return;
    this.wantPlay = true;
    d.warming = false;
    this.applyAudio(this.active);
    d.player.playVideo();
    this.events.onPlayingChange(true);
  }

  pause() {
    this.wantPlay = false;
    const pending = this.pendingSwap;
    if (pending !== null) {
      clearTimeout(this.swapTimer);
      this.pendingSwap = null;
      // The new song becomes current but waits paused, already loading.
      this.deck(pending).warming = true;
      this.swapTo(pending);
    } else {
      this.deck(this.active).player?.pauseVideo();
    }
    this.events.onPlayingChange(false);
  }

  seek(seconds: number) {
    this.deck(this.active).player?.seekTo(seconds, true);
  }

  setVolume(volume: number) {
    this.volume = volume;
    this.applyAudio(this.active);
  }

  time(): { current: number; duration: number } {
    const d = this.deck(this.pendingSwap ?? this.active);
    if (!d.player) return { current: 0, duration: 0 };
    return { current: d.player.getCurrentTime() || 0, duration: d.player.getDuration() || 0 };
  }
}
