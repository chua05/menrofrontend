const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function parseLocalEventTime(dateValue, timeValue, fallbackTime) {
  const dateParts = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeParts = String(timeValue || fallbackTime).match(TIME_PATTERN);
  if (!dateParts || !timeParts) return null;

  const [, year, month, day] = dateParts.map(Number);
  const [, hour, minute] = timeParts.map(Number);
  if (hour > 23 || minute > 59) return null;

  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day
  ) {
    return null;
  }

  return value;
}

export function getEventDateRange(event) {
  const start = parseLocalEventTime(event?.date, event?.startTime, "00:00");
  const end = parseLocalEventTime(event?.date, event?.endTime, "23:59");
  if (!start || !end) return null;

  if (end < start) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

export function getEventStatus(event, currentTime = new Date()) {
  const range = getEventDateRange(event);
  if (!range) return "Upcoming";

  const now = currentTime instanceof Date ? currentTime : new Date(currentTime);
  if (now > range.end) return "Completed";
  if (now >= range.start) return "Ongoing";
  return "Upcoming";
}

export function getEventStatusClass(status) {
  return String(status || "upcoming").trim().toLowerCase().replaceAll(" ", "-");
}
