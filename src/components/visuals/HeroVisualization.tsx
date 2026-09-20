"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "@/providers/TranslationsProvider";

export function HeroVisualization() {
  const [demoOpen, setDemoOpen] = useState(false);
  const { locale } = useTranslations();
  const copy =
    locale === "nl"
      ? {
          caption: "Echte BelgoBase-interface met duidelijk fictieve voorbeeldgegevens.",
          demo: "Bekijk de korte productdemo",
          closeDemo: "Sluit de productdemo",
          transcript:
            "Demo: zoeken naar een onderneming, het bedrijfsprofiel openen, grafieken bekijken en de financiële tabel raadplegen.",
          fallback: "Download de productdemo",
        }
      : {
          caption:
            "Genuine BelgoBase interface with clearly fictional example data; interface shown in Dutch.",
          demo: "Watch the short product demo",
          closeDemo: "Close the product demo",
          transcript:
            "Demo: search for a company, open its profile, review charts and inspect the financial table.",
          fallback: "Download the product demo",
        };

  return (
    <figure className="w-full min-w-0">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#07152f] shadow-[0_28px_80px_-32px_rgba(5,18,45,0.7)] sm:rounded-3xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#0a1b3a] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3978ff]" />
          </div>
          <span className="truncate text-[11px] font-medium tracking-wide text-white/70 sm:text-xs">
            BelgoBase
          </span>
        </div>

        {demoOpen ? (
          <div id="hero-product-demo" className="bg-black p-1.5 sm:p-2">
            <video
              controls
              playsInline
              preload="none"
              poster="/product/belgobase-workspace.webp"
              width={1600}
              height={1000}
              className="aspect-[8/5] h-auto w-full rounded-lg bg-black"
              aria-describedby="hero-demo-transcript"
            >
              <source src="/product/belgobase-demo.webm" type="video/webm" />
              <a href="/product/belgobase-demo.webm" download>
                {copy.fallback}
              </a>
            </video>
            <p
              id="hero-demo-transcript"
              className="px-3 py-3 text-xs leading-5 text-white/70 sm:text-sm"
            >
              {copy.transcript}
            </p>
          </div>
        ) : (
          <div id="hero-product-demo" className="bg-[#e8edf4] p-1.5 sm:p-2">
            <Image
              src="/product/belgobase-workspace.webp"
              alt={locale === "nl" ? "BelgoBase-zoekresultaten met regiofilters en Excel-export; fictieve voorbeeldbedrijven" : "BelgoBase company search with regional filters and Excel export; fictional example companies"}
              width={1600}
              height={1000}
              preload
              sizes="(min-width: 1280px) 720px, (min-width: 1024px) 56vw, 94vw"
              className="h-auto w-full rounded-lg"
            />
          </div>
        )}
        <button
          type="button"
          aria-expanded={demoOpen}
          aria-controls="hero-product-demo"
          onClick={() => setDemoOpen((open) => !open)}
          className="flex w-full cursor-pointer items-center justify-center border-t border-white/10 bg-[#0a1b3a] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#10264e] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white/80"
        >
          {demoOpen ? copy.closeDemo : copy.demo}
        </button>
      </div>
      <figcaption className="mt-3 text-center text-xs leading-relaxed text-muted sm:text-sm">
        {copy.caption}
      </figcaption>
    </figure>
  );
}
