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

/** Full-bleed photo slideshow behind the home hero, with play/pause, dots and a photo caption. */
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

  const n = slides.length;
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 -z-20">
        {slides.map((slide, index) => {
          // Only the current, previous (fading out) and next (preloading) photos are mounted.
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

      <div className="absolute inset-x-0 bottom-24 sm:bottom-28">
        <div className="mx-auto flex max-w-[75rem] items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setUserPlaying(!playing)}
            aria-label={playing ? strings.home.slideshowPause : strings.home.slideshowPlay}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            {playing ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7 5v14l12-7z" />
              </svg>
            )}
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`${strings.home.slideshowShow} ${index + 1}: ${slide.alt}`}
                aria-pressed={index === active}
                className={cn(
                  "relative h-1.5 overflow-hidden rounded-full transition-all duration-300 motion-reduce:transition-none",
                  index === active ? "w-9 bg-white/40" : "w-1.5 bg-white/55 hover:bg-white/80",
                )}
              >
                {index === active ? (
                  <span
                    key={`${active}-${playing}`}
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full bg-gold",
                      playing ? "animate-slide-progress" : "w-full",
                    )}
                    style={playing ? { animationDuration: `${SLIDE_MS}ms` } : undefined}
                  />
                ) : null}
              </button>
            ))}
          </div>
          <p
            className="ml-auto hidden text-xs font-semibold text-white/80 sm:block"
            aria-live="off"
          >
            {slides[active]?.alt}
          </p>
        </div>
      </div>
    </>
  );
}
