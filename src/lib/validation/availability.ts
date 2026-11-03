import { z } from "zod";

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

export const availabilityRangeSchema = z
  .object({
    packageId: z.string().uuid(),
    startDate: dateString,
    endDate: dateString,
    capacity: z.number().int().min(1).max(1000),
    status: z.enum(["open", "limited", "closed"]),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "The end date must be on or after the start date.",
    path: ["endDate"],
  })
  .refine(
    (value) => {
      const start = new Date(`${value.startDate}T00:00:00Z`).getTime();
      const end = new Date(`${value.endDate}T00:00:00Z`).getTime();
      return (end - start) / 86_400_000 <= 366;
    },
    { message: "Choose a range of 366 days or fewer.", path: ["endDate"] },
  );

export type AvailabilityRangeInput = z.infer<typeof availabilityRangeSchema>;
