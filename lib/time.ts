/** Day of week (0 = Sunday) and "HH:mm" of an instant, expressed in an IANA time zone. */
export function localParts(date: Date, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  } catch {
    return localParts(date, "UTC");
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { dayOfWeek, time: `${get("hour")}:${get("minute")}` };
}

export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
export const startOfUtcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
