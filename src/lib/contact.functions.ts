import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Please add your name").max(100, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address").max(255),
  subject: z.string().trim().min(1, "Please add a subject").max(150, "Subject is too long"),
  message: z.string().trim().min(10, "Please write a little more").max(2000, "Message is too long"),
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Public contact form submission — emails the Aria inbox. */
export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const { sendEmail } = await import("./email.server");
    const { CONTACT_EMAIL } = await import("./legal");

    const html = `
    <div style="background:#08090c;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#0e1014;border:1px solid #1e2128;border-radius:16px;padding:28px;color:#e8e9ee;">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:500;">New message from the Aria contact form</h1>
        <p style="margin:0 0 6px;color:#a7abb8;"><strong style="color:#e8e9ee;">Name:</strong> ${escapeHtml(data.name)}</p>
        <p style="margin:0 0 6px;color:#a7abb8;"><strong style="color:#e8e9ee;">Email:</strong> ${escapeHtml(data.email)}</p>
        <p style="margin:0 0 16px;color:#a7abb8;"><strong style="color:#e8e9ee;">Subject:</strong> ${escapeHtml(data.subject)}</p>
        <div style="white-space:pre-wrap;line-height:1.6;color:#e8e9ee;">${escapeHtml(data.message)}</div>
      </div>
    </div>`;

    await sendEmail({
      to: CONTACT_EMAIL,
      subject: `Aria contact — ${data.subject}`,
      html,
    });

    return { sent: true as const };
  });
