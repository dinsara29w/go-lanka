/**
 * Static photography for page banners and decorative tiles.
 *
 * Source: Wikimedia Commons (see handoff/PHOTO_SOURCES.md). Licences differ per
 * file: check each file's Commons page and add the required attribution, or
 * replace these with the client's own photos (preferred) before launch.
 *
 * Package, destination and traveller photos come from the database; these are
 * used only where the app has no uploaded image.
 */
const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1600`;

export type SiteImage = { src: string; alt: string };

export const siteImages = {
  sigiriya: { src: commons("Sigiriya.jpg"), alt: "Sigiriya rock fortress" },
  pidurangala: {
    src: commons("Sigiriya Rock Fortress View from Pidurangala Rock.jpg"),
    alt: "Sigiriya seen from Pidurangala rock",
  },
  ella: { src: commons("Nine Arch Bridge, Demodara Ella.jpg"), alt: "Nine Arch Bridge in Ella" },
  galle: {
    src: commons("GALLE FORT AND LIGHTHOUSE GALLE SRI LANKA JAN2013 (8510167078).jpg"),
    alt: "Galle Fort and lighthouse at sunset",
  },
  polonnaruwa: {
    src: commons("LK-polonnaruwa-gal-vihara-01.jpg"),
    alt: "Gal Vihara at Polonnaruwa",
  },
  kandy: {
    src: commons("Temple of the Tooth, Sitting Buddha statues.- Kandy.jpg"),
    alt: "Temple of the Tooth in Kandy",
  },
  leopard: {
    src: commons("Sri Lankan Leopard (Panthera pardus kotiya).jpg"),
    alt: "Sri Lankan leopard",
  },
  hills: {
    src: commons(
      "Scenery on Hill Country Train Line - From Ella to Kandy - Sri Lanka - 05 (13944395408).jpg",
    ),
    alt: "Tea hills in the hill country",
  },
  tea: {
    src: commons("Sri Lanka, Tea plantations near Nuwara Eliya.jpg"),
    alt: "Tea plantations near Nuwara Eliya",
  },
  elephant: {
    src: commons("Elephants at Minneriya National Park, Sri Lanka.jpg"),
    alt: "Elephants at Minneriya National Park",
  },
  mirissa: { src: commons("Mirissa-Plage (3).jpg"), alt: "Mirissa beach" },
} satisfies Record<string, SiteImage>;

export type SiteImageKey = keyof typeof siteImages;

/** Fallback photos used in rotation where a package or destination has no upload. */
export const fallbackImageOrder: SiteImageKey[] = [
  "polonnaruwa",
  "mirissa",
  "galle",
  "hills",
  "pidurangala",
  "ella",
  "elephant",
  "kandy",
  "leopard",
  "tea",
  "sigiriya",
];

export function fallbackImage(index: number): SiteImage {
  return siteImages[fallbackImageOrder[index % fallbackImageOrder.length]];
}
