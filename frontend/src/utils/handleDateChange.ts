export function formatDateForApi(dateValue: string): string | null {
  if (!dateValue) return null;

  // Create date at UTC midnight to prevent timezone shifts
  // This ensures the date stays consistent regardless of user's timezone
  const [year, month, day] = dateValue.split('-');
  const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
  return date.toISOString();
}

export function getTodayDate(): string {
  const today = new Date();

  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
