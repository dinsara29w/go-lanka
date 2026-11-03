import { describe, expect, it } from "vitest";

import { contactFormSchema, contactRequestSchema } from "@/lib/validation/contact";

const valid = {
  name: "Test Traveller",
  email: "TRAVELLER@example.com",
  phone: "+94770000000",
  message: "I would like to ask about a custom trip in February.",
  website: "",
  turnstileToken: "test-token",
};

describe("contact validation", () => {
  it("normalises email and accepts a valid request", () => {
    const parsed = contactRequestSchema.parse(valid);
    expect(parsed.email).toBe("traveller@example.com");
    expect(parsed.name).toBe("Test Traveller");
  });

  it("accepts an omitted phone number", () => {
    const withoutPhone = {
      name: valid.name,
      email: valid.email,
      message: valid.message,
      website: valid.website,
      turnstileToken: valid.turnstileToken,
    };
    expect(contactRequestSchema.safeParse(withoutPhone).success).toBe(true);
  });

  it("rejects short messages", () => {
    expect(contactFormSchema.safeParse({ ...valid, message: "Too short" }).success).toBe(false);
  });

  it("rejects invalid email addresses", () => {
    expect(contactFormSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects unknown fields on the server schema", () => {
    expect(contactRequestSchema.safeParse({ ...valid, unexpected: "value" }).success).toBe(false);
  });
});
