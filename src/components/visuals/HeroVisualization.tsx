"use client";

import { useRef, useState } from "react";
import { ArrowDown, Play } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";

type DemoId = "prospecting" | "cleanup";

const copy = {
  nl: {
    prospectingTitle: "Vind passende bedrijven met BelgoBase",
    prospectingDescription: "Vertel wat u doet, beoordeel het voorstel en werk verder met een gerichte bedrijvenlijst en beschikbare contactgegevens.",
    prospectingCaption: "Demonstratie met fictieve voorbeeldgegevens.",
    cleanupTitle: "Heb je al lijsten? Haal eruit wat erin zit.",
    cleanupDescription: "Bekijk een echte verwerking van bestaande Excelbestanden. Persoonsgegevens zijn afgeschermd.",
    cleanupCaption: "Echte Excel-proef in de desktopversie. Persoonsgegevens afgeschermd; AI-voice-over.",
    play: "Bekijk de uitleg",
    open: "Open de video apart",
    failed: "De video kan hier niet afspelen.",
    next: "Bekijk hoe je bestaande lijsten opschoont",
    demo: "Bekijk dit met uw eigen vraag",
    transcript: "Lees de beschrijving",
    prospectingTranscript: "In deze demonstratie wordt met fictieve voorbeeldgegevens getoond hoe een gesprek over aanbod en doelgroep leidt tot een voorstel dat u beoordeelt. Daarna verschijnt een gerichte bedrijvenlijst, kiest u bedrijven, controleert u beschikbare contactgegevens en exporteert u de selectie naar Excel.",
    cleanupTranscript: "In deze echte desktopproef worden bestaande Excelbestanden samengebracht met behoud van herkomst en notities. Belinformatie wordt ingedeeld, onzekere gegevens gaan naar controle en u kunt daarna gericht met de bruikbare contacten verder werken.",
  },
  en: {
    prospectingTitle: "Find suitable companies with BelgoBase",
    prospectingDescription: "Explain what you do, review the proposal and continue with a focused company list and available contact details.",
    prospectingCaption: "Demonstration with fictional example data.",
    cleanupTitle: "Already have lists? Get more from what is in them.",
    cleanupDescription: "See a real processing run of existing Excel files. Personal data is concealed.",
    cleanupCaption: "Real Excel trial in the desktop version. Personal data concealed; Dutch AI narration.",
    play: "Watch the walkthrough",
    open: "Open the video directly",
    failed: "The video cannot play here.",
    next: "See how to clean up existing lists",
    demo: "See it with your own question",
    transcript: "Read the description",
    prospectingTranscript: "This demonstration uses fictional example data to show how a conversation about your offer and target market becomes a proposal for you to review. It then shows a focused company list, selecting companies, checking available contact details and exporting the selection to Excel.",
    cleanupTranscript: "This real desktop trial combines existing Excel files while retaining source information and notes. Calling information is classified, uncertain data is sent for review, and you can then continue with the useful contacts.",
  },
};

export function HeroVisualization() {
  const { locale } = useTranslations();
  const language = locale === "nl" ? "nl" : "en";
  const text = copy[language];
  const videos = useRef<Record<DemoId, HTMLVideoElement | null>>({ prospecting: null, cleanup: null });
  const [started, setStarted] = useState<Record<DemoId, boolean>>({ prospecting: false, cleanup: false });
  const [failed, setFailed] = useState<Record<DemoId, boolean>>({ prospecting: false, cleanup: false });

  const pauseOther = (active: DemoId) => {
    (Object.keys(videos.current) as DemoId[]).forEach(id => {
      if (id !== active) videos.current[id]?.pause();
    });
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

    return <article id={id === "cleanup" ? "list-cleanup-demo-card" : "product-demonstration"} className="min-w-0 scroll-mt-28 rounded-2xl border border-border bg-white p-4 shadow-[0_28px_80px_-42px_rgba(5,18,45,0.38)] dark:bg-[#0a1730] sm:p-5">
      <div className="mb-4 text-left">
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
          preload="metadata"
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
          <button type="button" onClick={() => play(id)} aria-controls={videoId} className="pointer-events-auto inline-flex min-h-14 items-center gap-3 rounded-full bg-primary px-6 py-4 text-base font-semibold text-white shadow-xl hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-lg">
            <Play size={24} aria-hidden="true" />
            {text.play}
          </button>
        </div>}
        {failed[id] && <p role="status" className="p-5 text-base text-white">{text.failed} <a className="underline" href={source}>{text.open}</a>.</p>}
      </div>
      <p className="mt-3 text-center text-sm leading-6 text-muted">{caption}</p>
      <details className="mx-auto mt-3 max-w-3xl text-left text-sm leading-6 text-muted">
        <summary className="cursor-pointer text-center underline underline-offset-4">{text.transcript}</summary>
        <p id={transcriptId} className="mt-3">{transcript}</p>
      </details>
    </article>;
  };

  return <section aria-label={language === "nl" ? "BelgoBase-demonstraties" : "BelgoBase demonstrations"} className="w-full min-w-0 space-y-5">
    {renderVideo({
      id: "prospecting",
      title: text.prospectingTitle,
      description: text.prospectingDescription,
      caption: text.prospectingCaption,
      transcript: text.prospectingTranscript,
      source: "/product/belgobase-overview-20260929.mp4",
      poster: "/product/belgobase-guided-poster.webp",
      width: 1920,
      height: 1080,
    })}
    <div className="flex justify-center">
      <a href="#list-cleanup-demo-card" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-deep-navy hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:bg-[#0a1730] dark:text-white">
        {text.next}<ArrowDown size={18} aria-hidden="true" />
      </a>
    </div>
    {renderVideo({
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
    <div className="flex justify-center pt-1">
      <a href="#contact" className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-white hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        {text.demo}
      </a>
    </div>
  </section>;
}
