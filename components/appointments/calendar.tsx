"use client";
import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import { useList } from "@/hooks/use-api";
import { fullName } from "@/lib/utils";

export interface Appt { id: string; startsAt: string; endsAt: string; status: string; reason: string | null; patient: { id: string; firstName: string; lastName: string }; doctor: { id: string; user: { firstName: string; lastName: string } }; consultation: { id: string } | null }

const COLORS: Record<string, string> = { PENDING: "#a16207", CONFIRMED: "#0c7580", CHECKED_IN: "#0369a1", IN_PROGRESS: "#7c3aed", COMPLETED: "#15803d", CANCELLED: "#6b7280", NO_SHOW: "#b91c1c" };

/** DAY, WEEK and MONTH views. Only the visible range is requested from the server. */
export function AppointmentCalendar({ doctorId, onSelect, onSlot }: { doctorId?: string; onSelect: (a: Appt) => void; onSlot?: (start: Date, end: Date) => void }) {
  const [range, setRange] = useState<{ from: string; to: string }>();
  const ref = useRef<FullCalendar>(null);
  const list = useList<Appt>("/appointments", { from: range?.from, to: range?.to, doctorId, pageSize: 500 }, !!range);
  const events: EventInput[] = (list.rows ?? []).map((a) => ({
    id: a.id, start: a.startsAt, end: a.endsAt, title: `${fullName(a.patient)}${a.reason ? ` - ${a.reason}` : ""}`,
    backgroundColor: COLORS[a.status], borderColor: COLORS[a.status], extendedProps: a, classNames: a.status === "CANCELLED" ? ["opacity-60", "line-through"] : [],
  }));
  return (
    <div aria-busy={list.isFetching}>
      <FullCalendar ref={ref} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" height="auto" nowIndicator
        headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth" }}
        buttonText={{ today: "Today", day: "Day", week: "Week", month: "Month" }}
        slotMinTime="07:00:00" slotMaxTime="20:00:00" allDaySlot={false} selectable={!!onSlot} firstDay={1}
        events={events}
        datesSet={(a: DatesSetArg) => setRange({ from: a.start.toISOString(), to: a.end.toISOString() })}
        eventClick={(e: EventClickArg) => onSelect(e.event.extendedProps as Appt)}
        select={(s) => onSlot?.(s.start, s.end)} />
    </div>
  );
}
