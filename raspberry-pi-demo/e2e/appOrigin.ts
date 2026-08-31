const DEFAULT_BASE_URL = "http://127.0.0.1:4173";

export const APP_ORIGIN = new URL(
  process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL,
).origin;

export function isAppHttpRequest(urlValue: string): boolean {
  const url = new URL(urlValue);
  return (url.protocol === "http:" || url.protocol === "https:") && url.origin === APP_ORIGIN;
}

export function isAppAudioAsset(urlValue: string): boolean {
  const url = new URL(urlValue);
  return isAppHttpRequest(urlValue) && /\.(?:ogg|mp3|wav)$/i.test(url.pathname);
}
