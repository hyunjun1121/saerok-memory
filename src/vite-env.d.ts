/// <reference types="vite/client" />

// Haru frontend env vars (Vite only exposes VITE_* to the client).
interface ImportMetaEnv {
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
