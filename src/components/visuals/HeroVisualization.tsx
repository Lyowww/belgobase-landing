"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";

type DemoId = "prospecting" | "cleanup";

const copy = {
  nl: {
    prospectingTitle: "Vind passende bedrijven met BelgoBase",
    prospectingDescription: "Vertel wat u doet, beoordeel het voorstel en werk verder met een gerichte bedrijvenlijst en beschikbare contactgegevens.",
    prospectingCaption: "Echte zoekopdracht en Excel-export. AI-voice-over.",
    cleanupTitle: "Bestaande lijsten? Maak er weer werkbare contacten van.",
    cleanupDescription: "Bekijk een echte verwerking van bestaande Excelbestanden. Persoonsgegevens zijn afgeschermd.",
    cleanupCaption: "Echte Excel-proef in de desktopversie. Persoonsgegevens afgeschermd; AI-voice-over.",
    play: "Bekijk de uitleg",
    open: "Open de video apart",
    failed: "De video kan hier niet afspelen.",
    next: "Bekijk hoe je bestaande lijsten opschoont",
    demo: "Bekijk dit met uw eigen vraag",
    transcript: "Lees de beschrijving",
    prospectingTranscript: "Een echte zoekopdracht voor fruit op het werk: via gesprek en bevestigde filters naar 239 bedrijven in postcode 2800 met minstens 20 VTE, gevolgd door de daadwerkelijke Excel-export. Personeelsgrootte bewijst geen aanwezigheid op kantoor. Contactonderzoek wordt als vervolgstap getoond, niet uitgevoerd. Wachttijden zijn ingekort; accountgegevens zijn afgeschermd.",
    cleanupTranscript: "In deze echte desktopproef worden bestaande Excelbestanden samengebracht met behoud van herkomst en notities. Belinformatie wordt ingedeeld, onzekere gegevens gaan naar controle en u kunt daarna gericht met de bruikbare contacten verder werken.",
  },
  en: {
    prospectingTitle: "Find suitable companies with BelgoBase",
    prospectingDescription: "Explain what you do, review the proposal and continue with a focused company list and available contact details.",
    prospectingCaption: "Real search and Excel export. Dutch AI narration.",
    cleanupTitle: "Already have lists? Get more from what is in them.",
    cleanupDescription: "See a real processing run of existing Excel files. Personal data is concealed.",
    cleanupCaption: "Real Excel trial in the desktop version. Personal data concealed; Dutch AI narration.",
    play: "Watch the walkthrough",
    open: "Open the video directly",
    failed: "The video cannot play here.",
    next: "See how to clean up existing lists",
    demo: "See it with your own question",
    transcript: "Read the description",
    prospectingTranscript: "A real search for a workplace fruit supplier: conversation and confirmed filters produce 239 companies in postcode 2800 with at least 20 FTE, followed by the actual Excel export. Workforce size does not prove office attendance. Contact research is shown as a next step, not executed. Waiting times are shortened and account details concealed.",
    cleanupTranscript: "This real desktop trial combines existing Excel files while retaining source information and notes. Calling information is classified, uncertain data is sent for review, and you can then continue with the useful contacts.",
  },
};

