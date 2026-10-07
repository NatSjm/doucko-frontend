/**
 * The skin's IP check (gamification "Swappable skin", FR-39): the terms of the store's deny-list
 * (`contract/docs/skin/ip-denylist.txt`) must not appear in anything the frontend ships as theme
 * material — the Czech child catalog and the asset file names. The matching rule is the file's
 * header: one term per line, `#` lines and blank lines ignored; a term matches case-insensitively as
 * a whole word or phrase (the character before and after is not a letter or digit, or the text
 * ends there); diacritics are not folded.
 */

/** The terms of a deny-list file. */
export function parseDenyList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The deny-listed terms that occur in `text`, in the list's order (empty when the text is clean). */
export function findDenied(text: string, terms: readonly string[]): string[] {
  return terms.filter((term) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, 'iu').test(text));
}
