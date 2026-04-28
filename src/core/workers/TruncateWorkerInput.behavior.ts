/**
 * @file TruncateWorkerInput.behavior.ts
 * @layer core
 * @description Cap worker prompt input by UTF-16 code unit length (JS `string.length`).
 */

/**
 * Truncates `text` to at most `maxChars` units (same units as `String.prototype.slice`).
 * @param text - Full raw body.
 * @param maxChars - Positive maximum length.
 * @returns Possibly shorter text and whether truncation occurred.
 */
export function truncateWorkerInputText(
  text: string,
  maxChars: number,
): { readonly text: string; readonly truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  return { text: text.slice(0, maxChars), truncated: true };
}
