import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string }).email;
    if (!email) return { sent: false };

    const { sendEmail, welcomeEmailHtml } = await import("./email.server");
    const name = email.split("@")[0];
    await sendEmail({
      to: email,
      subject: "Welcome to Aria",
      html: welcomeEmailHtml(name),
    });
    return { sent: true };
  });
