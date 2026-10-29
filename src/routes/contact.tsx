import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL, OWNER } from "@/lib/legal";
import { sendContactMessage } from "@/lib/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Aria — Get in touch" },
      {
        name: "description",
        content:
          "Send a message to the team behind Aria for support, feedback, account or privacy requests.",
      },
      { property: "og:title", content: "Contact Aria — Get in touch" },
      { property: "og:description", content: "Send a message to the team behind Aria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    subject: typeof search.subject === "string" ? search.subject.slice(0, 150) : undefined,
  }),
  component: Contact,
});

const inputClass =
  "mt-1.5 w-full rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary";

function Contact() {
  const send = useServerFn(sendContactMessage);
  const { subject: presetSubject } = Route.useSearch();
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;

    setStatus("sending");
    setError(null);
    try {
      await send({
        data: {
          name: values.name ?? "",
          email: values.email ?? "",
          subject: values.subject ?? "",
          message: values.message ?? "",
        },
      });
      setStatus("sent");
      form.reset();
    } catch (err) {
      setStatus("idle");
      const message = err instanceof Error ? err.message : "";
      setError(
        /valid email|too long|little more|add your name|add a subject|too many/i.test(message)
          ? message
          : "That didn't send. Please try again, or email us directly.",
      );
    }
  }

  return (
    <LegalPage
      title="Contact"
      intro={`Questions, feedback, bug reports or data requests — send a message and ${OWNER} will get back to you.`}
    >
      {status === "sent" ? (
        <div className="rounded-2xl border border-border/60 bg-background/50 p-6 text-center">
          <h2>Message sent</h2>
          <p className="mt-2">
            Thanks for reaching out — we'll reply to you by email as soon as we can.
          </p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-border/60 px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-foreground">Your name</span>
              <input name="name" required maxLength={100} className={inputClass} placeholder="Alex Rivera" />
            </label>
            <label className="block">
              <span className="text-sm text-foreground">Email</span>
              <input
                name="email"
                type="email"
                required
                maxLength={255}
                className={inputClass}
                placeholder="you@example.com"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm text-foreground">Subject</span>
            <input name="subject" defaultValue={presetSubject ?? ""} required maxLength={150} className={inputClass} placeholder="How can we help?" />
          </label>
          <label className="block">
            <span className="text-sm text-foreground">Message</span>
            <textarea
              name="message"
              required
              minLength={10}
              maxLength={2000}
              rows={6}
              className={`${inputClass} resize-y`}
              placeholder="Tell us what's going on…"
            />
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={status === "sending"}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send message"}
            </button>
            <span className="text-xs">
              Or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </span>
          </div>
        </form>
      )}
    </LegalPage>
  );
}
