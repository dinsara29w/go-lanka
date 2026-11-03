import { describe, expect, it } from "vitest";

import { bookingFormSchema, bookingRequestSchema } from "@/lib/validation/booking";

const valid = {
  name: "Test Traveller",
  email: "TRAVELLER@example.com",
  phone: "+94770000000",
  country: "LK",
  travelDate: "2027-02-15",
  adults: 2,
  children: 0,
  message: "A test request.",
  website: "",
  packageId: "123e4567-e89b-12d3-a456-426614174000",
  turnstileToken: "test-token",
  idempotencyKey: "12345678-1234-1234-1234-123456789012",
};

describe("booking validation", () => {
  it("normalises the email and accepts a valid request", () => {
    const parsed = bookingRequestSchema.parse(valid);
    expect(parsed.email).toBe("traveller@example.com");
  });

  it("rejects malformed dates", () => {
    expect(bookingFormSchema.safeParse({ ...valid, travelDate: "15/02/2027" }).success).toBe(false);
  });

  it("rejects zero adults", () => {
    expect(bookingFormSchema.safeParse({ ...valid, adults: 0 }).success).toBe(false);
  });

  it("rejects unknown server fields", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, extra: "value" }).success).toBe(false);
  });

  it("requires a turnstile token and idempotency key", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, turnstileToken: "" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...valid, idempotencyKey: "short" }).success).toBe(
      false,
    );
  });
});
