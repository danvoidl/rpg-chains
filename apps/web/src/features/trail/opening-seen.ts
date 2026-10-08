/** Where a chapter's opening is remembered as seen, per room and chapter, in this browser. */
export function openingSeenKey(roomId: string, chapterId: string): string {
  return `rpg-chains:opening-seen:${roomId}:${chapterId}`;
}

/** Whether the opening was seen here. Any storage failure counts as "not seen". */
export function hasSeenOpening(
  storage: Pick<Storage, 'getItem'> | undefined,
  roomId: string,
  chapterId: string,
): boolean {
  try {
    return storage?.getItem(openingSeenKey(roomId, chapterId)) === '1';
  } catch {
    return false;
  }
}

/** Remembers the opening as seen; a storage failure is swallowed (the caller closes it anyway). */
export function markOpeningSeen(
  storage: Pick<Storage, 'setItem'> | undefined,
  roomId: string,
  chapterId: string,
): void {
  try {
    storage?.setItem(openingSeenKey(roomId, chapterId), '1');
  } catch {
    // Private mode or blocked storage: the opening may show again next visit, never loop.
  }
}
