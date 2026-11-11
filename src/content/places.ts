import type { SiteImage } from "@/content/site-images";

/**
 * The client's eight main destinations, in the order of a classic island loop.
 * The database holds the editable copy (see db/migrations/20261111100000_main_destinations.sql);
 * this list is the fallback used by the home page so it looks complete before any data exists.
 * Photos live in public/places/ and are credited at /credits.
 */
export type MainPlace = {
  slug: string;
  name: string;
  region: string;
  blurb: string;
  lat: number;
  lng: number;
  image: SiteImage;
};

export const mainPlaces: MainPlace[] = [
  {
    slug: "colombo",
    name: "Colombo",
    region: "West coast",
    blurb: "The busy capital: seafront, markets, temples and a food scene.",
    lat: 6.9271,
    lng: 79.8612,
    image: { src: "/places/colombo.jpg", alt: "Colombo skyline and seafront" },
  },
  {
    slug: "pinnawala",
    name: "Pinnawala",
    region: "Central Sri Lanka",
    blurb: "Rescued elephants and their daily river bath.",
    lat: 7.3009,
    lng: 80.3871,
    image: { src: "/places/pinnawala.jpg", alt: "Elephants at the Pinnawala Elephant Orphanage" },
  },
  {
    slug: "anuradhapura",
    name: "Anuradhapura",
    region: "Cultural Triangle",
    blurb: "An ancient sacred capital of giant white stupas.",
    lat: 8.3114,
    lng: 80.4037,
    image: { src: "/places/anuradhapura.jpg", alt: "Ruwanwelisaya stupa in Anuradhapura" },
  },
  {
    slug: "sigiriya",
    name: "Sigiriya",
    region: "Cultural Triangle",
    blurb: "The Lion Rock fortress rising out of the jungle.",
    lat: 7.957,
    lng: 80.7603,
    image: { src: "/places/sigiriya.jpg", alt: "Sigiriya Lion Rock rising above the jungle" },
  },
  {
    slug: "kandy",
    name: "Kandy",
    region: "Hill country",
    blurb: "The last royal capital, around a lake in the hills.",
    lat: 7.2906,
    lng: 80.6337,
    image: { src: "/places/kandy.jpg", alt: "Temple of the Sacred Tooth Relic in Kandy" },
  },
  {
    slug: "nuwara-eliya",
    name: "Nuwara Eliya",
    region: "Hill country",
    blurb: "Cool air, tea estates and lakes in the highlands.",
    lat: 6.9497,
    lng: 80.7891,
    image: { src: "/places/nuwara-eliya.jpg", alt: "Tea plantations near Nuwara Eliya" },
  },
  {
    slug: "ella",
    name: "Ella",
    region: "Hill country",
    blurb: "Big views, the Nine Arch Bridge and the scenic train.",
    lat: 6.8667,
    lng: 81.0466,
    image: { src: "/places/ella.jpg", alt: "Nine Arch Bridge in Ella" },
  },
  {
    slug: "down-south",
    name: "Down South",
    region: "South coast",
    blurb: "Galle Fort, palm-fringed beaches and whale watching.",
    lat: 6.0267,
    lng: 80.217,
    image: { src: "/places/down-south.jpg", alt: "Beach on the south coast" },
  },
];

export function findMainPlace(slug: string): MainPlace | undefined {
  return mainPlaces.find((place) => place.slug === slug);
}
