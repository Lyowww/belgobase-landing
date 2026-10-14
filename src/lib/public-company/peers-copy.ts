import type { Locale } from "@/i18n/config";

export const peersCopy = {
  nl: {
    heading: "Hoeveel bedrijven lijken op dit bedrijf?",
    activity: "Dezelfde activiteit", municipality: "Dezelfde gemeente", postcode: "Dezelfde postcode", fte: "Vergelijkbaar personeel",
    companies: "andere bedrijven", examples: "Bekijk voorbeelden", empty: "Geen andere bedrijven.",
    pending: "Vergelijkbare bedrijven berekenen…", error: "Vergelijking tijdelijk niet beschikbaar.", retry: "Opnieuw proberen",
    unavailable: "Niet beschikbaar", noActivity: "Activiteit onbekend", noMunicipality: "Gemeente onbekend", noPostcode: "Postcode onbekend", noFte: "Personeelscijfer ontbreekt",
    from: "vanaf", below: "tot <", persons: "VTE", year: "Boekjaar",
    scope: "Elke kaart vergelijkt dezelfde activiteit afzonderlijk. We tellen unieke rechtspersonen in onze Belgische databank met dezelfde getoonde NACEBEL-code en versie; dit bedrijf telt niet mee. Gemeente en postcode zijn het geregistreerde KBO-adres. Personeel vergelijkt geldige, beschikbare VTE-cijfers van hetzelfde boekjaar binnen de getoonde band. Ontbrekende gegevens zijn geen nul. Een gelijke activiteit bewijst geen geschikte klant.",
    method: "Hoe worden de aantallen berekend?", question: "Deze bedrijven als prospectielijst?", cta: "Bekijk BelgoBase",
    comparisonLimit: "Vergelijking niet beschikbaar",
  },
  fr: {
    heading: "Combien d’entreprises ressemblent à celle-ci ?",
    activity: "Même activité", municipality: "Même commune", postcode: "Même code postal", fte: "Effectif comparable",
    companies: "autres entreprises", examples: "Voir des exemples", empty: "Aucune autre entreprise.",
    pending: "Calcul des entreprises comparables…", error: "Comparaison temporairement indisponible.", retry: "Réessayer",
    unavailable: "Indisponible", noActivity: "Activité inconnue", noMunicipality: "Commune inconnue", noPostcode: "Code postal inconnu", noFte: "Effectif indisponible",
    from: "à partir de", below: "à <", persons: "ETP", year: "Exercice",
    scope: "Chaque carte compare séparément la même activité. Nous comptons les personnes morales uniques de notre base belge ayant le même code NACEBEL affiché et la même version ; cette entreprise est exclue. La commune et le code postal correspondent à l’adresse enregistrée à la BCE. L’effectif utilise les chiffres ETP valides disponibles du même exercice dans la tranche indiquée. Les données absentes ne sont pas un zéro. Une même activité ne garantit pas un client adapté.",
    method: "Comment les chiffres sont-ils calculés ?", question: "Ces entreprises comme liste de prospection ?", cta: "Découvrir BelgoBase",
    comparisonLimit: "Comparaison indisponible",
  },
  en: {
    heading: "How many companies are similar to this one?",
    activity: "Same activity", municipality: "Same municipality", postcode: "Same postcode", fte: "Comparable workforce",
    companies: "other companies", examples: "View examples", empty: "No other companies.",
    pending: "Calculating comparable companies…", error: "Comparison temporarily unavailable.", retry: "Try again",
    unavailable: "Unavailable", noActivity: "Activity unknown", noMunicipality: "Municipality unknown", noPostcode: "Postcode unknown", noFte: "Workforce figure missing",
    from: "from", below: "to <", persons: "FTE", year: "Financial year",
    scope: "Each card compares the same activity independently. We count unique legal entities in our Belgian database with the same displayed NACEBEL code and version; this company is excluded. Municipality and postcode use the registered KBO address. Workforce compares valid, available FTE figures from the same financial year within the displayed range. Missing data is not zero. Sharing an activity does not establish customer suitability.",
    method: "How are the counts calculated?", question: "These companies as a prospect list?", cta: "Discover BelgoBase",
    comparisonLimit: "Comparison unavailable",
  },
} satisfies Record<Locale, Record<string, string>>;
