function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatDateInput(value) {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(value) {
  if (!value) {
    return "";
  }

  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDisplayDateTime(value) {
  const datePart = formatDisplayDate(value);
  if (!datePart) {
    return "";
  }

  const date = new Date(value);
  return `${datePart} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDisplayDate(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return normalizeDateParts(Number(year), Number(month), Number(day));
  }

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return normalizeDateParts(Number(year), Number(month), Number(day));
  }

  return null;
}

function normalizeDateParts(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad(month)}-${pad(day)}`;
}
