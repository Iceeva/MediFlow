import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/errors";
import { requireTenantId } from "@/lib/tenant";
import { storage } from "@/lib/storage";
import { detectMime, sanitizeFileName } from "@/lib/storage/validate";
import type { AuthContext } from "@/lib/session";
import { documentWhere, patientWhere } from "./scope";
import { notify } from "./notification.service";

// storageKey / storageProvider are internal and never returned to API clients.
const select = {
  id: true, type: true, fileName: true, mimeType: true, size: true, accessPolicy: true, uploadedById: true, createdAt: true,
  patient: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.MedicalDocumentSelect;

export async function listDocuments(auth: AuthContext, f: { patientId?: string; type?: string; q?: string; page: number; pageSize: number; order: "asc" | "desc" }) {
  const where: Prisma.MedicalDocumentWhereInput = {
    AND: [documentWhere(auth), f.patientId ? { patientId: f.patientId } : {}, f.type ? { type: f.type as never } : {}, f.q ? { fileName: { contains: f.q, mode: "insensitive" } } : {}],
  };
  const [items, total] = await Promise.all([
    prisma.medicalDocument.findMany({ where, select, orderBy: { createdAt: f.order }, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    prisma.medicalDocument.count({ where }),
  ]);
  return { items, total };
}

export async function getDocument(auth: AuthContext, id: string) {
  const doc = await prisma.medicalDocument.findFirst({ where: { AND: [documentWhere(auth), { id }] }, select: { ...select, storageKey: true } });
  if (!doc) throw notFound("Document not found");
  return doc;
}

export async function uploadDocument(auth: AuthContext, fields: { patientId: string; type: never; accessPolicy: "STAFF_ONLY" | "PATIENT_VISIBLE" }, file: { name: string; type: string; body: Buffer }) {
  const tenantId = requireTenantId(auth);
  const patient = await prisma.patient.findFirst({ where: { AND: [patientWhere(auth), { id: fields.patientId }] }, select: { id: true, userId: true } });
  if (!patient) throw notFound("Patient not found");
  const fileName = sanitizeFileName(file.name);
  const mimeType = detectMime(file.body, fileName, file.type);

  const stored = await storage.upload({ scope: `${tenantId}/${patient.id}`, fileName, mimeType, body: file.body });
  try {
    const doc = await prisma.medicalDocument.create({
      data: { tenantId, patientId: patient.id, type: fields.type, fileName, storageKey: stored.storageKey, storageProvider: stored.provider, mimeType, size: stored.size, accessPolicy: fields.accessPolicy, uploadedById: auth.userId },
      select,
    });
    if (fields.accessPolicy === "PATIENT_VISIBLE") {
      await notify({ tenantId, userId: patient.userId, type: "DOCUMENT_ADDED", title: "New document", message: `${fileName} was added to your record.`, metadata: { documentId: doc.id } });
    }
    return doc;
  } catch (e) {
    await storage.delete(stored.storageKey).catch(() => undefined); // do not leave orphaned objects
    throw e;
  }
}

export async function readDocument(auth: AuthContext, id: string) {
  const doc = await getDocument(auth, id);
  const body = await storage.download(doc.storageKey);
  return { body, fileName: doc.fileName, mimeType: doc.mimeType, patientId: doc.patient.id };
}

export async function deleteDocument(auth: AuthContext, id: string) {
  const doc = await getDocument(auth, id);
  // Only the uploader can delete. The object is removed from storage, the row is soft-deleted for the audit trail.
  if (doc.uploadedById !== auth.userId) throw forbidden("Only the person who uploaded a document can delete it");
  await prisma.medicalDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  await storage.delete(doc.storageKey).catch(() => undefined);
}
