"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";

const guidedTranscript = {
  "nl": "Ik laat je zien hoe je van je verhaal naar een bruikbare klantenlijst gaat. We gebruiken fictieve voorbeeldgegevens. Begin met een korte beschrijving van je aanbod en doelgroep. BelgoBase zet dat verhaal om in een concreet, controleerbaar voorstel. Je kunt een bestaande klantenlijst toevoegen als context. Zo ziet BelgoBase welke soorten bedrijven al bij je passen. Klik op Lijst analyseren. Bekijk wat BelgoBase uit je bestaande klantenlijst haalt. Bekijk daarna de voorgestelde doelgroep. Controleer de omschrijving voordat je de zoekopdracht uitvoert. Met Vind deze bedrijven verschijnt de selectie. Je ziet locatie, omzet, resultaat, personeel en bronjaar in dezelfde werkruimte. Vink de bedrijven aan die je verder wilt gebruiken. Hier kiezen we drie voorbeelden. Kies Contactgegevens aanvullen en gebruik de huidige zoekselectie. BelgoBase maakt dan een afgebakende contacttaak. Bekijk de raming en de kostenlimiet. Als alles klopt, start je het contactonderzoek. Na de controle zie je welke contactgegevens gevonden zijn en welke rij nog nagekeken moet worden. Exporteer vervolgens de geverifieerde contacten. Bevestig pas na de download dat je het bestand hebt ontvangen. Zo bewaart BelgoBase de juiste behandelingsstatus. Je lijst staat nu in Excel, klaar om verder mee te werken. In BelgoBase kun je je selectie bewaren of verder verfijnen.",
  "en": "I'll show you how to go from your story to a useful prospect list. We use fictional sample data. Start with a short description of what you offer and whom you want to reach. BelgoBase turns your story into a concrete proposal you can review. You can add an existing customer list as context, helping BelgoBase understand which types of companies fit your business. Click Analyse list and review what BelgoBase finds in it. Check the proposed target market before running your search. Find these companies displays the selection, with location, revenue, profit, employees and source year. Tick the companies you want to use; here we choose three examples. Choose Enrich contact details and use the current search selection. BelgoBase prepares a contact research task. Review the estimate and cost limit, then start the research when everything looks right. Afterwards, you can see which details were found and which row still needs review. Export the verified contacts. Confirm receipt only after downloading the file, so BelgoBase records the correct processing status. Your list is now in Excel, ready to use. You can save or refine your selection in BelgoBase."
};

export function HeroVisualization() {
  const { locale } = useTranslations();
  const nl = locale === "nl";
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [guided, setGuided] = useState(false);
  const source = guided ? "/product/belgobase-guided-demo.mp4" : "/product/belgobase-journey-demo.mp4";
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (!guided && preference.matches) video.current?.pause();
      else void video.current?.play().catch(() => setPlaying(false));
    };
    apply();
    preference.addEventListener("change", apply);
    return () => preference.removeEventListener("change", apply);
  }, [guided]);
  const switchMode = () => {
    video.current?.pause();
    setFailed(false);
    setPlaying(false);
    setGuided(!guided);
  };
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
      <video key={guided ? "guided" : "preview"} ref={video} id="hero-product-demo" controls loop={!guided} muted={!guided} playsInline preload="metadata"
        poster={guided ? "/product/belgobase-guided-poster.webp" : "/product/belgobase-journey-poster.webp"} width={1600} height={1000}
        className="aspect-[8/5] h-auto w-full bg-[#f5f6fa] [&::cue]:text-xs sm:[&::cue]:text-base" aria-label={guided ? (nl ? "BelgoBase: stap voor stap met gesproken uitleg" : "BelgoBase: step-by-step tour with Dutch narration") : (nl ? "BelgoBase productdemo: drie voorbeelden van gesprek tot Excel" : "BelgoBase product demo: three examples from conversation to Excel")}
        aria-describedby="hero-demo-transcript" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); }}>
        <source src={source} type="video/mp4" />
        {!guided && <source src="/product/belgobase-journey-demo.webm" type="video/webm" />}
        <track key={locale} kind="captions" src={guided ? `/product/belgobase-guided-captions-${locale}.vtt` : (nl ? "/product/belgobase-journey-captions.vtt" : "/product/belgobase-journey-captions-en.vtt")} srcLang={locale} label={nl ? "Nederlands" : "English"} default />
        <a href={source}>{nl ? "Open de productdemo" : "Open the product demo"}</a>
      </video>
      {failed && <p role="status" className="p-5 text-base text-white">{nl ? "De video kan hier niet afspelen. Bekijk de werkwijze hieronder of" : "The video cannot play here. Explore the workflow below or"} <a className="underline" href={source}>{nl ? "open de video apart" : "open the video directly"}</a>.</p>}
    </div>
    <div className="mt-5 flex justify-center">
      <button type="button" data-demo-mode aria-pressed={guided} onClick={switchMode} className="min-h-12 rounded-full border border-border bg-surface px-6 py-3 text-base font-medium text-foreground hover:bg-muted/10 focus-visible:outline-2 focus-visible:outline-offset-4">
        {guided ? (nl ? "Terug naar de stille preview" : "Back to the silent preview") : (nl ? "Bekijk met gesproken uitleg" : "Watch the Dutch guided tour")}
      </button>
    </div>
    <figcaption className="mt-4 text-center text-sm leading-6 text-muted">{nl ? "Productdemonstratie met fictieve voorbeeldgegevens." : "Product demonstration with fictional sample data. Interface in Dutch."}</figcaption>
    <details className="mx-auto mt-3 max-w-3xl text-left text-base leading-7 text-muted">
      <summary className="cursor-pointer text-center underline underline-offset-4">{nl ? "Lees de demonstratie" : "Read the demonstration"}</summary>
      <p id="hero-demo-transcript" className="mt-4">{guided ? guidedTranscript[locale] : nl ? "Drie toepassingen volgen elkaar op: een verkoopteam beschrijft zijn aanbod en doelgroep; een marketingbureau voegt een voorbeeldklantenlijst toe; een accountant of business developer selecteert bedrijven, controleert beschikbare contactgegevens en downloadt Excel. Getoonde bedrijven en uitkomsten zijn fictieve voorbeelden." : "Three use cases follow each other: a sales team describes its offer and target market; a marketing agency adds a sample customer list; an accountant or business developer selects companies, checks available contact details and downloads Excel. The companies and results shown are fictional examples."}</p>
    </details>
  </figure>;
}
