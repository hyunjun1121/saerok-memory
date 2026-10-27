const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) {
  process.stderr.write(`Haru pilot requires Node.js 24.x (current: ${process.versions.node}). Install Node.js 24, reopen the terminal, and run npm ci --include=dev --include=optional.\n`);
  process.exit(1);
}
try {
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(':memory:');
  database.prepare('SELECT 1').get();
  database.close();
  process.stdout.write(`Haru pilot runtime OK: Node.js ${process.versions.node}, built-in SQLite available.\n`);
} catch {
  process.stderr.write('Haru pilot could not open built-in SQLite. Reinstall Node.js 24.x without --no-experimental-sqlite.\n');
  process.exit(1);
}
