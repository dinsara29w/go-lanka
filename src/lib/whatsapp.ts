export function buildWhatsAppUrl(number: string, message: string): string | null {
  const normalized = number.replace(/[^\d]/g, "");
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
