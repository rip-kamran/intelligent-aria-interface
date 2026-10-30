// Server-only: runs shell commands in an isolated E2B cloud sandbox.
// Hand-rolled over fetch (REST + Connect streaming) so it works on the edge runtime.

type Sandbox = { id: string; token?: string; domain: string; expiresAt: number };

const SANDBOX_TTL_S = 600; // each user's sandbox lives 10 minutes after last use
const CMD_TIMEOUT_MS = 60_000;
const MAX_OUTPUT = 16_000;
const sandboxes = new Map<string, Sandbox>();

function apiKey() {
  const key = process.env.E2B_API_KEY;
  if (!key) throw new Error("Command line is not configured yet (missing E2B_API_KEY).");
  return key;
}

async function createSandbox(): Promise<Sandbox> {
  const res = await fetch("https://api.e2b.dev/sandboxes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey() },
    body: JSON.stringify({ templateID: "base", timeout: SANDBOX_TTL_S }),
  });
  if (!res.ok) throw new Error(`Sandbox start failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  const d = (await res.json()) as { sandboxID: string; envdAccessToken?: string; domain?: string };
  return {
    id: d.sandboxID,
    token: d.envdAccessToken,
    domain: d.domain || "e2b.app",
    expiresAt: Date.now() + (SANDBOX_TTL_S - 30) * 1000,
  };
}

async function extendSandbox(sb: Sandbox) {
  await fetch(`https://api.e2b.dev/sandboxes/${sb.id}/timeout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey() },
    body: JSON.stringify({ timeout: SANDBOX_TTL_S }),
  }).catch(() => {});
  sb.expiresAt = Date.now() + (SANDBOX_TTL_S - 30) * 1000;
}

async function getSandbox(userId: string, fresh = false): Promise<Sandbox> {
  const existing = sandboxes.get(userId);
  if (existing && !fresh && existing.expiresAt > Date.now()) {
    void extendSandbox(existing);
    return existing;
  }
  const sb = await createSandbox();
  sandboxes.set(userId, sb);
  return sb;
}

function b64decode(s: string) {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
}

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut?: boolean;
  error?: string;
};

async function execIn(sb: Sandbox, command: string, cwd?: string): Promise<CommandResult> {
  const msg = new TextEncoder().encode(
    JSON.stringify({
      process: { cmd: "/bin/bash", args: ["-l", "-c", command], envs: {}, cwd: cwd || undefined },
      stdin: false,
    }),
  );
  const body = new Uint8Array(5 + msg.length);
  new DataView(body.buffer).setUint32(1, msg.length);
  body.set(msg, 5);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CMD_TIMEOUT_MS);
  const out: CommandResult = { stdout: "", stderr: "", exitCode: null };
  try {
    const res = await fetch(`https://49983-${sb.id}.${sb.domain}/process.Process/Start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/connect+json",
        "Connect-Protocol-Version": "1",
        "Keepalive-Ping-Interval": "50",
        ...(sb.token ? { "X-Access-Token": sb.token } : {}),
      },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Sandbox request failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
    }
    const reader = res.body.getReader();
    let buf = new Uint8Array(0);
    for (;;) {
      const { value, done } = await reader.read();
      if (value) {
        const n = new Uint8Array(buf.length + value.length);
        n.set(buf);
        n.set(value, buf.length);
        buf = n;
      }
      while (buf.length >= 5) {
        const flags = buf[0]!;
        const len = new DataView(buf.buffer, buf.byteOffset).getUint32(1);
        if (buf.length < 5 + len) break;
        const json = JSON.parse(new TextDecoder().decode(buf.slice(5, 5 + len)) || "{}");
        buf = buf.slice(5 + len);
        if (flags & 0x02) {
          if (json.error) out.error = json.error.message ?? String(json.error.code);
          continue;
        }
        const ev = json.event ?? {};
        if (ev.data?.stdout && out.stdout.length < MAX_OUTPUT) out.stdout += b64decode(ev.data.stdout);
        if (ev.data?.stderr && out.stderr.length < MAX_OUTPUT) out.stderr += b64decode(ev.data.stderr);
        if (ev.end) {
          out.exitCode = ev.end.exitCode ?? 0;
          if (ev.end.error) out.error = ev.end.error;
        }
      }
      if (done) break;
    }
  } catch (e) {
    if (ctrl.signal.aborted) out.timedOut = true;
    else throw e;
  } finally {
    clearTimeout(timer);
  }
  out.stdout = out.stdout.slice(0, MAX_OUTPUT);
  out.stderr = out.stderr.slice(0, MAX_OUTPUT);
  return out;
}

/** Runs a bash command in the user's own sandbox (created on first use, reused for 10 minutes). */
export async function runCommand(userId: string, command: string, cwd?: string): Promise<CommandResult> {
  let sb = await getSandbox(userId);
  try {
    return await execIn(sb, command, cwd);
  } catch {
    // Sandbox may have expired server-side; retry once on a fresh one.
    sb = await getSandbox(userId, true);
    return await execIn(sb, command, cwd);
  }
}

export function commandLineEnabled() {
  return !!process.env.E2B_API_KEY;
}
