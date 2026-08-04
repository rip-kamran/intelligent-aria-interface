import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends the Aria welcome email once per user. Safe to call on every sign-in. */
export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string }).email;
    if (!email) return { sent: false };

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("welcome_email_sent_at, display_name")
      .eq("id", context.userId)
      .maybeSingle();

    if (profile?.welcome_email_sent_at) return { sent: false };

    const { sendEmail, welcomeEmailHtml } = await import("./email.server");
    const name = profile?.display_name || email.split("@")[0];
    await sendEmail({
      to: email,
      subject: "Welcome to Aria",
      html: welcomeEmailHtml(name),
    });

    await context.supabase
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", context.userId);

    return { sent: true };
  });
