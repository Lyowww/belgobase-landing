import "server-only";
import type { Locale } from "./config";

const dictionaries = {
  en: () => import("@/messages/en.json").then((module) => module.default),
  nl: () => import("@/messages/nl.json").then((module) => module.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["en"]>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
