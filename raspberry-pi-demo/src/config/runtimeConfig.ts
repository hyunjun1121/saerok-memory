import { parseFourButtonConfig, type RawFourButtonConfig } from "@/features/input";

interface RuntimeConfigDocument {
  readonly input?: RawFourButtonConfig;
}

export type RuntimeInputConfigResult =
  | { readonly status: "ready"; readonly config: RawFourButtonConfig }
  | { readonly status: "error"; readonly reason: "missing" | "invalid" };

export async function loadRuntimeInputConfig(
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<RuntimeInputConfigResult> {
  let response: Response;
  try {
    response = await fetcher("config/runtime.json", { cache: "no-store" });
  } catch {
    return { status: "error", reason: "missing" };
  }
  if (!response.ok) return { status: "error", reason: "missing" };
  try {
    const payload = await response.json() as RuntimeConfigDocument;
    if (!payload || typeof payload !== "object" || !payload.input) {
      return { status: "error", reason: "invalid" };
    }
    parseFourButtonConfig(payload.input);
    return { status: "ready", config: payload.input };
  } catch {
    return { status: "error", reason: "invalid" };
  }
}
