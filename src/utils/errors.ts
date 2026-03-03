/**
 * Converts an unknown IPC error value to a plain string.
 * Tauri IPC errors arrive either as `string` or as objects coerced via String().
 */
export function ipcErrorToString(err: unknown): string {
  return typeof err === 'string' ? err : String(err);
}
