// @trace NFR-12
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The image and server config the Compose stack runs (backend/compose.yaml, decision D-P1).
 * Behaviour is also checked live by the compose smoke (curl -I); these guard the files themselves.
 */
const nginx = readFileSync('nginx.conf', 'utf8');
const dockerfile = readFileSync('Dockerfile', 'utf8');
const json = (f: string) => JSON.parse(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));

/** Body of the first `location <path> { ... }` block (no nested blocks in this config). */
const location = (path: string) => new RegExp(`location ${path.replace(/\//g, '\\/')} \\{([^}]*)\\}`).exec(nginx)?.[1] ?? '';

describe('nginx.conf', () => {
  it('hides its version and sends security headers on every response', () => {
    expect(nginx).toMatch(/^\s*server_tokens off;/m);
    expect(nginx).toMatch(/add_header X-Content-Type-Options "?nosniff"? always;/);
    expect(nginx).toMatch(/add_header Referrer-Policy "?no-referrer"? always;/);
    const csp = /add_header Content-Security-Policy "([^"]+)" always;/.exec(nginx)?.[1] ?? '';
    for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"])
      expect(csp).toContain(directive);
  });

  it('declares no add_header inside a location (that would drop the server-level headers there)', () => {
    for (const block of nginx.matchAll(/location [^{]+\{([^}]*)\}/g)) expect(block[1]).not.toMatch(/add_header/);
  });

  it('answers a missing built asset 404, not the SPA page', () => {
    expect(location('/assets/')).toMatch(/try_files \$uri =404;/);
    expect(location('/')).toMatch(/try_files \$uri \/index\.html;/);
  });

  it('proxies the API with the original host and client address', () => {
    const api = location('/api/');
    expect(api).toMatch(/proxy_pass http:\/\/backend:8080;/);
    expect(api).toMatch(/proxy_set_header Host \$http_host;/);
    expect(api).toMatch(/proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/);
    expect(api).toMatch(/proxy_set_header X-Forwarded-Proto \$scheme;/);
  });
});

describe('Dockerfile', () => {
  it('pins every base image by digest', () => {
    const froms = [...dockerfile.matchAll(/^FROM (\S+)/gm)].map((m) => m[1]);
    expect(froms.length).toBeGreaterThan(0);
    expect(froms.filter((f) => !/@sha256:[0-9a-f]{64}$/.test(f))).toEqual([]);
  });

  it('fails the build when the pinned contract is missing, before building', () => {
    const check = dockerfile.indexOf('test -f contract/api/openapi.yaml');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(dockerfile.indexOf('npm run build'));
  });
});

describe('tsconfig split', () => {
  it('keeps DOM types out of Node-side code; only e2e specs get them', () => {
    expect(json('tsconfig.node.json').compilerOptions.lib).not.toContain('DOM');
    expect(json('tsconfig.node.json').include).not.toContain('e2e');
    expect(json('tsconfig.e2e.json').include).toContain('e2e');
    expect(json('tsconfig.json').references).toContainEqual({ path: './tsconfig.e2e.json' });
  });
});
