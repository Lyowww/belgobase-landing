"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { useTranslations } from "@/providers/TranslationsProvider";

type DemoId = "prospecting" | "cleanup";

const copy = {
  fr: {
    "prospectingTitle": "Que coûte un mauvais prospect à votre équipe ?",
    "prospectingDescription": "Le même salaire et la même préparation, même pour une entreprise inadaptée. Reconnaissez-vous où votre équipe perd du temps ?",
    "prospectingCaption": "Essai de recherche réel du 29 septembre. Narration IA en néerlandais ; temps d’attente raccourcis.",
    "cleanupTitle": "À quelle fréquence rachetez-vous ce qui se trouve déjà dans vos listes Excel ?",
    "cleanupDescription": "Des doublons, des notes oubliées et une équipe d’appel sans prochaine liste. Voyez ce que révèle un traitement réel de fichiers existants.",
    "cleanupCaption": "Essai Excel réel dans la version de bureau. Données personnelles masquées ; narration IA en néerlandais.",
    "play": "Voir la présentation",
    "open": "Ouvrir la vidéo séparément",
    "failed": "La vidéo ne peut pas être lue ici.",
    "next": "Voir comment nettoyer les listes existantes",
    "demo": "Voir avec votre propre question",
    "transcript": "À propos de cette vidéo",
    "prospectingTranscript": "La première minute présente le coût des mauvais prospects : heures d’appel, recherches répétées, entreprises pertinentes manquées, listes dispersées et clients demandant beaucoup de suivi. L’essai réel du 29 septembre montre ensuite un fournisseur de fruits au travail discutant de sa cible et confirmant le code postal 2800 avec au moins 20 ETP. La recherche donne 239 entreprises à examiner, puis l’export Excel réel. Les ETP ne prouvent ni la présence au bureau ni l’intérêt d’achat. La recherche de coordonnées est citée comme étape distincte, sans être exécutée. Les données du compte sont masquées ; le montage raccourcit les attentes.",
    "cleanupTranscript": "Cet essai réel de la version de bureau réunit des fichiers Excel existants en conservant leur provenance et les notes. Les informations d’appel sont classées, les données incertaines sont soumises à vérification et vous pouvez ensuite poursuivre avec les contacts utiles."
},
  nl: {
    prospectingTitle: "Wat kost de verkeerde prospect uw team?",
    prospectingDescription: "Hetzelfde loon en dezelfde voorbereiding, ook voor een bedrijf dat niet past. Herkent u waar uw team tijd verliest?",
    prospectingCaption: "Echte zoekproef van 29 september. AI-voice-over; wachttijd ingekort.",
    cleanupTitle: "Hoe vaak koopt u opnieuw wat al in uw Excel-lijsten zit?",
    cleanupDescription: "Dubbels, vergeten notities en een belteam dat zonder lijst zit. Bekijk wat een echte verwerking van bestaande bestanden blootlegt.",
    cleanupCaption: "Echte Excel-proef in de desktopversie. Persoonsgegevens afgeschermd; AI-voice-over.",
    play: "Bekijk de uitleg",
    open: "Open de video apart",
    failed: "De video kan hier niet afspelen.",
    next: "Bekijk hoe je bestaande lijsten opschoont",
    demo: "Bekijk dit met uw eigen vraag",
    transcript: "Over deze video",
    prospectingTranscript: "De eerste minuut gaat over de kost van verkeerde prospects: beluren, herhaald zoekwerk, gemiste passende bedrijven, versnipperde lijsten en klanten die veel opvolging vragen. Daarna volgt de echte proef van 29 september: een leverancier van fruit op het werk bespreekt zijn doelgroep en bevestigt postcode 2800 met minstens 20 VTE. De zoekopdracht levert 239 bedrijven op om zelf te beoordelen, gevolgd door de echte Excel-export. VTE bewijst geen aanwezigheid op kantoor of koopinteresse. Contactonderzoek wordt genoemd als aparte vervolgstap, niet uitgevoerd. Accountgegevens zijn afgeschermd; de opname is gemonteerd en wachttijden zijn ingekort.",
    cleanupTranscript: "In deze echte desktopproef worden bestaande Excelbestanden samengebracht met behoud van herkomst en notities. Belinformatie wordt ingedeeld, onzekere gegevens gaan naar controle en u kunt daarna gericht met de bruikbare contacten verder werken.",
  },
  en: {
    prospectingTitle: "What does the wrong prospect cost your team?",
    prospectingDescription: "The same salary and preparation, even for a company that does not fit. Recognise where your team loses time?",
    prospectingCaption: "Real search trial from 29 September. Dutch AI narration; waiting time shortened.",
    cleanupTitle: "How often do you buy what is already in your Excel lists?",
    cleanupDescription: "Duplicates, forgotten notes and a calling team with no next list. See what a real processing run of existing files reveals.",
    cleanupCaption: "Real Excel trial in the desktop version. Personal data concealed; Dutch AI narration.",
    play: "Watch the walkthrough",
    open: "Open the video directly",
    failed: "The video cannot play here.",
    next: "See how to clean up existing lists",
    demo: "See it with your own question",
    transcript: "About this video",
    prospectingTranscript: "The first minute explores the cost of the wrong prospects: calling hours, repeated research, missed suitable companies, scattered lists and customers who need extensive follow-up. Then the real 29 September trial shows a workplace fruit supplier discussing his target market and confirming postcode 2800 with at least 20 FTE. The search returns 239 companies for review, followed by the actual Excel export. FTE does not prove office attendance or buying interest. Contact research is mentioned as a separate next step, not executed. Account details are concealed; footage is edited and waiting time shortened.",
    cleanupTranscript: "This real desktop trial combines existing Excel files while retaining source information and notes. Calling information is classified, uncertain data is sent for review, and you can then continue with the useful contacts.",
  },
};

export function HeroVisualization({ mode = "prospecting" }: { mode?: DemoId }) {
  const { locale } = useTranslations();
  const language = locale;
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
          <track key={language} kind="captions" src={`${source.replace(".mp4", "")}-${language}.vtt`} srcLang={language} label={language === "nl" ? "Nederlands" : language === "fr" ? "Français" : "English"} default />
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
      <details className="mx-auto mt-3 max-w-3xl text-left text-base leading-7 text-muted">
        <summary className="cursor-pointer text-center underline underline-offset-4">{text.transcript}</summary>
        <p className="mt-3">{caption}</p>
        <p id={transcriptId} className="mt-3">{transcript}</p>
      </details>
    </article>;
  };

  return <section aria-label={language === "nl" ? "BelgoBase-demonstraties" : language === "fr" ? "Démonstrations BelgoBase" : "BelgoBase demonstrations"} className="w-full min-w-0 space-y-5">
    {mode === "prospecting" && renderVideo({
      id: "prospecting",
      title: text.prospectingTitle,
      description: text.prospectingDescription,
      caption: text.prospectingCaption,
      transcript: text.prospectingTranscript,
      source: "/product/belgobase-prospectiepijn-20261005.mp4",
      poster: "/product/belgobase-prospectiepijn-20261005.jpg",
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
