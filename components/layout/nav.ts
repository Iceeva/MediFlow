import { Activity, Bell, CalendarDays, CreditCard, FileText, FolderLock, LayoutDashboard, Pill, ReceiptText, Settings, ShieldCheck, Stethoscope, Users, type LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem { href: string; label: string; icon: LucideIcon; permission?: Permission }

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users, permission: "patient:read" },
  { href: "/doctors", label: "Doctors", icon: Stethoscope, permission: "doctor:read" },
  { href: "/appointments", label: "Appointments", icon: CalendarDays, permission: "appointment:read" },
  { href: "/consultations", label: "Consultations", icon: Activity, permission: "consultation:read" },
  { href: "/prescriptions", label: "Prescriptions", icon: FileText, permission: "prescription:read" },
  { href: "/medications", label: "Medications", icon: Pill, permission: "medication:read" },
  { href: "/documents", label: "Documents", icon: FolderLock, permission: "document:read" },
  { href: "/invoices", label: "Invoices", icon: ReceiptText, permission: "invoice:read" },
  { href: "/payments", label: "Payments", icon: CreditCard, permission: "payment:read" },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/audit", label: "Audit log", icon: ShieldCheck, permission: "audit:read" },
  { href: "/settings", label: "Settings", icon: Settings },
];
