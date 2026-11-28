import { useEffect, useReducer } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET, photosToAdd } from "./photo-rules";
import { getAllEntries, subscribe as subscribeStore } from "./store";

const MAX_SIDE = 1400;
const QUALITY = 0.82;

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, QUALITY));
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

// Shrink to a light web image (max 1400px side, WebP, JPEG fallback) before upload.
export async function compressImage(file: File): Promise<Blob> {
  const img = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
    let blob = await canvasToBlob(canvas, "image/webp");
    if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg");
    if (!blob) throw new Error("Could not compress image");
    return blob;
  } finally {
    img.done();
  }
}

// ---- Signed URL cache (private bucket), batched across all mounted views ----
// Signed links last a week and are kept on this device, so the same link is reused across
// visits and the browser serves the photo straight from its own cache (files are stored with a
// one-year cache lifetime). Image bytes are also pre-downloaded as soon as a link is known, so
// thumbnails in the notepad, All Entries and Reflections paint immediately.
const STORE_KEY = "kokoro_photo_urls_v2";
const LINK_SECONDS = 7 * 24 * 3600;
const REFRESH_BEFORE_MS = 24 * 3600 * 1000; // renew a link once it has less than a day left
const urlCache = new Map<string, { url: string; exp: number }>(loadStoredUrls());

function loadStoredUrls(): [string, { url: string; exp: number }][] {
  try {
    if (typeof localStorage === "undefined") return [];
    try {
      sessionStorage.removeItem("kokoro_photo_urls_v1");
    } catch {
      // ignore
    }
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const now = Date.now();
    return (JSON.parse(raw) as [string, { url: string; exp: number }][]).filter(([, v]) => v.exp > now);
  } catch {
    return [];
  }
}

function saveStoredUrls() {
  try {
    // Local preview links (blob:) only live in this page, so they are never stored.
    const rows = [...urlCache].filter(([, v]) => Number.isFinite(v.exp) && v.url.startsWith("http"));
    localStorage.setItem(STORE_KEY, JSON.stringify(rows));
  } catch {
    // ignore quota errors
  }
}

// Keeps a decoded copy of every known photo so mounting an <img> never waits on the network.
const warmed = new Map<string, HTMLImageElement>();
function warmImage(url: string) {
  if (typeof Image === "undefined" || warmed.has(url)) return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  img.decode?.().catch(() => {});
  warmed.set(url, img);
}

const inflight = new Set<string>();
const queue = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function freshUrl(path: string): string | undefined {
  const hit = urlCache.get(path);
  return hit && hit.exp > Date.now() ? hit.url : undefined;
}

function needsLink(path: string): boolean {
  const hit = urlCache.get(path);
  return !hit || hit.exp - Date.now() < REFRESH_BEFORE_MS;
}

export function rememberPhotoUrl(path: string, url: string) {
  urlCache.set(path, { url, exp: Number.POSITIVE_INFINITY });
  listeners.forEach((fn) => fn());
}

async function flush() {
  timer = null;
  const batch = [...queue];
  queue.clear();
  if (batch.length === 0) return;
  batch.forEach((p) => inflight.add(p));
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return; // retried on sign-in
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(batch, LINK_SECONDS);
    data?.forEach((d, i) => {
      const path = batch[i];
      if (!path || !d.signedUrl) return;
      // Links renew about a day before they expire, so a refresh never leaves a photo blank.
      urlCache.set(path, { url: d.signedUrl, exp: Date.now() + LINK_SECONDS * 1000 - 60 * 60 * 1000 });
      warmImage(d.signedUrl);
    });
    saveStoredUrls();
  } catch (e) {
    console.error(e);
  } finally {
    batch.forEach((p) => inflight.delete(p));
    listeners.forEach((fn) => fn());
  }
}

function request(paths: string[]) {
  for (const p of paths) {
    const url = freshUrl(p);
    if (url) warmImage(url);
    if (needsLink(p) && !inflight.has(p)) queue.add(p);
  }
  if (queue.size > 0 && !timer) timer = setTimeout(() => void flush(), 0);
}

// Fetch links for every saved photo as soon as entries are known, so thumbnails in the
// notepad, All Entries and Reflections are ready before they are shown.
function prefetchAllEntryPhotos() {
  const paths = getAllEntries().flatMap((e) => e.photos ?? []);
  if (paths.length) request(paths);
}

if (typeof window !== "undefined") {
  prefetchAllEntryPhotos();
  subscribeStore(prefetchAllEntryPhotos);
  // Links can only be made once signed in, so retry as soon as the session is known.
  supabase.auth.onAuthStateChange((event) => {
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      setTimeout(prefetchAllEntryPhotos, 0);
    }
  });
}

export function usePhotoUrls(paths: string[]): (string | undefined)[] {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const key = paths.join("|");
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  useEffect(() => {
    if (paths.length) request(paths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return paths.map((p) => freshUrl(p));
}

// ---- Upload / delete ----
// Photos are part of the notepad's draft: uploading only stores the files, and the day keeps
// them once the user presses Save. Returns the new storage paths (never more than fit).
export async function uploadDayPhotos(dateKey: string, currentCount: number, files: File[]): Promise<string[]> {
  const picked = photosToAdd(currentCount, files);
  if (picked.length === 0) return [];
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error("Not signed in");
  const stamp = Date.now();
  const results = await Promise.allSettled(
    picked.map(async (file, i) => {
      const blob = await compressImage(file);
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${uid}/${dateKey}/${stamp}_${currentCount + i}.${ext}`;
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
      if (error) throw error;
      rememberPhotoUrl(path, URL.createObjectURL(blob));
      return path;
    }),
  );
  const paths = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (paths.length === 0) {
    const first = results.find((r) => r.status === "rejected");
    throw first && first.status === "rejected" ? first.reason : new Error("Upload failed");
  }
  return paths;
}

// Removes stored photo files (unsaved uploads, or photos taken off a saved day).
export function deletePhotoFiles(paths: string[]): void {
  if (paths.length === 0) return;
  void supabase.storage.from(PHOTO_BUCKET).remove(paths).catch((e) => console.error(e));
}
