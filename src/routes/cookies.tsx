import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/lib/legal";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Aria" },
      {
        name: "description",
        content: "The cookies and local storage Aria uses, and how to control them.",
      },
      { property: "og:title", content: "Cookie Policy — Aria" },
      { property: "og:description", content: "The cookies Aria uses and how to control them." },
    ],
  }),
  component: Cookies,
});

function Cookies() {
  return (
    <LegalPage
      title="Cookie Policy"
      intro="Aria keeps cookies to a minimum. We use only what is needed to sign you in and remember your preferences — no advertising or tracking cookies."
    >
      <section>
        <h2>Essential</h2>
        <ul>
          <li>
            <strong className="text-foreground">Session</strong> — keeps you signed in and secures
            requests to the server. Without it you would be logged out on every page.
          </li>
          <li>
            <strong className="text-foreground">Preferences</strong> — remembers your chosen model,
            response style, theme, and that you have seen the cookie notice.
          </li>
        </ul>
      </section>
      <section>
        <h2>What we don't use</h2>
        <p>
          No advertising cookies, no cross-site tracking, and no selling of data to third parties.
        </p>
      </section>
      <section>
        <h2>Controlling cookies</h2>
        <p>
          You can clear or block cookies and site storage in your browser settings at any time.
          Blocking essential cookies will stop sign-in from working. Choosing "Essential only" in the
          cookie notice keeps the sign-in and preference storage that Aria needs to function.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
