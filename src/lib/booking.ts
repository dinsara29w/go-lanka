import { strings } from "@/content/strings";

export type BookingStatus = "new" | "confirmed" | "cancelled" | "completed";

export const BOOKING_STATUSES: BookingStatus[] = ["new", "confirmed", "cancelled", "completed"];

export function bookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "new":
      return strings.admin.statusNew;
    case "confirmed":
      return strings.admin.statusConfirmed;
    case "cancelled":
      return strings.admin.statusCancelled;
    case "completed":
      return strings.admin.statusCompleted;
  }
}

export function bookingStatusClass(status: BookingStatus): string {
  switch (status) {
    case "new":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "confirmed":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "cancelled":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "completed":
      return "border-border bg-muted text-muted-foreground";
  }
}
