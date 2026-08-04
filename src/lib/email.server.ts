const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailInput) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey || !resendKey) throw new Error("Email is not configured");

  const response = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: "Aria <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Resend request failed [${response.status}]: ${body}`);
    throw new Error(`Email failed [${response.status}]: ${body}`);
  }

  return response.json();
}

export function welcomeEmailHtml(name: string) {
  return `
  <div style="background:#08090c;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#0e1014;border:1px solid #1e2128;border-radius:18px;padding:36px;color:#e8e9ee;">
      <h1 style="margin:0 0 14px;font-size:26px;font-weight:500;letter-spacing:-0.02em;">Welcome to Aria, ${name}</h1>
      <p style="margin:0 0 14px;line-height:1.6;color:#a7abb8;">
        Aria is your personal AI companion — intelligent, warm and genuinely capable.
        Your conversations sync across every device you sign in on.
      </p>
      <p style="margin:0 0 24px;line-height:1.6;color:#a7abb8;">
        Pick a model, ask anything, and Aria will remember what matters.
      </p>
      <p style="margin:0;font-size:12px;color:#6b7080;">Aria was created by Kamran (Zaid Shaik).</p>
    </div>
  </div>`;
}
