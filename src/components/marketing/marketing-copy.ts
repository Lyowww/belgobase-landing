import type { Locale } from "@/i18n/config";

type HeroCopy = {
  eyebrow: string;
  titleLead: string;
  titleResult: string;
  summary: string;
  primaryCta: string;
  expectation: string;
};

export type ProductVariant = "selection" | "financial" | "workspace";

type ShowcaseCopy = {
  eyebrow: string;
  caption: string;
  alt: string;
};

type WorkspaceProcessCopy = {
  heading: string;
  ariaLabel: string;
  steps: readonly [string, string, string];
};

export const heroCopy: Record<Locale, HeroCopy> = {
  nl: {
    eyebrow: "Voor teams die Belgische bedrijven willen bereiken",
    titleLead: "Belgische bedrijven.",
    titleResult: "Gericht geselecteerd.",
    summary:
      "Van uw doelgroep naar een prospectielijst die u zelf controleert en naar Excel exporteert.",
    primaryCta: "Vraag een demo aan",
    expectation: "Breng uw doelgroep mee.",
  },
  fr: {
    eyebrow: "Pour les équipes qui souhaitent atteindre des entreprises belges",
    titleLead: "Entreprises belges.",
    titleResult: "Sélectionnées avec précision.",
    summary:
      "De votre cible à une liste de prospects que vous contrôlez et exportez vers Excel.",
    primaryCta: "Demander une démonstration",
    expectation: "Apportez votre cible.",
  },
  en: {
    eyebrow: "For teams looking to reach Belgian companies",
    titleLead: "Belgian companies.",
    titleResult: "Precisely selected.",
    summary:
      "From your target market to a prospect list you review and export to Excel yourself.",
    primaryCta: "Request a demo",
    expectation: "Bring your target market.",
  },
};

export const workspaceProcessCopy: Record<Locale, WorkspaceProcessCopy> = {
  nl: {
    heading: "Van vraag naar selectie",
    ariaLabel: "Stappen van doelgroep naar export",
    steps: ["Doelgroep", "Selectie", "Export"],
  },
  fr: {
    heading: "De la demande à la sélection",
    ariaLabel: "Étapes de la cible à l’exportation",
    steps: ["Cible", "Sélection", "Export"],
  },
  en: {
    heading: "From question to selection",
    ariaLabel: "Steps from target market to export",
    steps: ["Target", "Selection", "Export"],
  },
};

export const productShowcaseCopy: Record<
  Locale,
  Record<ProductVariant, ShowcaseCopy>
> = {
  nl: {
    selection: {
      eyebrow: "Selectie controleren",
      caption:
        "Beeld uit een echte productdemonstratie van 29 september 2026; montage en wachttijd zijn ingekort.",
      alt: "BelgoBase-selectiescherm met zoekveld, beschikbare bedrijfsgegevens en downloadactie.",
    },
    financial: {
      eyebrow: "Bedrijfsfiche",
      caption:
        "Productweergave met fictieve cijfers; ontbrekende waarden blijven leeg.",
      alt: "BelgoBase-bedrijfsfiche met financiële kerncijfers, bronjaar en een grafiek per jaar.",
    },
    workspace: {
      eyebrow: "Van doelgroep naar selectie",
      caption: "Productweergave met fictieve voorbeeldgegevens.",
      alt: "BelgoBase-werkruimte met zoekveld, filters, drie voorbeeldbedrijven en een exportactie.",
    },
  },
  fr: {
    selection: {
      eyebrow: "Contrôler la sélection",
      caption:
        "Image d’une démonstration réelle du produit du 29 septembre 2026 ; le montage et les temps d’attente ont été raccourcis.",
      alt: "Écran de sélection BelgoBase avec recherche, données d’entreprise disponibles et action de téléchargement.",
    },
    financial: {
      eyebrow: "Fiche d’entreprise",
      caption:
        "Présentation du produit avec des chiffres fictifs ; les valeurs manquantes restent vides.",
      alt: "Fiche d’entreprise BelgoBase avec chiffres clés, année de référence et graphique annuel.",
    },
    workspace: {
      eyebrow: "De la cible à la sélection",
      caption: "Présentation du produit avec des données d’exemple fictives.",
      alt: "Espace de travail BelgoBase avec recherche, filtres, trois entreprises fictives et une action d’exportation.",
    },
  },
  en: {
    selection: {
      eyebrow: "Review the selection",
      caption:
        "Still from a real product demonstration on 29 September 2026; editing and waiting time were shortened.",
      alt: "BelgoBase selection screen with search, available company data and a download action.",
    },
    financial: {
      eyebrow: "Company profile",
      caption:
        "Product view with fictional figures; missing values remain empty.",
      alt: "BelgoBase company profile with financial highlights, source year and a year-by-year chart.",
    },
    workspace: {
      eyebrow: "From target market to selection",
      caption: "Product view with fictional example data.",
      alt: "BelgoBase workspace with search, filters, three fictional companies and an export action.",
    },
  },
};
