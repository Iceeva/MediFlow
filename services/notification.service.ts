import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { requireTenantId } from "@/lib/tenant";
import { pageArgs, type Pagination } from "@/lib/http";
import type { AuthContext } from "@/lib/session";

type Db = Prisma.TransactionClient | PrismaClient;

export interface NotifyInput {
  tenantId: string;
  userId: string | null | undefined;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

/** Notifications are rows in PostgreSQL. Users read them from the API, no queue or worker involved. */
export async function notify(input: NotifyInput, db: Db = prisma) {
  if (!input.userId) return null;
  return db.notification.create({
    data: { tenantId: input.tenantId, userId: input.userId, type: input.type, title: input.title, message: input.message, metadata: input.metadata },
    select: { id: true },
  });
}

export async function listNotifications(auth: AuthContext, p: Pagination, unreadOnly: boolean) {
  const where: Prisma.NotificationWhereInput = { tenantId: requireTenantId(auth), userId: auth.userId, ...(unreadOnly ? { read: false } : {}) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, ...pageArgs(p) }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { tenantId: where.tenantId, userId: auth.userId, read: false } }),
  ]);
  return { items, total, unread };
}

export async function markRead(auth: AuthContext, id: string, read: boolean) {
  const res = await prisma.notification.updateMany({ where: { id, tenantId: requireTenantId(auth), userId: auth.userId }, data: { read } });
  if (res.count === 0) throw notFound("Notification not found");
}

export const markAllRead = (auth: AuthContext) =>
  prisma.notification.updateMany({ where: { tenantId: requireTenantId(auth), userId: auth.userId, read: false }, data: { read: true } });
