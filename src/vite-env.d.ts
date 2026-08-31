/// <reference types="vite/client" />

// Haru frontend env vars (Vite only exposes VITE_* to the client).
interface ImportMetaEnv {
  /** Deployment market. When set, market locale and semantics are locked. */
  readonly VITE_HARU_MARKET?: "kr" | "jp";
  /** Development-only escape hatch for multilingual UI on a market build. */
  readonly VITE_ALLOW_LANGUAGE_SWITCH?: "0" | "1";
  /** Enables synthetic demo identity and pre-authorized demo fixtures only. */
  readonly VITE_DEMO_MODE?: "0" | "1";
  /** App release identifier attached to privacy-safe telemetry. */
  readonly VITE_APP_VERSION?: string;
  /** Initial UI locale when this origin has no saved preference. */
  readonly VITE_DEFAULT_LOCALE?: "ko" | "ja" | "en";
  /** Korean STT backend base URL. Unset -> the client uses the local default. */
  readonly VITE_STT_API_BASE_URL?: string;
  /** Local Haru memory-graph API. Unset -> http://127.0.0.1:8000. */
  readonly VITE_RAG_API_BASE_URL?: string;
  /** Optional local API bearer token. Read at request time and never persisted. */
  readonly VITE_RAG_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
