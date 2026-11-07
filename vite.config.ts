import { existsSync, readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Vite configuration.
 *
 * Local development (laptop):
 *  - HTTPS using a mkcert "localhost" certificate from ./certs (git-ignored).
 *  - Optional dev-only proxy of /sip to FreeSWITCH's plain WS listener, enabled only when
 *    DEV_SIP_WS_UPSTREAM is set in .env.local. SECURITY-SENSITIVE: that hop travels
 *    unencrypted over the LAN. Production uses server/server.mjs on the FreeSWITCH host,
 *    where the WS hop never leaves the machine.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const certFile = env.DEV_TLS_CERT || 'certs/localhost.pem';
  const keyFile = env.DEV_TLS_KEY || 'certs/localhost-key.pem';
  const haveCert = existsSync(certFile) && existsSync(keyFile);
  const upstream = env.DEV_SIP_WS_UPSTREAM;

  return {
    server: {
      port: 5173,
      strictPort: true,
      host: 'localhost',
      https: haveCert ? { cert: readFileSync(certFile), key: readFileSync(keyFile) } : undefined,
      proxy: upstream
        ? {
            '/sip': {
              target: upstream,
              ws: true,
              changeOrigin: true,
              rewrite: () => '/',
            },
          }
        : undefined,
    },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.test.ts'],
      pool: 'vmThreads',
    },
  };
});
