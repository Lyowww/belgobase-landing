"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";

export function HeroVisualization() {
  const { locale } = useTranslations();
  const nl = locale === "nl";
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (preference.matches) video.current?.pause();
      else void video.current?.play().catch(() => setPlaying(false));
    };
    apply();
    preference.addEventListener("change", apply);
    return () => preference.removeEventListener("change", apply);
  }, []);
  const toggle = () => {
    if (!video.current) return;
    if (video.current.paused) void video.current.play().catch(() => setPlaying(false));
    else video.current.pause();
  };
  return <figure id="product-demonstration" className="w-full min-w-0 scroll-mt-28">
    <div className="overflow-hidden rounded-2xl border border-border bg-[#0a1730] shadow-[0_28px_80px_-32px_rgba(5,18,45,0.5)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-white sm:px-7">
        <span className="text-base font-medium">{nl ? "Van uw verhaal naar uw volgende prospectielijst" : "From your story to your next prospect list"}</span>
        <button type="button" onClick={toggle} disabled={failed} aria-controls="hero-product-demo" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {playing ? (nl ? "Pauzeren" : "Pause") : (nl ? "Afspelen" : "Play")}
        </button>
      </div>
      <video ref={video} id="hero-product-demo" controls loop muted playsInline preload="metadata"
        poster="/product/belgobase-journey-poster.webp" width={1600} height={1000}
        className="aspect-[8/5] h-auto w-full bg-[#f5f6fa]" aria-label={nl ? "BelgoBase productdemo: drie voorbeelden van gesprek tot Excel" : "BelgoBase product demo: three examples from conversation to Excel"}
        aria-describedby="hero-demo-transcript" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); }}>
        <source src="/product/belgobase-journey-demo.mp4" type="video/mp4" />
        <source src="/product/belgobase-journey-demo.webm" type="video/webm" />
        <track key={locale} kind="captions" src={nl ? "/product/belgobase-journey-captions.vtt" : "/product/belgobase-journey-captions-en.vtt"} srcLang={locale} label={nl ? "Nederlands" : "English"} default />
        <a href="/product/belgobase-journey-demo.mp4">{nl ? "Open de productdemo" : "Open the product demo"}</a>
      </video>
      {failed && <p role="status" className="p-5 text-base text-white">{nl ? "De video kan hier niet afspelen. Bekijk de werkwijze hieronder of" : "The video cannot play here. Explore the workflow below or"} <a className="underline" href="/product/belgobase-journey-demo.mp4">{nl ? "open de video apart" : "open the video directly"}</a>.</p>}
    </div>
    <figcaption className="mt-4 text-center text-sm leading-6 text-muted">{nl ? "Productdemonstratie met fictieve voorbeeldgegevens." : "Product demonstration with fictional sample data. Interface in Dutch."}</figcaption>
    <details className="mx-auto mt-3 max-w-3xl text-left text-base leading-7 text-muted">
      <summary className="cursor-pointer text-center underline underline-offset-4">{nl ? "Lees de demonstratie" : "Read the demonstration"}</summary>
      <p id="hero-demo-transcript" className="mt-4">{nl ? "Drie toepassingen volgen elkaar op: een verkoopteam beschrijft zijn aanbod en doelgroep; een marketingbureau voegt een voorbeeldklantenlijst toe; een accountant of business developer selecteert bedrijven, controleert beschikbare contactgegevens en downloadt Excel. Getoonde bedrijven en uitkomsten zijn fictieve voorbeelden." : "Three use cases follow each other: a sales team describes its offer and target market; a marketing agency adds a sample customer list; an accountant or business developer selects companies, checks available contact details and downloads Excel. The companies and results shown are fictional examples."}</p>
    </details>
  </figure>;
}
