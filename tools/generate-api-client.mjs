// Generates TypeScript types for the API from the OpenAPI contract (TC-3, NFR-12) into
// src/api/generated/schema.d.ts (gitignored, never hand-edited). The contract is the pinned
// contract/ submodule; until the pin exists, the sibling ../docs checkout (UNPINNED).
// Before the docs store drafts api/openapi.yaml (Phase 2) there is nothing to generate: SKIP.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const pinned = resolve('contract/api/openapi.yaml');
const sibling = resolve('../docs/api/openapi.yaml');
const out = resolve('src/api/generated/schema.d.ts');

let spec;
if (existsSync(pinned)) {
  spec = pinned;
} else if (existsSync(sibling)) {
  spec = sibling;
  console.warn('api:generate: UNPINNED — reading ../docs/api/openapi.yaml (add the contract/ submodule)');
} else if (existsSync('contract')) {
  console.error('api:generate: contract/ is pinned but has no api/openapi.yaml');
  process.exit(1);
} else {
  console.log('api:generate: SKIP-pending — no api/openapi.yaml in the contract yet (docs Phase 2)');
  process.exit(0);
}

const ast = await openapiTS(pathToFileURL(spec));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `// Generated from ${spec.includes('contract') ? 'contract' : '../docs'}/api/openapi.yaml by tools/generate-api-client.mjs. Do not edit.\n${astToString(ast)}`);
console.log(`api:generate: wrote ${out}`);
