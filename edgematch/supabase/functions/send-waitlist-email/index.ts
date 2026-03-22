/**
 * supabase/functions/send-waitlist-email/index.ts
 *
 * Called from the frontend after a user submits the waitlist intake form.
 * Sends two emails via Resend:
 *   1. Confirmation to the user — warm, personal, no links
 *   2. Notification to Laurena — all submitted fields as a simple list
 *
 * Invoke: POST {SUPABASE_URL}/functions/v1/send-waitlist-email
 * Auth:   anon key (no JWT required — public endpoint)
 */

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL      = 'EdgeMatch <hello@edgematch.co>';
const NOTIFY_EMAIL    = 'laurenaletter@gmail.com';

interface WaitlistPayload {
  first_name: string;
  last_name: string;
  email: string;
  discipline?: string;
  skating_level?: string;
  partner_role?: string;
  height?: string;
  location_city?: string;
  location_country?: string;
  jump_direction?: string;
  willing_to_relocate?: string;
  goals?: string;
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: WaitlistPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const {
    first_name, last_name, email,
    discipline, skating_level, partner_role,
    height, location_city, location_country,
    jump_direction, willing_to_relocate, goals,
  } = payload;

  if (!email || !first_name) {
    return new Response('Missing required fields', { status: 400 });
  }

  const fullName = `${first_name} ${last_name}`.trim();

  // Email 1 — to the user
  const userText = `Hi ${first_name},

Thanks for submitting your matching request. We received everything and we'll be in touch within 48 hours.

— Laurena
Founder, EdgeMatch`;

  // Email 2 — to Laurena
  const adminLines = [
    `Name: ${fullName}`,
    discipline         ? `Discipline: ${discipline}`                : null,
    skating_level      ? `Level: ${skating_level}`                  : null,
    partner_role       ? `Role: ${partner_role}`                    : null,
    height             ? `Height: ${height}`                        : null,
    location_city      ? `Location: ${location_city}${location_country ? ', ' + location_country : ''}` : null,
    jump_direction     ? `Jump direction: ${jump_direction}`        : null,
    willing_to_relocate ? `Willing to relocate: ${willing_to_relocate}` : null,
    goals              ? `Looking for: ${goals}`                    : null,
  ].filter(Boolean) as string[];

  const adminText = adminLines.join('\n');

  try {
    await Promise.all([
      sendEmail(email, "You're on the list.", userText),
      sendEmail(NOTIFY_EMAIL, `New signup: ${fullName}`, adminText),
    ]);
  } catch (err) {
    console.error('Email send failed:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
