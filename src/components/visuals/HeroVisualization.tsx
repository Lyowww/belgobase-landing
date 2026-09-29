"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";

const guidedTranscript = {
  "nl": "Je belteam is klaar. Maar de lijst is op. En ergens op je computer staan nog jaren aan contacten. Verspreid over tientallen Excels. Wie is al gebeld? Wie is klant? En voor welke gegevens betaal je opnieuw? We nemen de proef op de som. Tien echte Excelbestanden uit een oud verkooparchief. Samen bijna dertigduizend rijen. In deze opname zijn klantgegevens afgeschermd. De aantallen komen uit de echte verwerking. In BelgoBase kies je de bestanden en start je de analyse. De oorspronkelijke bestanden blijven behouden. Gegevens worden samengevoegd, terwijl notities en herkomst bewaard blijven. Wat niet betrouwbaar kan worden ingedeeld, gaat naar controle. Dit is het resultaat. Ruim tienduizend records met belinformatie. Bijna zesduizend zonder belinformatie. En een aparte groep om na te kijken. Zo zie je meteen welke gegevens je nog kunt gebruiken. Geen notitie behandelen we hier als nog niet gebeld. Daarna bekijkt de assistent de oude belnotities. In deze proef herkent hij klanten en afspraken. Maar veel notities blijven onduidelijk. Het voorgestelde profiel levert nu geen prioriteitsselectie op. Dat vraagt eerst jouw beoordeling. Zo weet je ook waar je gegevens nog tekortschieten. Als je selectie klopt, kun je gericht ontbrekende contactgegevens aanvullen. Via de bestaande nummerzoeker. Eerst zie je de kosteninschatting. Pas na jouw bevestiging start de zoekopdracht. Een aanwezig nummer is niet automatisch opnieuw gecontroleerd. Je kunt een compacte bellijst exporteren en nieuwe belresultaten weer meenemen in een volgende analyse. Zo bouw je verder op wat je team al weet. Voor een belteam, een salesbureau, of een onderneming die een gerichte doelgroep wil bereiken. Van verspreide bestanden naar een overzichtelijke volgende stap. Bewaar wat waarde heeft. Controleer wat twijfelachtig is. En richt je aandacht op de contacten die bij je passen. Dat is BelgoBase.",
  "en": "Your calling team is ready. But the list has run out. And somewhere on your computer are years of contacts. Scattered across dozens of spreadsheets. Who has already been called? Who is a customer? And which data are you paying for again? Let's put it to the test. Ten real Excel files from an old sales archive. Together, almost thirty thousand rows. Customer details are concealed in this recording. The counts come from the actual processing. In BelgoBase, select the files and start the analysis. The original files are preserved. Data is merged while notes and source information are retained. Anything that cannot be reliably classified goes to review. Here is the result. Over ten thousand records with calling information. Almost six thousand without calling information. And a separate group to review. You can immediately see which data you can still use. Here, we treat records without notes as not yet called. Next, the assistant examines the old calling notes. In this trial, it identifies customers and appointments. But many notes remain unclear. The proposed profile currently produces no priority selection. That needs your review first. It also shows where your data still falls short. Once your selection is right, you can enrich missing contact details. Using the existing phone-number finder. First, you see the cost estimate. The search starts only after your confirmation. An existing number has not automatically been reverified. Export a compact calling list and include new calling results in a later analysis. Build on what your team already knows. For a calling team, sales agency or business wanting to reach a focused target audience. From scattered files to a clear next step. Keep what has value. Review what is uncertain. Focus your attention on contacts that fit your business. That is BelgoBase."
};

export function HeroVisualization() {
  const { locale } = useTranslations();
  const nl = locale === "nl";
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const source = "/product/belgobase-excel-20260929.mp4";
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
        poster="/product/belgobase-excel-20260929.jpg" width={1920} height={1080}
        className="aspect-video h-auto w-full bg-[#f5f6fa] [&::cue]:text-xs sm:[&::cue]:text-base" aria-label={nl ? "BelgoBase: stap voor stap met gesproken uitleg" : "BelgoBase: step-by-step tour with Dutch narration"}
        aria-describedby="hero-demo-transcript" onPlay={() => { setPlaying(true); setStarted(true); }} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setStarted(false); }} onError={() => { setFailed(true); setPlaying(false); }}>
        <track key={locale} kind="captions" src={`/product/belgobase-excel-20260929-${locale}.vtt`} srcLang={locale} label={nl ? "Nederlands" : "English"} default />
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
    <figcaption className="mt-4 text-center text-sm leading-6 text-muted">{nl ? "Echte Excel-proef in de desktopversie. Gegevens afgeschermd; AI-voice-over." : "Real Excel trial in the desktop version. Data concealed; Dutch AI narration."}</figcaption>
    <details className="mx-auto mt-3 max-w-3xl text-left text-base leading-7 text-muted">
      <summary className="cursor-pointer text-center underline underline-offset-4">{nl ? "Lees de demonstratie" : "Read the demonstration"}</summary>
      <p id="hero-demo-transcript" className="mt-4">{guidedTranscript[locale]}</p>
    </details>
  </figure>;
}
