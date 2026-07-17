import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pythonName = process.platform === "win32" ? "python.exe" : "python";
const pythonFolder = process.platform === "win32" ? "Scripts" : "bin";
const sttPython = join(repoRoot, "backend", ".venv", pythonFolder, pythonName);
const ragPython = join(repoRoot, "rag_backend", ".venv", pythonFolder, pythonName);
const viteEntry = join(repoRoot, "node_modules", "vite", "bin", "vite.js");

for (const [label, path] of [
  ["STT virtualenv", sttPython],
  ["RAG virtualenv", ragPython],
  ["Vite", viteEntry],
]) {
  if (!existsSync(path)) {
    console.error(`${label} missing: ${path}`);
    console.error("Run npm run stt:install, npm run rag:install, and npm install first.");
    process.exit(2);
  }
}

const configuredRagToken = process.env.RAG_API_TOKEN?.trim();
const configuredViteToken = process.env.VITE_RAG_API_TOKEN?.trim();
if (configuredRagToken && configuredViteToken && configuredRagToken !== configuredViteToken) {
  console.error("RAG_API_TOKEN and VITE_RAG_API_TOKEN must match.");
  process.exit(2);
}
const localToken = configuredRagToken || configuredViteToken || randomBytes(32).toString("hex");
const children = [];
let stopping = false;

function launch(command, args, cwd, env) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.once("error", (error) => {
    console.error(error);
    stopAll(1);
  });
  child.once("exit", (code) => {
    if (!stopping) stopAll(code ?? 1);
  });
}

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exitCode = exitCode;
}

process.once("SIGINT", () => stopAll(0));
process.once("SIGTERM", () => stopAll(0));

launch(
  sttPython,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8765", "--workers", "1"],
  join(repoRoot, "backend"),
  {},
);
launch(
  ragPython,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--workers", "1"],
  join(repoRoot, "rag_backend"),
  { RAG_API_TOKEN: localToken },
);
launch(
  process.execPath,
  [viteEntry, "--host", "127.0.0.1"],
  repoRoot,
  {
    VITE_STT_API_BASE_URL: "http://127.0.0.1:8765",
    VITE_RAG_API_BASE_URL: "http://127.0.0.1:8000",
    VITE_RAG_API_TOKEN: localToken,
  },
);

console.log("Haru local stack starting: app http://127.0.0.1:5173, STT :8765, RAG :8000");
await new Promise((resolveExit) => process.once("beforeExit", resolveExit));
