// @trace NFR-4
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * CA-D21 (content-authoring "Copyright-safe content"): every fixture is self-authored; every skin
 * asset is self-authored or openly licensed with its licence file (same origin and author) listed
 * beside it; listed files
 * exist. Scope: every file under a fixture or asset root, plus every image, font, audio, video or
 * PDF anywhere in the repository (git-tracked or new), wherever it was dropped.
 */
const MANIFEST = 'fixtures/PROVENANCE.md';
const FIXTURE_ROOTS = ['fixtures/', 'e2e/fixtures/', 'evals/cases/'];
const ASSET_ROOTS = ['public/', 'src/assets/', 'src/design-system/fonts/', 'src/design-system/icons/'];
const MEDIA = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|woff2?|ttf|otf|eot|pdf|mp3|wav|ogg|m4a|mp4|webm|mov)$/i;
/** Generated QA evidence (recordings of the app over self-authored fixtures) and the pinned contract. */
const OUT_OF_SCOPE = ['docs/qa/', 'contract/'];
const EXEMPT = (p: string) => p === MANIFEST || p.endsWith('/.gitkeep');
const LICENCE_TEXT = /licen[cs]e|OFL|COPYING/i;
const ROW = /^\|\s*`([^`]+)`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|$/;

const isFixture = (p: string) => FIXTURE_ROOTS.some((r) => p.startsWith(r));
const inScope = (p: string) =>
  !EXEMPT(p) && !OUT_OF_SCOPE.some((r) => p.startsWith(r)) && (isFixture(p) || ASSET_ROOTS.some((r) => p.startsWith(r)) || MEDIA.test(p));
const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/') + 1);

/** Every provenance problem for a repository with these files and this manifest; empty when complete. */
export function provenanceProblems(files: string[], manifest: string, exists: (p: string) => boolean): string[] {
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
    if (!e.origin.startsWith('licensed:') || LICENCE_TEXT.test(e.path.slice(dirOf(e.path).length))) continue;
    const licence = entries.find(
      (o) => o.origin === e.origin && o.author === e.author && dirOf(o.path) === dirOf(e.path) && LICENCE_TEXT.test(o.path.slice(dirOf(o.path).length)),
    );
    if (!licence) problems.push(`${e.path}: '${e.origin}' has no licence file listed beside it`);
  }
  const listed = new Set(entries.map((e) => e.path));
  for (const f of files.filter(inScope)) if (!listed.has(f)) problems.push(`${f}: not listed in ${MANIFEST}`);
  return problems;
}

const manifestWith = (rows: string) => `# x\n\n| Path | Origin | Author | What |\n|---|---|---|---|\n${rows}`;

describe('fixture and asset provenance (NFR-4)', () => {
  it("this repository's fixtures and assets are all listed with an allowed origin", () => {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .filter(existsSync);
    expect(files.length).toBeGreaterThan(0);
    expect(provenanceProblems(files, readFileSync(MANIFEST, 'utf8'), existsSync)).toEqual([]);
  });

  it('an unlisted fixture, asset or media file anywhere fails the check and is named', () => {
    const files = ['fixtures/answers.json', 'e2e/fixtures/x.ts', 'evals/cases/c1.json', 'public/scan.png', 'src/features/a/page.pdf', 'src/app/App.tsx', 'docs/qa/demo.png'];
    expect(provenanceProblems(files, manifestWith(''), () => true)).toEqual([
      'fixtures/answers.json: not listed in fixtures/PROVENANCE.md',
      'e2e/fixtures/x.ts: not listed in fixtures/PROVENANCE.md',
      'evals/cases/c1.json: not listed in fixtures/PROVENANCE.md',
      'public/scan.png: not listed in fixtures/PROVENANCE.md',
      'src/features/a/page.pdf: not listed in fixtures/PROVENANCE.md',
    ]);
  });

  it('a licensed asset needs its licence file listed beside it; fixtures must be self-authored', () => {
    const rows = [
      '| `src/design-system/fonts/A.woff2` | licensed: OFL-1.1 | A Authors | font |',
      '| `src/design-system/fonts/B.woff2` | licensed: OFL-1.1 | B Authors | font |',
      '| `src/design-system/fonts/B-OFL.txt` | licensed: OFL-1.1 | B Authors | licence |',
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
      "fixtures/f.json: 'licensed: MIT' has no licence file listed beside it",
    ]);
  });
});
