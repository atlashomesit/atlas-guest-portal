export interface IcsEvent {
  summary: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  location?: string;
}

/** Formats a date as YYYYMMDD for ICS (all-day event) */
function toIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

export function generateIcsContent(event: IcsEvent): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Atlas PMS//Atlas Homestays//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${toIcsDate(event.startDate)}`,
    `DTEND;VALUE=DATE:${toIcsDate(event.endDate)}`,
    `SUMMARY:${event.summary}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    event.location ? `LOCATION:${event.location}` : '',
    `DTSTAMP:${now}`,
    `UID:atlas-booking-${Date.now()}@atlashomestays.com`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

export function downloadIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
