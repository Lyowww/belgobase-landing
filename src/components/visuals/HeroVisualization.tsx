"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
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
  const [started, setStarted] = useState(false);
  const source = "/product/belgobase-guided-demo.mp4";
  const play = () => {
    if (!video.current) return;
    video.current.muted = false;
    void video.current.play().catch(() => setPlaying(false));
  };
  return <figure id="product-demonstration" className="w-full min-w-0 scroll-mt-28">
    <div className="relative overflow-hidden rounded-2xl border border-border bg-[#0a1730] shadow-[0_28px_80px_-32px_rgba(5,18,45,0.5)]">
      <video ref={element => {
        video.current = element;
        // A failed preload can precede hydration on a cached page.
        if (element?.error) setFailed(true);
      }} id="hero-product-demo" src={source} controls playsInline preload="metadata"
        poster="/product/belgobase-guided-poster.webp" width={1600} height={1000}
        className="aspect-[8/5] h-auto w-full bg-[#f5f6fa] [&::cue]:text-xs sm:[&::cue]:text-base" aria-label={nl ? "BelgoBase: stap voor stap met gesproken uitleg" : "BelgoBase: step-by-step tour with Dutch narration"}
        aria-describedby="hero-demo-transcript" onPlay={() => { setPlaying(true); setStarted(true); }} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setStarted(false); }} onError={() => { setFailed(true); setPlaying(false); }}>
        <track key={locale} kind="captions" src={`/product/belgobase-guided-captions-${locale}.vtt`} srcLang={locale} label={nl ? "Nederlands" : "English"} default />
        <a href={source}>{nl ? "Open de productdemo" : "Open the product demo"}</a>
      </video>
      {!started && !playing && !failed && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15 pb-12">
        <button type="button" onClick={play} aria-controls="hero-product-demo" className="pointer-events-auto inline-flex min-h-14 items-center gap-3 rounded-full bg-primary px-6 py-4 text-base font-semibold text-white shadow-xl hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-lg">
          <Play size={24} aria-hidden="true" />
          {nl ? "Bekijk de uitleg" : "Watch the Dutch walkthrough"}
        </button>
      </div>}
      {failed && <p role="status" className="p-5 text-base text-white">{nl ? "De video kan hier niet afspelen. Bekijk de werkwijze hieronder of" : "The video cannot play here. Explore the workflow below or"} <a className="underline" href={source}>{nl ? "open de video apart" : "open the video directly"}</a>.</p>}
    </div>
    <figcaption className="mt-4 text-center text-sm leading-6 text-muted">{nl ? "Productdemonstratie met fictieve voorbeeldgegevens." : "Product demonstration with fictional sample data. Interface in Dutch."}</figcaption>
    <details className="mx-auto mt-3 max-w-3xl text-left text-base leading-7 text-muted">
      <summary className="cursor-pointer text-center underline underline-offset-4">{nl ? "Lees de demonstratie" : "Read the demonstration"}</summary>
      <p id="hero-demo-transcript" className="mt-4">{guidedTranscript[locale]}</p>
    </details>
  </figure>;
}
