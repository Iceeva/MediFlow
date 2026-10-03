"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/client";
import { Input } from "../ui/form";
import { fullName } from "@/lib/utils";

interface Results {
  patients: { id: string; firstName: string; lastName: string }[];
  doctors: { id: string; specialization: string; user: { firstName: string; lastName: string } }[];
  appointments: { id: string; startsAt: string; patient: { firstName: string; lastName: string } }[];
  invoices: { id: string; number: string }[];
  documents: { id: string; fileName: string }[];
  prescriptions: { id: string; number: string }[];
}

export function GlobalSearch() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 250); return () => clearTimeout(t); }, [text]);
  const { data, isFetching } = useQuery({ queryKey: ["/search", q], queryFn: () => api<Results>(`/search?q=${encodeURIComponent(q)}`), enabled: q.length >= 2 });
  const r = data?.data;
  const groups: [string, { href: string; label: string }[]][] = r ? [
    ["Patients", r.patients.map((p) => ({ href: `/patients/${p.id}`, label: fullName(p) }))],
    ["Doctors", r.doctors.map((d) => ({ href: `/doctors`, label: `Dr ${fullName(d.user)} (${d.specialization})` }))],
    ["Appointments", r.appointments.map((a) => ({ href: `/appointments`, label: `${fullName(a.patient)} - ${new Date(a.startsAt).toLocaleDateString("en-GB")}` }))],
    ["Invoices", r.invoices.map((i) => ({ href: `/invoices`, label: i.number }))],
    ["Documents", r.documents.map((d) => ({ href: `/documents`, label: d.fileName }))],
    ["Prescriptions", r.prescriptions.map((p) => ({ href: `/prescriptions`, label: p.number }))],
  ] : [];
  const any = groups.some(([, items]) => items.length);
  return (
    <div className="relative w-full max-w-md" role="search">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden />
      <Input aria-label="Search the clinic" placeholder="Search patients, invoices, documents" className="pl-9" value={text} onChange={(e) => setText(e.target.value)} />
      {q.length >= 2 && (
        <div className="absolute z-30 mt-1 max-h-96 w-full overflow-y-auto rounded-card border border-line bg-surface p-2 shadow-lg">
          {isFetching && <p className="p-2 text-sm text-muted">Searching</p>}
          {!isFetching && !any && <p className="p-2 text-sm text-muted">No results for &quot;{q}&quot;</p>}
          {groups.filter(([, items]) => items.length).map(([name, items]) => (
            <div key={name} className="mb-1">
              <p className="px-2 pt-1 text-xs font-bold text-muted">{name}</p>
              {items.map((i) => <Link key={i.href + i.label} href={i.href} onClick={() => setText("")} className="block rounded px-2 py-1.5 hover:bg-primary-soft">{i.label}</Link>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
