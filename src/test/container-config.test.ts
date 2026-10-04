// @trace NFR-12
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The image and server config the Compose stack runs (backend/compose.yaml, decision D-P1).
 * Behaviour is also checked live by the compose smoke (curl -I); these guard the files themselves.
 */
const nginx = readFileSync('nginx.conf', 'utf8');
const dockerfile = readFileSync('Dockerfile', 'utf8');
/** tsconfig files carry whole-line block comments; a `/*` inside a string (the `@/*` alias) is not one. */
const json = (f: string) => JSON.parse(readFileSync(f, 'utf8').replace(/^\s*\/\*.*?\*\/\s*$/gm, ''));

/** Body of the first `location <path> { ... }` block (no nested blocks in this config). */
const location = (path: string) => new RegExp(`location ${path.replace(/\//g, '\\/')} \\{([^}]*)\\}`).exec(nginx)?.[1] ?? '';

describe('nginx.conf', () => {
  it('hides its version and sends security headers on every response, the 421 refusal included', () => {
    // Before the first server block, i.e. at http level, so every server inherits them.
    const httpLevel = nginx.slice(0, nginx.search(/^server \{/m));
    expect(httpLevel).toMatch(/^server_tokens off;/m);
    expect(httpLevel).toMatch(/^add_header X-Content-Type-Options "?nosniff"? always;/m);
    expect(httpLevel).toMatch(/^add_header Referrer-Policy "?no-referrer"? always;/m);
    const csp = /^add_header Content-Security-Policy "([^"]+)" always;/m.exec(httpLevel)?.[1] ?? '';
    for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"])
      expect(csp).toContain(directive);
  });

  it('declares no add_header inside a server or location (that would drop the http-level headers there)', () => {
    const servers = nginx.slice(nginx.search(/^server \{/m));
    expect(servers).not.toMatch(/add_header/);
  });

  it('refuses every Host but localhost and an IPv4 address with 421 (DNS rebinding)', () => {
    const blocks = [...nginx.matchAll(/^server \{\n([\s\S]*?)^\}/gm)].map((m) => m[1]);
    const fallback = blocks.find((b) => /listen 80 default_server;/.test(b)) ?? '';
    expect(fallback).toMatch(/return 421;/);
    const app = blocks.find((b) => /server_name /.test(b)) ?? '';
    const names = /server_name ([^;]+);/.exec(app)?.[1].split(/\s+/) ?? [];
    expect(names[0]).toBe('localhost');
    const ipv4 = new RegExp(names[1].replace(/^"~|"$/g, ''));
    expect(['127.0.0.1', '192.168.1.20'].every((h) => ipv4.test(h))).toBe(true);
    expect(['evil.example', '127.0.0.1.evil.example', 'localhost.evil.example'].some((h) => ipv4.test(h))).toBe(false);
    expect(names).toHaveLength(2);
  });

  it('answers a missing built asset 404, not the SPA page', () => {
    expect(location('/assets/')).toMatch(/try_files \$uri =404;/);
    expect(location('/')).toMatch(/try_files \$uri \/index\.html;/);
  });

  it('re-resolves the backend through Docker DNS, so a recreated backend container is found', () => {
    expect(nginx).toMatch(/^\s*resolver 127\.0\.0\.11 valid=\d+s( ipv6=off)?;/m);
    const api = location('/api/');
    expect(api).toMatch(/set \$backend http:\/\/backend:8080;/);
    expect(api).toMatch(/proxy_pass \$backend;/);
  });

  it('never lets a client cache the SPA shell', () => {
    expect(location('/')).toMatch(/expires -1;/);
  });

  it('proxies the API with the original host and client address', () => {
    const api = location('/api/');
    expect(api).toMatch(/proxy_set_header Host \$http_host;/);
    // Overwritten, not appended: a client-supplied X-Forwarded-For must not reach the login throttle.
    expect(api).toMatch(/proxy_set_header X-Forwarded-For \$remote_addr;/);
    expect(api).not.toMatch(/proxy_add_x_forwarded_for/);
  });

  it("drops the backend's copies of the server-level security headers", () => {
    const api = location('/api/');
    for (const h of ['X-Content-Type-Options', 'Referrer-Policy', 'Content-Security-Policy'])
      expect(api).toContain(`proxy_hide_header ${h};`);
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

describe('Docker build context', () => {
  const patterns = (f: string) =>
    readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

  it('excludes everything git ignores, so a clean commit names exactly what the image was built from', () => {
    const docker = new Set(patterns('.dockerignore'));
    expect(patterns('.gitignore').filter((p) => !p.startsWith('!') && !docker.has(p))).toEqual([]);
  });
});

describe('tsconfig split', () => {
  it('keeps DOM types out of Node-side code; only e2e specs get them', () => {
    expect(json('tsconfig.node.json').compilerOptions.lib).not.toContain('DOM');
    expect(json('tsconfig.node.json').include).not.toContain('e2e');
    expect(json('tsconfig.e2e.json').include).toContain('e2e');
    expect(json('tsconfig.json').references).toContainEqual({ path: './tsconfig.e2e.json' });
  });

  it('keeps Node types out of app code; tests are typed separately', () => {
    const app = json('tsconfig.app.json');
    expect(app.compilerOptions.types).not.toContain('node');
    expect(app.exclude).toEqual(expect.arrayContaining(['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test']));
  });
});
