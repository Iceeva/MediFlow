/* Development seed. ALL DATA IS FICTIONAL. Never load real medical data here. */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nextNumber } from "../lib/sequence";

const prisma = new PrismaClient();
const PASSWORD = "ChangeMe!2026";

async function user(email: string, firstName: string, lastName: string, passwordHash: string, extra = {}) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, firstName, lastName, passwordHash, emailVerifiedAt: new Date(), ...extra },
  });
}

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  await user("superadmin@mediflow.test", "Sam", "Root", hash, { isSuperAdmin: true });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-clinic" },
    update: {},
    create: { name: "Demo Clinic", slug: "demo-clinic", email: "contact@demo-clinic.test", phone: "+22900000000", address: "1 Fictional Avenue", timezone: "Africa/Porto-Novo" },
  });

  const roles: [string, string, string, Role][] = [
    ["admin@demo-clinic.test", "Ada", "Admin", Role.CLINIC_ADMIN],
    ["doctor@demo-clinic.test", "Diane", "Dupont", Role.DOCTOR],
    ["nurse@demo-clinic.test", "Noah", "Nguyen", Role.NURSE],
    ["reception@demo-clinic.test", "Rita", "Reyes", Role.RECEPTIONIST],
    ["accountant@demo-clinic.test", "Alex", "Accra", Role.ACCOUNTANT],
    ["patient@demo-clinic.test", "Paul", "Patient", Role.PATIENT],
  ];
  const users: Record<string, { id: string }> = {};
  for (const [email, fn, ln, role] of roles) {
    const u = await user(email, fn, ln, hash);
    users[role] = u;
    await prisma.membership.upsert({
      where: { userId_tenantId: { userId: u.id, tenantId: tenant.id } },
      update: {},
      create: { userId: u.id, tenantId: tenant.id, role },
    });
  }

  const doctor = await prisma.doctor.upsert({
    where: { userId: users.DOCTOR!.id },
    update: {},
    create: { tenantId: tenant.id, userId: users.DOCTOR!.id, specialization: "General Medicine", licenseNumber: "DEMO-0001", consultationFee: 15000 },
  });
  if ((await prisma.doctorAvailability.count({ where: { doctorId: doctor.id } })) === 0) {
    await prisma.doctorAvailability.createMany({
      data: [1, 2, 3, 4, 5].map((d) => ({ doctorId: doctor.id, dayOfWeek: d, startTime: "08:00", endTime: "17:00" })),
    });
  }
  for (const key of ["NURSE", "RECEPTIONIST", "ACCOUNTANT"]) {
    await prisma.staffProfile.upsert({
      where: { userId: users[key]!.id },
      update: {},
      create: { tenantId: tenant.id, userId: users[key]!.id, jobTitle: key.toLowerCase() },
    });
  }

  const patient = await prisma.patient.upsert({
    where: { userId: users.PATIENT!.id },
    update: {},
    create: {
      tenantId: tenant.id, userId: users.PATIENT!.id, firstName: "Paul", lastName: "Patient",
      dateOfBirth: new Date("1990-04-12"), gender: "MALE", phone: "+22911111111", email: "patient@demo-clinic.test",
      bloodType: "O+", allergies: ["Penicillin"], medicalHistory: "Seasonal asthma (fictional).",
    },
  });

  const meds = [
    ["Paracetamol", "Acetaminophen", "Tablet", "500 mg"],
    ["Amoxicillin", "Amoxicillin", "Capsule", "500 mg"],
    ["Salbutamol", "Albuterol", "Inhaler", "100 mcg"],
  ];
  for (const [name, genericName, dosageForm, strength] of meds) {
    const exists = await prisma.medication.findFirst({ where: { tenantId: tenant.id, name } });
    if (!exists) await prisma.medication.create({ data: { tenantId: tenant.id, name: name!, genericName, dosageForm, strength, manufacturer: "Fictional Pharma" } });
  }

  if ((await prisma.appointment.count({ where: { tenantId: tenant.id } })) === 0) {
    const start = new Date(); start.setDate(start.getDate() - 1); start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    const appt = await prisma.appointment.create({
      data: { tenantId: tenant.id, patientId: patient.id, doctorId: doctor.id, startsAt: start, endsAt: end, reason: "Cough and fatigue", status: "COMPLETED", createdById: users.RECEPTIONIST!.id },
    });
    const consultation = await prisma.consultation.create({
      data: { tenantId: tenant.id, appointmentId: appt.id, patientId: patient.id, doctorId: doctor.id, symptoms: "Dry cough, mild fever", diagnosis: "Viral bronchitis", treatment: "Rest and fluids" },
    });
    await prisma.vital.create({
      data: { tenantId: tenant.id, patientId: patient.id, consultationId: consultation.id, recordedById: users.NURSE!.id, systolic: 120, diastolic: 80, heartRate: 78, temperatureC: 37.8, weightKg: 74, heightCm: 178, oxygenSaturation: 98 },
    });
    const number = await nextNumber(prisma, tenant.id, "prescription", "RX");
    await prisma.prescription.create({
      data: {
        tenantId: tenant.id, number, patientId: patient.id, doctorId: doctor.id, consultationId: consultation.id,
        items: { create: [{ medicationName: "Paracetamol 500 mg", dosage: "1 tablet", frequency: "3 times a day", duration: "5 days", route: "Oral" }] },
      },
    });
    const invNumber = await nextNumber(prisma, tenant.id, "invoice", "INV");
    const inv = await prisma.invoice.create({
      data: {
        tenantId: tenant.id, number: invNumber, patientId: patient.id, status: "PENDING", subtotal: 15000, total: 15000,
        dueDate: new Date(Date.now() + 14 * 86_400_000), createdById: users.ACCOUNTANT!.id,
        items: { create: [{ description: "General consultation", quantity: 1, unitPrice: 15000, total: 15000 }] },
      },
    });
    console.log("Seeded invoice", inv.number);
  }

  console.log(`Seed complete. All demo accounts use password: ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
