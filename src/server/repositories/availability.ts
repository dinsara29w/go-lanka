import "server-only";

import { getAdminPool, getPublicPool } from "@/server/db/pools";

export type PublicAvailability = {
  date: string;
  capacity: number;
  booked: number;
  pending: number;
  remaining: number;
  status: string;
};

export async function getPublicAvailability(packageId: string): Promise<PublicAvailability[]> {
  const result = await getPublicPool().query<PublicAvailability>(
    `SELECT date::text AS date, capacity, booked, pending, remaining, status
     FROM get_public_availability($1::uuid)`,
    [packageId],
  );
  return result.rows;
}

export type AdminAvailabilityRow = {
  date: string;
  capacity: number;
  booked: number;
  status: string;
};

export async function getAvailabilityForMonth(
  packageId: string,
  startDate: string,
  endDate: string,
): Promise<AdminAvailabilityRow[]> {
  const result = await getAdminPool().query<AdminAvailabilityRow>(
    `SELECT date::text AS date, capacity, booked, status
     FROM availability
     WHERE package_id = $1::uuid
       AND date >= $2::date
       AND date < $3::date
     ORDER BY date ASC`,
    [packageId, startDate, endDate],
  );
  return result.rows;
}
