"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "cn";

import type { SiteImage } from "@/content/site-images";
import { strings } from "@/content/strings";

const SLIDE_MS = 6000;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION).matches;
}

/** Full-bleed photo slideshow behind the home hero, with play/pause and thumbnails. */
export function HeroSlideshow({ slides }: { slides: SiteImage[] }) {
  const [active, setActive] = useState(0);
  // null until the visitor presses play/pause; until then reduced-motion decides.
  const [userPlaying, setUserPlaying] = useState<boolean | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  const playing = userPlaying ?? !reducedMotion;

  useEffect(() => {
    if (!playing || slides.length < 2) return;
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [active, playing, slides.length]);

  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 -z-20">
        {slides.map((slide, index) => {
          // Only the current, previous (fading out) and next (preloading) photos are mounted.
          const n = slides.length;
          const near =
            index === active || index === (active + 1) % n || index === (active - 1 + n) % n;
          if (!near) return null;
          return (
            <Image
              key={slide.src}
              src={slide.src}
              alt=""
              fill
              preload={index === 0}
              sizes="100vw"
              className={cn(
                "object-cover transition-opacity duration-1000 motion-reduce:transition-none",
                index === active ? "opacity-100" : "opacity-0",
              )}
            />
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 px-4 sm:bottom-14">
        <div className="flex w-full max-w-[48.75rem] items-center gap-3.5">
          <button
            type="button"
            onClick={() => setUserPlaying(!playing)}
            aria-label={playing ? strings.home.slideshowPause : strings.home.slideshowPlay}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(16,33,26,0.15)]"
          >
            {playing ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#0F7B4A" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#0F7B4A" aria-hidden="true">
                <path d="M7 5v14l12-7z" />
              </svg>
            )}
          </button>
          <span
            aria-hidden="true"
            className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35"
          >
            <span
              key={`${active}-${playing}`}
              className={cn(
                "block h-full rounded-full bg-white",
                playing ? "animate-slide-progress" : "w-full",
              )}
              style={playing ? { animationDuration: `${SLIDE_MS}ms` } : undefined}
            />
          </span>
        </div>
        <div className="hidden gap-1.5 rounded-[0.875rem] bg-white/90 p-1.5 shadow-[0_6px_24px_rgba(16,33,26,0.12)] sm:flex">
          {slides.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${strings.home.slideshowShow} ${index + 1}: ${slide.alt}`}
              aria-pressed={index === active}
              className={cn(
                "relative block h-9 w-[3.375rem] overflow-hidden rounded-md border-2",
                index === active ? "border-brand" : "border-transparent",
              )}
            >
              <Image src={slide.src} alt="" fill sizes="54px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
