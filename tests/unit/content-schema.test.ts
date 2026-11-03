import { describe, expect, it } from "vitest";

import { reviewSchema } from "@/lib/validation/review";
import { travelInfoSchema } from "@/lib/validation/travel-info";

const validReview = {
  packageId: "123e4567-e89b-12d3-a456-426614174000",
  authorName: "Test Traveller",
  country: "UK",
  rating: 5,
  title: "Wonderful trip",
  body: "A detailed and helpful review body.",
  isVerified: true,
  isPublished: true,
};

describe("review validation", () => {
  it("accepts a valid review", () => {
    expect(reviewSchema.safeParse(validReview).success).toBe(true);
  });

  it("rejects ratings outside 1–5", () => {
    expect(reviewSchema.safeParse({ ...validReview, rating: 6 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...validReview, rating: 0 }).success).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(reviewSchema.safeParse({ ...validReview, body: "" }).success).toBe(false);
  });
});

describe("travel information validation", () => {
  const validSection = {
    slug: "visa",
    title: "Visa information",
    summary: "Entry requirements.",
    body: "TODO: verify this before launch.",
    bullets: ["Bring a passport"],
    faqs: [{ question: "Do I need a visa?", answer: "Check the official portal." }],
    sortOrder: 1,
    isPublished: true,
  };

  it("accepts a valid section", () => {
    expect(travelInfoSchema.safeParse(validSection).success).toBe(true);
  });

  it("rejects an invalid slug", () => {
    expect(travelInfoSchema.safeParse({ ...validSection, slug: "Not Valid" }).success).toBe(false);
  });

  it("rejects incomplete FAQs", () => {
    expect(
      travelInfoSchema.safeParse({
        ...validSection,
        faqs: [{ question: "", answer: "Answer" }],
      }).success,
    ).toBe(false);
  });
});
