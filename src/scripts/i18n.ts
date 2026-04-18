/**
 * Client-side i18n runtime.
 *
 * Expects window.__I18N_LOCALES to be set before this script runs:
 *   window.__I18N_LOCALES = { en: {...}, fr: {...} }
 *
 * This script is loaded as a normal Astro <script> (bundled).
 * It reads localStorage("lang") or navigator.language to pick the active lang,
 * then applies translations to all [data-i18n] and [data-i18n-slot] elements.
 *
 * For elements with slot children ([data-i18n] containing [data-i18n-slot]):
 *   - The string is split on {token} patterns
 *   - Text nodes around slot elements are updated in-place
 *   - Slot elements themselves are never touched
 *
 * Exposes window.__i18n = { setLang, getCurrentLang }
 */

type Locales = Record<string, Record<string, string>>;

const SUPPORTED = ["en", "fr"] as const;
type Lang = (typeof SUPPORTED)[number];

function isLang(v: string): v is Lang {
  return (SUPPORTED as readonly string[]).includes(v);
}

function getInitialLang(): Lang {
  const stored = localStorage.getItem("lang");
  if (stored && isLang(stored)) return stored;
  const browser = navigator.language.slice(0, 2).toLowerCase();
  if (isLang(browser)) return browser;
  return "en";
}

function splitOnTokens(str: string): Array<{ type: "text"; value: string } | { type: "token"; name: string }> {
  const parts: Array<{ type: "text"; value: string } | { type: "token"; name: string }> = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: str.slice(last, m.index) });
    parts.push({ type: "token", name: m[1] });
    last = m.index + m[0].length;
  }
  if (last < str.length) parts.push({ type: "text", value: str.slice(last) });
  return parts;
}

function applyToElement(el: HTMLElement, value: string) {
  const slots = el.querySelectorAll<HTMLElement>("[data-i18n-slot]");

  if (slots.length === 0) {
    // Plain text — safe to set textContent directly
    el.textContent = value;
    return;
  }

  // Has slot children — update surrounding text nodes only.
  // Build a map of slot name → element.
  const slotMap = new Map<string, HTMLElement>();
  slots.forEach((s) => slotMap.set(s.dataset.i18nSlot!, s));

  // Clear existing text nodes (non-slot children), keep slot elements.
  Array.from(el.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) node.remove();
  });

  // Re-insert text nodes and slot elements in the order the new string dictates.
  const parts = splitOnTokens(value);
  const fragment = document.createDocumentFragment();
  for (const part of parts) {
    if (part.type === "text") {
      fragment.appendChild(document.createTextNode(part.value));
    } else {
      const slotEl = slotMap.get(part.name);
      if (slotEl) fragment.appendChild(slotEl);
    }
  }
  el.appendChild(fragment);
}

function applyTranslations(dict: Record<string, string>, lang: Lang) {
  document.documentElement.lang = lang;

  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n!;
    const value = dict[key];
    if (value !== undefined) applyToElement(el, value);
  });

  document.querySelectorAll<HTMLElement>("[data-lang-current]").forEach((el) => {
    el.textContent = lang.toUpperCase();
  });
}

let currentLang: Lang = "en";

function init() {
  const locales = (window as any).__I18N_LOCALES as Locales | undefined;
  if (!locales) {
    console.warn("i18n: window.__I18N_LOCALES not set");
    return;
  }

  currentLang = getInitialLang();
  applyTranslations(locales[currentLang], currentLang);

  (window as any).__i18n = {
    getCurrentLang: () => currentLang,
    setLang(lang: Lang) {
      if (!isLang(lang)) return;
      currentLang = lang;
      localStorage.setItem("lang", lang);
      applyTranslations(locales[lang], lang);
    },
  };
}

// Run as soon as the DOM is ready. Because this script is in <head> without
// defer/async it runs before paint, but the DOM isn't parsed yet — so we
// listen for DOMContentLoaded. Layout.astro sets __I18N_LOCALES in an
// is:inline script before this one, so it's always available.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
