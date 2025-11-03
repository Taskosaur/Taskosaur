export function formatDateForApi(dateValue: string): string | null {
  if (!dateValue) return null;

  return new Date(dateValue + "T00:00:00.000Z").toISOString();
}

export function getTodayDate(): string {
  const today = new Date();

  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
