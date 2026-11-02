export function formatStamp(
  value: string | null | undefined,
  locale = "en",
  timeZone = "Asia/Jakarta",
  seconds = true,
): string {
  if (!value || !Number.isFinite(Date.parse(value)))
    return locale === "id" ? "Belum tercatat" : "Not recorded";
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    timeZoneName: "short",
    hourCycle: "h23",
  }).format(new Date(value));
}
export function formatDate(
  value: string | null | undefined,
  locale = "en",
): string {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    return locale === "id" ? "Belum diisi" : "Not set";
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value + "T00:00:00Z"));
}
export function localDate(value: string, timeZone: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function timestampParts(
  value: string | null | undefined,
  locale: string,
  timeZone: string,
) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const language = locale === "id" ? "id-ID" : "en-GB";
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat(language, {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat(language, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).format(date),
  };
}
