// @trace NFR-4
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * CA-D21 (content-authoring "Copyright-safe content"): every fixture is self-authored; every skin
 * asset is self-authored or openly licensed with its licence file (same origin and author) listed
 * beside it; listed files exist. Scope: every file under a fixture or asset root; every image, font,
 * audio, video, PDF, office or plain-text data file anywhere in the repository (git-tracked or new);
 * and JSON, Markdown or YAML data under src/ (outside the vendored design system) and e2e/. Under
 * docs/qa/ only recordings a manifest lists are exempt (the recorder writes them).
 */
const MANIFEST = 'fixtures/PROVENANCE.md';
const FIXTURE_ROOTS = ['fixtures/', 'e2e/fixtures/', 'evals/cases/'];
const ASSET_ROOTS = ['public/', 'src/assets/', 'src/design-system/fonts/', 'src/design-system/icons/'];
const MEDIA =
  /\.(png|jpe?g|jfif|gif|webp|avif|heic|heif|svg|ico|bmp|tiff?|psd|ai|eps|woff2?|ttf|otf|eot|pdf|djvu|epub|mp3|wav|ogg|opus|flac|aac|m4a|mp4|m4v|webm|mov|mkv|avi)$/i;
const DOCUMENTS = /\.(csv|tsv|txt|rtf|docx?|xlsx?|pptx?|odt|ods|odp)$/i;
const SOURCE_DATA = /^(src\/(?!design-system\/)|e2e\/).*\.(json|md|ya?ml)$/i;
/** The pinned contract belongs to the docs store, which checks its own provenance. */
const OUT_OF_SCOPE = ['contract/'];
const EXEMPT = (p: string) => p === MANIFEST || p.endsWith('/.gitkeep');
/** A licence text: a .txt/.md (or bare) file named LICENSE/LICENCE/COPYING, or ending in -OFL / -LICENSE. */
const LICENCE_TEXT = /(^|[-_.])(licen[cs]e|OFL|COPYING)(\.(txt|md))?$/i;
const ROW = /^\|\s*`([^`]+)`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|$/;

const isFixture = (p: string) => FIXTURE_ROOTS.some((r) => p.startsWith(r));
const inScope = (p: string, recordings: Set<string>) =>
  !EXEMPT(p) &&
  !OUT_OF_SCOPE.some((r) => p.startsWith(r)) &&
  !(p.startsWith('docs/qa/') && recordings.has(p)) &&
  (isFixture(p) || ASSET_ROOTS.some((r) => p.startsWith(r)) || MEDIA.test(p) || DOCUMENTS.test(p) || SOURCE_DATA.test(p));
const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/') + 1);
const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** Every provenance problem for a repository with these files and this manifest; empty when complete. */
export function provenanceProblems(
  files: string[],
  manifest: string,
  exists: (p: string) => boolean,
  recordings: Set<string> = new Set(),
): string[] {
  const problems: string[] = [];
  const rows = manifest
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .slice(2); // header + separator
  const entries: { path: string; origin: string; author: string }[] = [];
  for (const row of rows) {
    const m = ROW.exec(row);
    if (!m) {
      problems.push(`malformed manifest row: ${row}`);
      continue;
    }
    const [path, origin, author] = [m[1], m[2].trim(), m[3].trim()];
    entries.push({ path, origin, author });
    const licensed = /^licensed: [A-Za-z0-9.+-]+$/.test(origin);
    if (!exists(path)) problems.push(`${path}: listed but does not exist`);
    else if (!author) problems.push(`${path}: no author`);
    else if (origin !== 'self-authored' && !(licensed && !isFixture(path)))
      problems.push(`${path}: origin '${origin}' is not allowed${isFixture(path) ? ' for a fixture' : ''}`);
  }
  for (const e of entries) {
    if (!e.origin.startsWith('licensed:') || LICENCE_TEXT.test(baseName(e.path))) continue;
    const licence = entries.find(
      (o) => o.origin === e.origin && o.author === e.author && dirOf(o.path) === dirOf(e.path) && LICENCE_TEXT.test(baseName(o.path)),
    );
    if (!licence) problems.push(`${e.path}: '${e.origin}' has no licence file listed beside it`);
  }
  const listed = new Set(entries.map((e) => e.path));
  for (const f of files.filter((p) => inScope(p, recordings))) if (!listed.has(f)) problems.push(`${f}: not listed in ${MANIFEST}`);
  return problems;
}

/** Files a recording manifest under docs/qa/ lists (written by scripts/record-demos.mjs). */
export function recordedFiles(files: string[], read = (f: string) => readFileSync(f, 'utf8')): Set<string> {
  const listed = new Set<string>();
  for (const m of files.filter((f) => f.startsWith('docs/qa/') && f.endsWith('/manifest.json'))) {
    const walk = (v: unknown): void => {
      if (typeof v === 'string') {
        // Only a recording: a media file under docs/qa/, named relative to the manifest or to the repo.
        if (!MEDIA.test(v)) return;
        const p = v.startsWith('docs/') ? v : `${dirOf(m)}${v.replace(/^\.\//, '')}`;
        if (p.startsWith('docs/qa/') && !p.includes('..')) listed.add(p);
      } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(JSON.parse(read(m)));
  }
  return listed;
}

