import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL, OWNER } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Aria" },
      {
        name: "description",
        content: "How Aria collects, uses, stores and protects your personal data.",
      },
      { property: "og:title", content: "Privacy Policy — Aria" },
      { property: "og:description", content: "How Aria handles your personal data." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`Aria is operated by ${OWNER}. This policy explains what we collect, why, and the control you have over it.`}
    >
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong className="text-foreground">Account details</strong> — your email address, sign-in
            method, verification status, plan, and usage counts.
          </li>
          <li>
            <strong className="text-foreground">Conversations</strong> — the messages, files, images
            and voice transcripts you send, and Aria's replies.
          </li>
          <li>
            <strong className="text-foreground">Saved memories</strong> — facts you ask Aria to
            remember, if memory is switched on in settings.
          </li>
          <li>
            <strong className="text-foreground">Technical logs</strong> — errors and basic request
            information used to keep the service working and prevent abuse.
          </li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>
          To sign you in, answer your messages, keep your history across devices, apply usage limits,
          prevent abuse, and improve reliability. We do not sell your data or use your conversations
          for advertising.
        </p>
      </section>
      <section>
        <h2>Who we share it with</h2>
        <p>
          Only the processors needed to run Aria: our hosting and database provider, the AI model
          providers that generate replies (including any API keys you configure yourself), our search
          lookups, and our email provider for verification and account emails. Each receives only
          what is necessary.
        </p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <p>
          Conversations and memories stay until you delete them or close your account. Account
          records are kept while your account exists; logs are kept for a short period.
        </p>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>
          You can access, export, correct or delete your data. Conversations can be deleted or
          exported from the chat; memories can be cleared in settings. For account deletion or any
          data request, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If you are in
          the UK or EU you also have the right to complain to your data protection authority.
        </p>
      </section>
      <section>
        <h2>Security</h2>
        <p>
          Data is stored in access-controlled databases with per-account rules so only you (and, for
          support purposes, the operator) can reach your content. Uploaded files live in private
          storage accessed through short-lived signed links.
        </p>
      </section>
      <section>
        <h2>Children</h2>
        <p>Aria is not intended for anyone under 13, and under-18s should have parental consent.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>
          If this policy changes materially, we will update this page and, where appropriate, notify
          you by email.
        </p>
      </section>
    </LegalPage>
  );
}
