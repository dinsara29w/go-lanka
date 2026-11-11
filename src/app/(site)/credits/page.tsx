import type { Metadata } from "next";
import Image from "next/image";

import { PageBanner } from "@/components/site/section";
import { photoCredits } from "@/content/photo-credits";
import { siteImages } from "@/content/site-images";

export const metadata: Metadata = {
  title: "Photo credits",
  description:
    "Who took the photographs of Sri Lanka used on this website, and under which licence.",
  alternates: { canonical: "/credits" },
};

export default function CreditsPage() {
  return (
    <>
      <PageBanner
        title="Photo credits"
        intro="The destination photos on this site are real pictures of each place, shared by their photographers on Wikimedia Commons. Thank you."
        image={siteImages.kandy}
        crumbs={[{ label: "Photo credits" }]}
      />
      <section className="mx-auto max-w-[60rem] px-4 py-14 sm:px-6 lg:px-0">
        <ul className="grid gap-5 sm:grid-cols-2">
          {photoCredits.map((credit) => (
            <li
              key={credit.file}
              className="flex gap-4 rounded-2xl border border-line bg-white p-3 shadow-card"
            >
              <Image
                src={credit.file}
                alt=""
                width={112}
                height={84}
                sizes="112px"
                className="h-[5.25rem] w-28 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 text-sm leading-snug">
                <p className="font-heading font-bold text-ink">{credit.place}</p>
                <p className="mt-1 text-stone">
                  Photo by <b className="text-ink">{credit.author}</b>
                </p>
                <p className="mt-1">
                  <a
                    href={credit.licenseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand hover:underline"
                  >
                    {credit.license}
                  </a>
                  {" · "}
                  <a
                    href={credit.source}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand hover:underline"
                  >
                    Original
                  </a>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