const manifestWith = (rows: string) => `# x\n\n| Path | Origin | Author | What |\n|---|---|---|---|\n${rows}`;

describe('fixture and asset provenance (NFR-4)', () => {
  it("this repository's fixtures and assets are all listed with an allowed origin", () => {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .filter(existsSync);
    expect(files.length).toBeGreaterThan(0);
    expect(provenanceProblems(files, readFileSync(MANIFEST, 'utf8'), existsSync, recordedFiles(files))).toEqual([]);
  });

  it('an unlisted fixture, asset, media, document or data file fails the check and is named', () => {
    const files = [
      'fixtures/answers.json',
      'e2e/fixtures/x.ts',
      'evals/cases/c1.json',
      'public/scan.png',
      'src/features/a/page.pdf',
      'src/features/task/__fixtures__/tasks.json',
      'e2e/data/answers.csv',
      'src/features/task/scan.heic',
      'docs/qa/scan.pdf',
      'docs/qa/demo/clip.webm',
      'src/app/App.tsx',
      'src/design-system/tokens.json',
      'package.json',
      'README.md',
    ];
    expect(provenanceProblems(files, manifestWith(''), () => true, new Set(['docs/qa/demo/clip.webm']))).toEqual([
      'fixtures/answers.json: not listed in fixtures/PROVENANCE.md',
      'e2e/fixtures/x.ts: not listed in fixtures/PROVENANCE.md',
      'evals/cases/c1.json: not listed in fixtures/PROVENANCE.md',
      'public/scan.png: not listed in fixtures/PROVENANCE.md',
      'src/features/a/page.pdf: not listed in fixtures/PROVENANCE.md',
      'src/features/task/__fixtures__/tasks.json: not listed in fixtures/PROVENANCE.md',
      'e2e/data/answers.csv: not listed in fixtures/PROVENANCE.md',
      'src/features/task/scan.heic: not listed in fixtures/PROVENANCE.md',
      'docs/qa/scan.pdf: not listed in fixtures/PROVENANCE.md',
    ]);
  });

  it('only media files a docs/qa manifest lists under docs/qa/ count as recordings', () => {
    const manifest = JSON.stringify({ clips: [{ file: 'clip.webm', frs: ['FR-1'] }, 'docs/qa/demo/b.png'], note: 'scan.pdf is fine', other: ['../../fixtures/x.png', 'src/a.png', 'notes.md'] });
    const listed = recordedFiles(['docs/qa/demo/manifest.json', 'src/manifest.json'], () => manifest);
    expect([...listed].sort()).toEqual(['docs/qa/demo/b.png', 'docs/qa/demo/clip.webm', 'docs/qa/demo/src/a.png']);
  });

  it('a licensed asset needs its licence file listed beside it; fixtures must be self-authored', () => {
    const rows = [
      '| `src/design-system/fonts/A.woff2` | licensed: OFL-1.1 | A Authors | font |',
      '| `src/design-system/fonts/B.woff2` | licensed: OFL-1.1 | B Authors | font |',
      '| `src/design-system/fonts/B-OFL.txt` | licensed: OFL-1.1 | B Authors | licence |',
      '| `src/design-system/fonts/C-OFL.woff2` | licensed: OFL-1.1 | C Authors | font named like a licence |',
      '| `fixtures/f.json` | licensed: MIT | someone | fixture |',
      '| `fixtures/g.json` | self-authored |  | fixture |',
      '| `fixtures/gone.json` | self-authored | me | fixture |',
      '| fixtures/h.json | self-authored | me | no backticks |',
    ].join('\n');
    const present = (p: string) => p !== 'fixtures/gone.json';
    expect(provenanceProblems([], manifestWith(rows), present)).toEqual([
      "fixtures/f.json: origin 'licensed: MIT' is not allowed for a fixture",
      'fixtures/g.json: no author',
      'fixtures/gone.json: listed but does not exist',
      'malformed manifest row: | fixtures/h.json | self-authored | me | no backticks |',
      "src/design-system/fonts/A.woff2: 'licensed: OFL-1.1' has no licence file listed beside it",
      "src/design-system/fonts/C-OFL.woff2: 'licensed: OFL-1.1' has no licence file listed beside it",
      "fixtures/f.json: 'licensed: MIT' has no licence file listed beside it",
    ]);
  });
});
