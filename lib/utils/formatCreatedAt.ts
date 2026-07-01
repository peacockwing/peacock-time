/**
 * Utilities for formatting `created_at` timestamps for storage.
 *
 * Purpose:
 * - Ensure values are saved as UTC midnight strings like `2026-07-01T00:00:00Z`.
 * - Avoid off-by-one-day issues when parsing plain date strings or when
 *   converting local times to UTC for backend storage (e.g. Supabase).
 */

/**
 * Accepts a Date, timestamp, or date string and returns a UTC-midnight ISO
 * timestamp without milliseconds, e.g. `2026-07-01T00:00:00Z`.
 *
 * Behavior notes:
 * - If `input` is a plain `YYYY-MM-DD` string, it is treated as a local date
 *   (not parsed as UTC) to avoid timezone shifts.
 * - For Date/timestamp inputs we use the local Y/M/D components and then
 *   produce the corresponding UTC midnight (Date.UTC) so the stored value is
 *   the canonical UTC midnight for that local date.
 */
export function formatCreatedAt(input?: Date | string | number): string {
  let year: number;
  let monthIndex: number; // 0-based
  let day: number;

  if (!input) {
    const now = new Date();
    year = now.getFullYear();
    monthIndex = now.getMonth();
    day = now.getDate();
  } else if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    // Treat plain date strings as local dates (YYYY-MM-DD)
    const parts = input.split('-').map((p) => Number(p));
    year = parts[0];
    monthIndex = parts[1] - 1;
    day = parts[2];
  } else {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Invalid date input: ${String(input)}`);
    }
    // Use local date components to avoid unintended UTC parsing/shifts
    year = d.getFullYear();
    monthIndex = d.getMonth();
    day = d.getDate();
  }

  // Build a UTC midnight for the determined local Y/M/D
  const utcMidnight = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0));

  // toISOString includes milliseconds; strip them to match `...:00Z` format.
  return utcMidnight.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export default formatCreatedAt;