export function HeroVisualization({ mode = "prospecting" }: { mode?: DemoId }) {
  const { locale } = useTranslations();
  const language = locale === "nl" ? "nl" : "en";
  const text = copy[language];
  const videos = useRef<Record<DemoId, HTMLVideoElement | null>>({ prospecting: null, cleanup: null });
  const [started, setStarted] = useState<Record<DemoId, boolean>>({ prospecting: false, cleanup: false });
  const [failed, setFailed] = useState<Record<DemoId, boolean>>({ prospecting: false, cleanup: false });

  const pauseOther = (active: DemoId) => {
    const otherId = active === "prospecting" ? "list-cleanup-demo" : "hero-product-demo";
    const other = document.getElementById(otherId);
    if (other instanceof HTMLVideoElement) other.pause();
  };

  const play = (id: DemoId) => {
    const video = videos.current[id];
    if (!video) return;
    pauseOther(id);
    video.muted = false;
    void video.play().catch(() => setStarted(current => ({ ...current, [id]: false })));
  };

  const renderVideo = ({
    id,
    title,
    description,
    caption,
    transcript,
    source,
    poster,
    width,
    height,
  }: {
    id: DemoId;
    title: string;
    description: string;
    caption: string;
    transcript: string;
    source: string;
    poster: string;
    width: number;
    height: number;
  }) => {
    const videoId = id === "prospecting" ? "hero-product-demo" : "list-cleanup-demo";
    const transcriptId = `${videoId}-transcript`;

    return <article id={id === "cleanup" ? "list-cleanup-demo-card" : "product-demonstration"} className="demo-card min-w-0 scroll-mt-28 rounded-2xl border border-border bg-surface p-3 shadow-[0_28px_80px_-42px_rgba(5,18,45,0.38)] sm:p-4">
      <div className={id === "prospecting" ? "sr-only" : "mb-4 text-left"}>
        <h2 className="text-xl font-semibold tracking-tight text-deep-navy dark:text-white sm:text-2xl">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">{description}</p>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-[#0a1730]">
        <video
          ref={element => { videos.current[id] = element; }}
          id={videoId}
          src={source}
          controls
          playsInline
          preload={id === "prospecting" ? "metadata" : "none"}
          poster={poster}
          width={width}
          height={height}
          className="aspect-video h-auto w-full bg-[#f5f6fa] [&::cue]:text-xs sm:[&::cue]:text-base"
          aria-label={title}
          aria-describedby={transcriptId}
          onPlay={() => { pauseOther(id); setStarted(current => ({ ...current, [id]: true })); }}
          onEnded={() => setStarted(current => ({ ...current, [id]: false }))}
          onError={() => setFailed(current => ({ ...current, [id]: true }))}
        >
          <track key={language} kind="captions" src={`${source.replace(".mp4", "")}-${language}.vtt`} srcLang={language} label={language === "nl" ? "Nederlands" : "English"} default />
          <a href={source}>{text.open}</a>
        </video>
        {!started[id] && !failed[id] && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
          <button type="button" onClick={() => play(id)} aria-controls={videoId} className="pointer-events-auto inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-5 py-3 text-base font-semibold text-slate-900 shadow-xl hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <Play size={24} aria-hidden="true" />
            {text.play}
          </button>
        </div>}
        {failed[id] && <p role="status" className="p-5 text-base text-white">{text.failed} <a className="underline" href={source}>{text.open}</a>.</p>}
      </div>
      <p className="mt-3 text-center text-[15px] leading-6 text-muted">{caption}</p>
      <details className="mx-auto mt-3 max-w-3xl text-left text-sm leading-6 text-muted">
        <summary className="cursor-pointer text-center underline underline-offset-4">{text.transcript}</summary>
        <p id={transcriptId} className="mt-3">{transcript}</p>
      </details>
    </article>;
  };

  return <section aria-label={language === "nl" ? "BelgoBase-demonstraties" : "BelgoBase demonstrations"} className="w-full min-w-0 space-y-5">
    {mode === "prospecting" && renderVideo({
      id: "prospecting",
      title: text.prospectingTitle,
      description: text.prospectingDescription,
      caption: text.prospectingCaption,
      transcript: text.prospectingTranscript,
      source: "/product/belgobase-echte-demonstratie-20260929.mp4",
      poster: "/product/belgobase-echte-demonstratie-20260929.jpg",
      width: 1920,
      height: 1080,
    })}
    {mode === "cleanup" && renderVideo({
      id: "cleanup",
      title: text.cleanupTitle,
      description: text.cleanupDescription,
      caption: text.cleanupCaption,
      transcript: text.cleanupTranscript,
      source: "/product/belgobase-lijsten-20260929.mp4",
      poster: "/product/belgobase-lijsten-20260929.jpg",
      width: 1920,
      height: 1080,
    })}
  </section>;
}
