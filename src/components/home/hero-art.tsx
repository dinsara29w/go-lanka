import { MapPinned, MessageCircle } from "lucide-react";

import { strings } from "@/content/strings";

export function HeroArt() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <div
        aria-hidden="true"
        className="absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_55%_35%,rgba(201,150,43,0.16),transparent_62%)]"
      />

      <svg viewBox="0 0 560 660" fill="none" aria-hidden="true" className="w-full">
        <defs>
          <linearGradient
            id="hero-sky"
            x1="280"
            y1="0"
            x2="280"
            y2="660"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#12635c" />
            <stop offset="0.55" stopColor="#0e4f4a" />
            <stop offset="1" stopColor="#0a3b37" />
          </linearGradient>
          <linearGradient
            id="hero-sea"
            x1="280"
            y1="390"
            x2="280"
            y2="660"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#0b423d" />
            <stop offset="1" stopColor="#072b28" />
          </linearGradient>
          <clipPath id="hero-arch">
            <path d="M60 640V270a220 220 0 0 1 440 0v370Z" />
          </clipPath>
        </defs>

        <g stroke="#C9962B" strokeOpacity="0.2">
          <circle cx="280" cy="300" r="252" />
          <circle cx="280" cy="300" r="284" strokeDasharray="2 11" />
        </g>

        <g clipPath="url(#hero-arch)">
          <rect width="560" height="660" fill="url(#hero-sky)" />

          <circle cx="280" cy="286" r="120" fill="#C9962B" fillOpacity="0.1" />
          <circle cx="280" cy="286" r="90" fill="#C9962B" fillOpacity="0.2" />
          <circle cx="280" cy="286" r="64" fill="#C9962B" />

          <path
            d="M0 394c46-26 84-24 118-8 34-30 78-30 110-2 32-20 64-16 92 10 30-10 58-6 80 8 22-8 42-4 60 6v30H0Z"
            fill="#FAF6EE"
            fillOpacity="0.08"
          />

          <rect y="392" width="560" height="268" fill="url(#hero-sea)" />

          <g stroke="#FAF6EE" strokeLinecap="round" fill="none">
            <path
              d="M32 424c30-10 58-10 88 0s58 10 88 0 58-10 88 0 58 10 88 0 58-10 88 0 46 7 64 3"
              strokeOpacity="0.3"
              strokeWidth="2"
            />
            <path
              d="M18 468c30-10 58-10 88 0s58 10 88 0 58-10 88 0 58 10 88 0 58-10 88 0 46 7 64 3"
              strokeOpacity="0.18"
              strokeWidth="2"
            />
            <path
              d="M44 516c30-10 58-10 88 0s58 10 88 0 58-10 88 0 58 10 88 0 46-7 64-3"
              strokeOpacity="0.13"
              strokeWidth="2"
            />
            <path
              d="M8 566c30-10 58-10 88 0s58 10 88 0 58-10 88 0 58 10 88 0 58-10 88 0"
              strokeOpacity="0.09"
              strokeWidth="2"
            />
          </g>

          {/* Stupa on the horizon */}
          <g fill="#FAF6EE" fillOpacity="0.26">
            <path d="M394 392c0-17 10-30 25-30s25 13 25 30Z" />
            <path d="M416.5 362h5v-20h-5z" />
            <circle cx="419" cy="338" r="3.5" />
            <path d="M382 392h74v5h-74z" fillOpacity="0.5" />
          </g>

          {/* Outrigger on the water */}
          <g fill="#FAF6EE" fillOpacity="0.55">
            <path d="M150 512h74l-10 12h-54z" />
            <path d="M188 512v-50l34 42Z" />
            <path d="M120 528h126v2H120z" fillOpacity="0.35" />
          </g>

          {/* Fronds framing the arch */}
          <g stroke="#FAF6EE" strokeOpacity="0.16" strokeLinecap="round" fill="none">
            <path d="M62 44c58 30 88 82 90 142" strokeWidth="3" />
            <path d="M82 66c-18 10-30 24-36 44M98 86c-20 8-34 22-42 40M114 110c-20 6-36 18-46 34M128 140c-18 4-32 14-42 28M140 172c-14 4-26 12-34 24" strokeWidth="2" />
          </g>
          <g stroke="#FAF6EE" strokeOpacity="0.16" strokeLinecap="round" fill="none" transform="translate(560 0) scale(-1 1)">
            <path d="M62 44c58 30 88 82 90 142" strokeWidth="3" />
            <path d="M82 66c-18 10-30 24-36 44M98 86c-20 8-34 22-42 40M114 110c-20 6-36 18-46 34" strokeWidth="2" />
          </g>

          {/* Birds */}
          <g stroke="#FAF6EE" strokeOpacity="0.5" strokeLinecap="round" strokeWidth="2" fill="none">
            <path d="M206 214c4-4 7-4 11 0 4-4 7-4 11 0" />
            <path d="M236 194c3-3 5-3 8 0 3-3 5-3 8 0" />
            <path d="M190 246c3-3 5-3 8 0 3-3 5-3 8 0" />
          </g>
        </g>

        <path
          d="M60 640V270a220 220 0 0 1 440 0v370"
          stroke="#FAF6EE"
          strokeOpacity="0.22"
          strokeWidth="2"
        />
      </svg>

      <div className="absolute top-6 right-0 hidden rounded-2xl border border-ink/10 bg-ivory/95 px-4 py-3 shadow-lift sm:block">
        <p className="flex items-center gap-2 font-heading text-sm font-semibold text-ocean">
          <MapPinned aria-hidden="true" className="size-4" />
          {strings.home.mapTeaserLabel}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{strings.home.mapTeaserBody}</p>
      </div>

      <div className="absolute bottom-8 left-0 hidden rounded-2xl border border-ink/10 bg-ivory/95 px-4 py-3 shadow-lift sm:block">
        <p className="flex items-center gap-2 font-heading text-sm font-semibold text-ocean">
          <MessageCircle aria-hidden="true" className="size-4" />
          {strings.home.directContactLabel}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{strings.home.directContactBody}</p>
      </div>
    </div>
  );
}
