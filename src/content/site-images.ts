/**
 * Static photography for page banners and decorative tiles.
 *
 * Every photo is of one of the client's eight main destinations and is stored in
 * public/places/ (no hotlinking). Photographer, licence and source for each file are
 * in src/content/photo-credits.ts and shown at /credits. Replace these with the
 * client's own photos (preferred) before launch.
 *
 * Package, destination and traveller photos come from the database; these are
 * used only where the app has no uploaded image.
 */
export type SiteImage = { src: string; alt: string };

export const siteImages = {
  colombo: { src: "/places/colombo.jpg", alt: "Sunset over the sea at Galle Face, Colombo" },
  colomboSkyline: {
    src: "/places/colombo-2.jpg",
    alt: "Colombo skyline with the Lotus Tower",
  },
  pinnawala: {
    src: "/places/pinnawala.jpg",
    alt: "A herd of elephants at the Pinnawala Elephant Orphanage",
  },
  anuradhapura: {
    src: "/places/anuradhapura.jpg",
    alt: "Ruwanwelisaya stupa in Anuradhapura",
  },
  jetavanaramaya: {
    src: "/places/anuradhapura-2.jpg",
    alt: "Jetavanaramaya stupa in Anuradhapura",
  },
  sigiriya: { src: "/places/sigiriya.jpg", alt: "Climbing the Sigiriya rock fortress" },
  sigiriyaRock: { src: "/places/sigiriya-2.jpg", alt: "Sigiriya rock seen across the forest" },
  kandy: {
    src: "/places/kandy.jpg",
    alt: "Temple of the Tooth beside Kandy Lake",
  },
  kandyTemple: {
    src: "/places/kandy-2.jpg",
    alt: "White walls and moat of the Temple of the Tooth in Kandy",
  },
  nuwaraEliya: { src: "/places/nuwara-eliya.jpg", alt: "Tea estate near Nuwara Eliya" },
  gregoryLake: { src: "/places/nuwara-eliya-2.jpg", alt: "Gregory Lake in Nuwara Eliya" },
  ella: { src: "/places/ella.jpg", alt: "Green mountains above Ella" },
  ellaHills: { src: "/places/ella-2.jpg", alt: "Ella Rock rising over the hill country" },
  downSouth: {
    src: "/places/down-south.jpg",
    alt: "Aerial view of Mirissa beach and the south coast",
  },
  unawatuna: { src: "/places/down-south-2.jpg", alt: "Unawatuna beach on the south coast" },
} satisfies Record<string, SiteImage>;

export type SiteImageKey = keyof typeof siteImages;

/** Fallback photos used in rotation where a package or destination has no upload. */
export const fallbackImageOrder: SiteImageKey[] = [
  "sigiriya",
  "downSouth",
  "kandy",
  "ella",
  "pinnawala",
  "anuradhapura",
  "nuwaraEliya",
  "colombo",
];

export function fallbackImage(index: number): SiteImage {
  return siteImages[fallbackImageOrder[index % fallbackImageOrder.length]];
}
