import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [serviceName, action, ...extraArgs] = process.argv.slice(2);
const services = {
  stt: {
    root: join(repoRoot, "backend"),
    port: "8765",
    requirements: ["requirements.txt"],
  },
  rag: {
    root: join(repoRoot, "rag_backend"),
    port: "8000",
    requirements: ["requirements.txt", "requirements-models.txt"],
  },
};

const service = services[serviceName];
if (!service || !action) {
  console.error("usage: node scripts/run-python-service.mjs <stt|rag> <install|download|dev|test|smoke|bootstrap>");
  process.exit(2);
}

const venvPython = join(
  service.root,
  ".venv",
  process.platform === "win32" ? "Scripts" : "bin",
  process.platform === "win32" ? "python.exe" : "python",
);

function runSync(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function run(command, args, cwd = repoRoot) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  const stop = () => child.kill("SIGTERM");
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const code = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (exitCode) => resolveExit(exitCode ?? 1));
  });
  process.exitCode = code;
}

if (action === "install") {
  if (!existsSync(venvPython)) {
    const systemPython = process.env.PYTHON?.trim() || (process.platform === "win32" ? "python" : "python3");
    runSync(systemPython, ["-m", "venv", join(service.root, ".venv")]);
  }
  runSync(venvPython, ["-m", "pip", "install", "--upgrade", "pip"]);
  runSync(
    venvPython,
    ["-m", "pip", "install", ...service.requirements.flatMap((file) => ["-r", file])],
    service.root,
  );
  process.exit(0);
}

if (!existsSync(venvPython)) {
  console.error(`${serviceName} virtualenv missing. Run npm run ${serviceName}:install first.`);
  process.exit(2);
}

if (action === "download") {
  await run(venvPython, [join("scripts", "download_models.py")], service.root);
} else if (action === "dev") {
  await run(
    venvPython,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", service.port, "--workers", "1"],
    service.root,
  );
} else if (action === "test") {
  await run(venvPython, ["-m", "pytest", "tests", ...extraArgs], service.root);
} else if (action === "smoke" && serviceName === "stt") {
  await run(venvPython, [join("scripts", "smoke.py"), ...extraArgs], service.root);
} else if (action === "bootstrap" && serviceName === "rag") {
  await run(venvPython, [join("scripts", "bootstrap.py"), ...extraArgs], service.root);
} else {
  console.error(`unsupported action: ${serviceName}:${action}`);
  process.exit(2);
}
