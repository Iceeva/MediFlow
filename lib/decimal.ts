import { Prisma } from "@prisma/client";

export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export const toNumber = (v: Prisma.Decimal | number | string | null | undefined) =>
  v == null ? 0 : Number(v.toString());
