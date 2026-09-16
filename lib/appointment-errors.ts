/**
 * The `unique_scheduled_slot` index is what actually settles a race between two
 * customers paying for the same time, so a duplicate key error there means the
 * slot was taken a moment earlier.
 */
export function isDuplicateSlotError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
