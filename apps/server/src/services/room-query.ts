import type { Prisma } from '@prisma/client';

/** Relations every room read model needs. */
export const roomInclude = {
  campaign: { select: { id: true, name: true } },
  master: { select: { id: true, name: true } },
  profiles: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.RoomInclude;

export type RoomWithRelations = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

/** Loads a room with its campaign, master and profiles, or null. */
export function findRoom(
  tx: Prisma.TransactionClient,
  roomId: string,
): Promise<RoomWithRelations | null> {
  return tx.room.findUnique({ where: { id: roomId }, include: roomInclude });
}

/** Members are everyone with a profile, plus the master even before they pick a class. */
export function isMember(room: RoomWithRelations, userId: string): boolean {
  return room.masterId === userId || room.profiles.some((p) => p.userId === userId);
}

/**
 * Who may see a room: anyone for a public room; for a private one, members and whoever holds the
 * current access code. Everyone else gets a 404, so a private room's existence never leaks.
 */
export function canView(room: RoomWithRelations, userId: string, code?: string): boolean {
  return (
    room.isPublic ||
    isMember(room, userId) ||
    (code !== undefined && room.accessCode !== null && room.accessCode === code.toUpperCase())
  );
}
