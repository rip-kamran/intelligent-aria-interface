import { useEffect } from "react";

/**
 * Removes any injected "Edit with Lovable" style badge from the page.
 * Runs client-side only, watches for re-injection, and also scrubs
 * badges that live inside shadow roots or iframes-free overlays.
 */
const SELECTORS = [
  "#lovable-badge",
  ".lovable-badge",
  "[data-lovable-badge]",
  "[id*='lovable-badge']",
  "[class*='lovable-badge']",
  "a[href*='lovable.dev']",
  "a[href*='lovable.app/?utm']",
  "gpt-engineer-badge",
  "lovable-badge",
];

function isBadge(el: Element) {
  if (SELECTORS.some((s) => el.matches?.(s))) return true;
  const text = (el.textContent || "").trim().toLowerCase();
  return text === "edit with lovable" || text === "made with lovable";
}

function scrub(root: ParentNode) {
  for (const sel of SELECTORS) {
    root.querySelectorAll?.(sel).forEach((el) => el.remove());
  }
  // Catch text-only badges rendered without identifying attributes.
  root.querySelectorAll?.("a, div, button").forEach((el) => {
    const text = (el.textContent || "").trim().toLowerCase();
    if (text === "edit with lovable" || text === "made with lovable") el.remove();
  });
  // Shadow DOM hosts
  root.querySelectorAll?.("*").forEach((el) => {
    const sr = (el as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) scrub(sr);
  });
}

export function BadgeBlocker() {
  useEffect(() => {
    scrub(document);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node as Element;
          if (isBadge(el)) {
            el.remove();
            return;
          }
          scrub(el);
        });
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    const interval = window.setInterval(() => scrub(document), 1000);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
