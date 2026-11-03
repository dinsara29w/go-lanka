import "server-only";

import { randomBytes } from "node:crypto";

export function generateBookingReference(): string {
  return `GL-${randomBytes(5).toString("hex").toUpperCase()}`;
}
