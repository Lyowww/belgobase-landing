import type { Locale } from "@/i18n/config";

type BlogIndexCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  languageNote: string;
  articleLanguage: string;
  readArticle: string;
  publishedPrefix: string;
};

export const blogIndexCopy: Record<Locale, BlogIndexCopy> = {
  nl: {
    eyebrow: "Praktische gidsen",
    title: "Beter werken met Belgische bedrijfsgegevens",
    intro:
      "Heldere uitleg over prospectielijsten, Excelbestanden en de keuzes die van losse bedrijfsdata een bruikbare werkselectie maken.",
    languageNote: "De artikelen zijn in het Nederlands geschreven.",
    articleLanguage: "Nederlandstalig artikel",
    readArticle: "Lees het artikel",
    publishedPrefix: "Gepubliceerd op",
  },
  fr: {
    eyebrow: "Guides pratiques",
    title: "Mieux travailler avec les données d’entreprises belges",
    intro:
      "Des explications concrètes sur les listes de prospection, les fichiers Excel et les choix qui transforment des données dispersées en une sélection exploitable.",
    languageNote:
      "Ces articles sont actuellement disponibles en néerlandais. Chaque lien ouvre directement l’article néerlandophone.",
    articleLanguage: "Article en néerlandais",
    readArticle: "Lire l’article en néerlandais",
    publishedPrefix: "Publié le",
  },
  en: {
    eyebrow: "Practical guides",
    title: "Work better with Belgian company data",
    intro:
      "Clear guidance on prospect lists, Excel files, and the choices that turn scattered company data into a useful working selection.",
    languageNote:
      "These articles are currently available in Dutch. Each link opens the Dutch-language article directly.",
    articleLanguage: "Article in Dutch",
    readArticle: "Read the article in Dutch",
    publishedPrefix: "Published on",
  },
};
