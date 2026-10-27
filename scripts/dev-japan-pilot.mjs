import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, preview } from 'vite';
import { createPilotLocalStore, createPilotMiddleware } from './pilot-local-store.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 5188;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid localhost port.');
const store = createPilotLocalStore(process.env.HARU_PILOT_DATA_DIR || path.join(root, 'local-data', 'japan-pilot'));
const middleware = createPilotMiddleware(store);
const plugin = { name: 'haru-local-pilot-collection',
  configureServer(server) { server.middlewares.use(middleware); },
  configurePreviewServer(server) { server.middlewares.use(middleware); },
};
const options = { root, mode: 'japan-pilot', plugins: [plugin],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false,
    watch: { ignored: ['**/local-data/**', `${store.root.replaceAll('\\', '/')}/**`] },
    fs: { deny: ['.env', '.env.*', '**/*.{crt,pem}', '**/.git/**', '**/local-data/**', `${store.root.replaceAll('\\', '/')}/**`] } },
  preview: { host: '127.0.0.1', port, strictPort: true },
};
try {
  const server = args.includes('--preview') ? await preview(options) : await createServer(options);
  if (!args.includes('--preview')) await server.listen();
  process.stdout.write(`Haru pilot: http://127.0.0.1:${port}/pilot\nLocal data: ${store.root}\n`);
  const stop = async () => { await (server.close?.() ?? new Promise(resolve => server.httpServer.close(resolve))); store.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch (error) { store.close(); throw error; }
