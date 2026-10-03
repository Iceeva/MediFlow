"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader } from "../ui/card";

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </Card>
  );
}

const compactNumber = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

export function SeriesChart({ title, data, kind = "bar", compact = false }: { title: string; data: { date: string; value: number }[]; kind?: "bar" | "line"; compact?: boolean }) {
  const format = compact ? compactNumber : undefined;
  const empty = data.every((d) => d.value === 0);
  const common = { data, margin: { top: 8, right: 8, left: -12, bottom: 0 } };
  const axes = (
    <>
      <CartesianGrid stroke="hsl(200 18% 86%)" vertical={false} />
      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} tickFormatter={(v: number) => (format ? format(v) : String(v))} width={56} />
      <Tooltip formatter={(v: number) => (format ? format(v) : v)} />
    </>
  );
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {empty ? <p className="py-10 text-center text-muted">No activity in this period yet.</p> : (
          <div className="h-56" role="img" aria-label={`${title} chart`}>
            <ResponsiveContainer>
              {kind === "bar" ? (
                <BarChart {...common}>{axes}<Bar dataKey="value" fill="hsl(186 82% 27%)" radius={[3, 3, 0, 0]} /></BarChart>
              ) : (
                <LineChart {...common}>{axes}<Line dataKey="value" stroke="hsl(186 82% 27%)" strokeWidth={2} dot={false} /></LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
