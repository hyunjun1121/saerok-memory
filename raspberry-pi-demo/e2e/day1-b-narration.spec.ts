import { readFileSync } from "node:fs";

import { expect, test, type Request } from "@playwright/test";

import { isAppHttpRequest } from "./appOrigin";

interface AuditEntry {
  id: string;
  text: string;
  sourcePath: string;
  sourceSha256: string;
  path: string;
  sha256: string;
  resultSide?: "left" | "right";
}

interface Day1Audit {
  choice: "right";
  entryCount: 31;
  entries: AuditEntry[];
}

const audit = JSON.parse(readFileSync(
  new URL("../tools/fish-day1-browser/day1-runtime-import.json", import.meta.url),
  "utf8",
)) as Day1Audit;
const calmAudit = JSON.parse(readFileSync(
  new URL(
    "../tools/fish-day1-browser/calm-mood-candidates/calm-mood-runtime-import.json",
    import.meta.url,
  ),
  "utf8",
)) as { entryCount: 4; entries: AuditEntry[] };
const calmById = new Map(calmAudit.entries.map((entry) => [entry.id, entry]));
const expectedEntries = audit.entries.map((entry) => ({
  ...(calmById.get(entry.id) ?? entry),
  isCalmSelection: calmById.has(entry.id),
}));

test("serves the final 27 B plus 4 selected calm narrations from the Korean build", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (isAppHttpRequest(request.url())) return;
    externalRequests.push(request.url());
  });

  await page.goto("/#/lesson?day=1&restart=1");
  await expect(page.locator('[data-screen="lesson-start"]')).toBeVisible();
  expect(audit.choice).toBe("right");
  expect(audit.entryCount).toBe(31);

  const result = await page.evaluate(async (expectedEntries) => {
    const manifestResponse = await fetch("assets/audio/narration/manifest.json", { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error(`manifest returned ${manifestResponse.status}`);
    const manifest = await manifestResponse.json() as {
      audioOverrides?: {
        entryCount?: number;
        selection?: string;
        provider?: string;
        baseRightEntryCount?: number;
        maintainerSelectedEntryCount?: number;
      };
      entries: Array<{
        id: string;
        locale: string;
        text: string;
        path: string;
        sha256: string;
        origin?: {
          type?: string;
          provider?: string;
          choice?: string;
          sourcePath?: string;
          sourceSha256?: string;
        };
      }>;
    };
    const errors: string[] = [];
    const fetched: Array<{ id: string; status: number; bytes: number; contentType: string | null }> = [];

    if (manifest.audioOverrides?.entryCount !== 31) errors.push("override entryCount");
    if (manifest.audioOverrides?.selection !== "mixed") errors.push("override selection");
    if (manifest.audioOverrides?.provider !== "Fish Audio") errors.push("override provider");
    if (manifest.audioOverrides?.baseRightEntryCount !== 27) errors.push("base-right count");
    if (manifest.audioOverrides?.maintainerSelectedEntryCount !== 4) errors.push("calm count");

    for (const expected of expectedEntries) {
      const entry = manifest.entries.find((candidate) => (
        candidate.locale === "ko" && candidate.id === expected.id
      ));
      if (!entry) {
        errors.push(`missing ${expected.id}`);
        continue;
      }
      if (entry.text !== expected.text) errors.push(`text ${expected.id}`);
      if (entry.path !== expected.path || entry.sha256 !== expected.sha256) {
        errors.push(`runtime artifact ${expected.id}`);
      }
      if (
        entry.origin?.type !== "user-selected-browser-export" ||
        entry.origin.provider !== "Fish Audio" ||
        entry.origin.choice !== (expected.isCalmSelection ? expected.resultSide : "right") ||
        entry.origin.sourcePath !== (expected.isCalmSelection
          ? `tools/fish-day1-browser/calm-mood-candidates/${expected.sourcePath}`
          : `tools/fish-day1-browser/${expected.sourcePath}`) ||
        entry.origin.sourceSha256 !== expected.sourceSha256
      ) {
        errors.push(`origin ${expected.id}`);
      }
      const response = await fetch(entry.path, { cache: "no-store" });
      const bytes = (await response.arrayBuffer()).byteLength;
      fetched.push({
        id: expected.id,
        status: response.status,
        bytes,
        contentType: response.headers.get("content-type"),
      });
    }
    return { errors, fetched };
  }, expectedEntries);

  expect(result.errors).toEqual([]);
  expect(result.fetched).toHaveLength(expectedEntries.length);
  expect(result.fetched.every((entry) => entry.status === 200)).toBe(true);
  expect(result.fetched.every((entry) => entry.bytes > 0)).toBe(true);
  expect(result.fetched.every((entry) => entry.contentType?.startsWith("audio/ogg"))).toBe(true);
  expect(externalRequests).toEqual([]);
});
