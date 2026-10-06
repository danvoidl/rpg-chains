import type { Prisma } from '@prisma/client';

/**
 * Locks the room row until the transaction ends (`SELECT … FOR UPDATE`). Serializes the writes
 * that read-then-write room state — above all the class-slot check, where two players could
 * otherwise both take the last slot. Returns false when the room does not exist.
 */
export async function lockRoom(tx: Prisma.TransactionClient, roomId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Room" WHERE id = ${roomId} FOR UPDATE`;
  return rows.length > 0;
}
