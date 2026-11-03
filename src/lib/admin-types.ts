export type AdminSaveState = {
  error?: string;
};

export type GalleryImage = {
  path: string;
  alt: string;
};

export type AdminItineraryDay = {
  dayNumber: number;
  title: string;
  description: string;
  destinationId: string | null;
  accommodation: string;
  meals: string[];
};

export type AdminDestinationOption = {
  id: string;
  name: string;
  slug: string;
  region: string;
};

export type AdminPackageData = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  durationDays: number;
  basePriceLkr: number;
  dailyRateLkr: number;
  tier: "economy" | "star" | "luxury";
  activities: string[];
  inclusions: string[];
  exclusions: string[];
  isPublished: boolean;
  featured: boolean;
  heroImage: string | null;
  heroImageAlt: string | null;
  gallery: GalleryImage[];
  destinationIds: string[];
  itinerary: AdminItineraryDay[];
};

export type AdminDestinationData = {
  id: string;
  name: string;
  slug: string;
  region: string;
  description: string;
  heroImage: string | null;
  heroImageAlt: string | null;
  mapRegionId: string;
  lat: number | null;
  lng: number | null;
  bestSeason: string | null;
  highlights: string[];
};
