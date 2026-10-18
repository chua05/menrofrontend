const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function parseLocalEventTime(dateValue, timeValue, fallbackTime) {
  const dateParts = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeParts = String(timeValue || fallbackTime).match(TIME_PATTERN);
  if (!dateParts || !timeParts) return null;

  const [, year, month, day] = dateParts.map(Number);
  const [, hour, minute] = timeParts.map(Number);
  if (hour > 23 || minute > 59) return null;

  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 ||
      calendarCheck.getUTCDate() !== day) return null;
  const value = new Date(`${dateValue}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`);
  if (Number.isNaN(value.getTime())) return null;

  return value;
}

export function getEventDateRange(event) {
  const start = parseLocalEventTime(event?.date, event?.startTime);
  const end = parseLocalEventTime(event?.date, event?.endTime, "23:59");
  if (!start || !end) return null;

  if (end < start) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

export function getEventStatus(event, currentTime = new Date()) {
  const range = getEventDateRange(event);
  if (!range) return "Invalid Schedule";

  const now = currentTime instanceof Date ? currentTime : new Date(currentTime);
  if (now > range.end) return "Completed";
  if (now >= range.start) return "Ongoing";
  return "Upcoming";
}

export function getEventStatusClass(status) {
  return String(status || "upcoming").trim().toLowerCase().replaceAll(" ", "-");
}
