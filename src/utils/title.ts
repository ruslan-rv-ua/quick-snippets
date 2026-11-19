/**
 * Shortest and longest title, in characters: the limits of the title column
 * (`CHECK (length(title) >= 3 AND length(title) <= 50)` in src-tauri/src/db.rs).
 * The backend checks the same limits (`check_title` in src-tauri/src/commands.rs).
 */
export const TITLE_MIN_CHARS = 3;
export const TITLE_MAX_CHARS = 50;

/**
 * Number of characters as the database counts them: Unicode code points. An emoji outside
 * the BMP is one character here but two UTF-16 units in `String.length`.
 */
export function countCharacters(text: string): number {
  return Array.from(text).length;
}

/** Whether the database accepts a title of this length. */
export function isTitleLengthValid(title: string): boolean {
  const count = countCharacters(title);
  return count >= TITLE_MIN_CHARS && count <= TITLE_MAX_CHARS;
}
