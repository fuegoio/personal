import en from "../../public/locales/en.json";
import fr from "../../public/locales/fr.json";

export const SUPPORTED_LANGS = ["en", "fr"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export const locales: Record<Lang, Record<string, string>> = { en, fr };

/**
 * Returns a t() function for the given lang.
 * Plain strings are returned as-is (tokens like {foo} left for T.astro to handle).
 */
export function useTranslations(lang: Lang) {
  const dict = locales[lang];
  return function t(key: string): string {
    return dict[key] ?? en[key as keyof typeof en] ?? key;
  };
}

/**
 * Pre-bound English t() for SSR — the client script handles lang switching.
 */
export const t = useTranslations("en");
