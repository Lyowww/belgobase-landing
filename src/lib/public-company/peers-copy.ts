import type { Locale } from "@/i18n/config";

export const peersCopy = {
  nl: {
    heading: "Hoeveel bedrijven lijken op dit bedrijf?", intro: "Van dezelfde activiteit naar een steeds specifiekere selectie.",
    activity: "Dezelfde activiteit", revenue: "+ Vergelijkbare omzet", fte: "+ Vergelijkbaar personeel", legalForm: "+ Dezelfde rechtsvorm",
    companies: "andere bedrijven", examples: "Voorbeelden", empty: "Geen andere bedrijven binnen deze selectie.",
    pending: "Vergelijkbare bedrijven berekenen…", error: "Deze vergelijking is tijdelijk niet beschikbaar. De bedrijfsfiche blijft beschikbaar.", retry: "Opnieuw proberen",
    unavailable: "Niet berekenbaar", noActivity: "Geen bruikbare activiteit beschikbaar.", noRevenue: "Geen vergelijkbare omzet beschikbaar.", noFte: "Geen vergelijkbaar personeelscijfer beschikbaar.", noLegalForm: "Rechtsvorm niet beschikbaar.", prior: "Een eerdere verfijning kan niet berekend worden.",
    turnover: "Omzet", employees: "Personeel", year: "Boekjaar", from: "vanaf", below: "tot minder dan", persons: "VTE",
    scope: "Elke kaart voegt een criterium toe. We tellen unieke rechtspersonen met dezelfde getoonde NACEBEL-code en versie in onze Belgische databank; het opgezochte bedrijf telt niet mee. Financiële vergelijkingen gebruiken beschikbare, geldige cijfers van hetzelfde boekjaar. Ontbrekende cijfers tellen niet als nul. Gelijke activiteit betekent niet automatisch een geschikte klant.",
    question: "Welke van deze bedrijven passen bij uw aanbod?", cta: "Vraag de volledige selectie aan", source: "Datum KBO-bron",
    comparisonLimit: "Deze activiteitsgroep is te groot voor de financiële verfijning in deze gratis opzoeking.",
  },
  fr: {
    heading: "Combien d’entreprises ressemblent à celle-ci ?", intro: "De la même activité à une sélection de plus en plus précise.",
    activity: "Même activité", revenue: "+ Chiffre d’affaires comparable", fte: "+ Effectif comparable", legalForm: "+ Même forme juridique",
    companies: "autres entreprises", examples: "Exemples", empty: "Aucune autre entreprise dans cette sélection.",
    pending: "Calcul des entreprises comparables…", error: "Cette comparaison est temporairement indisponible. La fiche reste accessible.", retry: "Réessayer",
    unavailable: "Non calculable", noActivity: "Aucune activité exploitable disponible.", noRevenue: "Aucun chiffre d’affaires comparable disponible.", noFte: "Aucun effectif comparable disponible.", noLegalForm: "Forme juridique indisponible.", prior: "Une étape précédente ne peut pas être calculée.",
    turnover: "Chiffre d’affaires", employees: "Personnel", year: "Exercice", from: "à partir de", below: "à moins de", persons: "ETP",
    scope: "Chaque carte ajoute un critère. Nous comptons les personnes morales uniques de notre base belge ayant le même code NACEBEL affiché et la même version ; l’entreprise recherchée est exclue. Les comparaisons financières utilisent les chiffres valides disponibles du même exercice. Les chiffres absents ne sont pas considérés comme nuls. Une même activité ne garantit pas un client adapté.",
    question: "Lesquelles correspondent à votre offre ?", cta: "Demander la sélection complète", source: "Date de la source BCE",
    comparisonLimit: "Ce groupe d’activités est trop important pour l’affinement financier dans cette recherche gratuite.",
  },
  en: {
    heading: "How many companies are similar to this one?", intro: "From the same activity to an increasingly specific selection.",
    activity: "Same activity", revenue: "+ Comparable revenue", fte: "+ Comparable workforce", legalForm: "+ Same legal form",
    companies: "other companies", examples: "Examples", empty: "No other companies in this selection.",
    pending: "Calculating comparable companies…", error: "This comparison is temporarily unavailable. The company record remains available.", retry: "Try again",
    unavailable: "Cannot calculate", noActivity: "No usable activity available.", noRevenue: "No comparable revenue available.", noFte: "No comparable workforce figure available.", noLegalForm: "Legal form unavailable.", prior: "An earlier refinement cannot be calculated.",
    turnover: "Revenue", employees: "Workforce", year: "Financial year", from: "from", below: "to less than", persons: "FTE",
    scope: "Each card adds a criterion. We count unique legal entities in our Belgian database with the same displayed NACEBEL code and version; the company you looked up is excluded. Financial comparisons use available, valid figures from the same financial year. Missing figures are not treated as zero. Sharing an activity does not establish customer suitability.",
    question: "Which of these companies fit your offering?", cta: "Request the full selection", source: "KBO source date",
    comparisonLimit: "This activity group is too large for financial refinement in this free lookup.",
  },
} satisfies Record<Locale, Record<string, string>>;
