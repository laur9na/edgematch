/**
 * supabase/functions/send-tryout-email/index.ts
 *
 * Called via Supabase Database Webhook on the tryouts table.
 * Configure in dashboard: Database > Webhooks > New webhook
 *   Table: tryouts
 *   Events: INSERT, UPDATE
 *   URL: {SUPABASE_URL}/functions/v1/send-tryout-email
 *   Method: POST
 *
 * Sends:
 *   - status = 'requested'  -> email to recipient
 *   - status = 'confirmed'  -> email to requester
 *
 * Uses Resend API (RESEND_API_KEY env var).
 * FROM address: EdgeMatch <noreply@edgematch.app>  (configure in Resend dashboard)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY') ?? '';
const APP_URL            = Deno.env.get('APP_URL') ?? 'https://edgematch.app';
const FROM_EMAIL         = 'EdgeMatch <noreply@edgematch.app>';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface TryoutRecord {
  id: string;
  requester_id: string;
  recipient_id: string;
  proposed_date: string | null;
  proposed_time: string | null;
  location_note: string | null;
  status: string;
  outcome: string | null;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: TryoutRecord;
  old_record: TryoutRecord | null;
}

async function getAthlete(id: string) {
  const { data } = await supabase
    .from('athletes')
    .select('id, name, email')
    .eq('id', id)
    .single();
  return data;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email send');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend error ${res.status}: ${body}`);
  }
}

function formatDate(date: string | null, time: string | null): string {
  if (!date) return 'TBD';
  const d = new Date(date);
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return time ? `${dateStr} at ${time}` : dateStr;
}

async function handleRequested(tryout: TryoutRecord) {
  const [requester, recipient] = await Promise.all([
    getAthlete(tryout.requester_id),
    getAthlete(tryout.recipient_id),
  ]);
  if (!recipient?.email) { console.warn('Recipient has no email'); return; }

  const requesterUrl = `${APP_URL}/athletes/${requester?.id}`;
  const dateStr = formatDate(tryout.proposed_date, tryout.proposed_time);

  const html = `
<p>Hi ${recipient.name ?? 'there'},</p>

<p><strong>${requester?.name ?? 'A skater'}</strong> has sent you a try-out request on EdgeMatch.</p>

<p><strong>Proposed date:</strong> ${dateStr}</p>
${tryout.location_note ? `<p><strong>Location:</strong> ${tryout.location_note}</p>` : ''}

<p><a href="${requesterUrl}" style="display:inline-block;background:#c9a96e;color:#0d1b2e;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:700;">View their profile</a></p>

<p style="color:#888;font-size:12px;">You are receiving this because you are registered on EdgeMatch. <a href="${APP_URL}/tryouts">Manage your try-out requests</a>.</p>
`;

  await sendEmail(recipient.email, `Try-out request from ${requester?.name ?? 'a skater'}`, html);
  console.log(`Sent 'requested' email to ${recipient.email}`);
}

async function handleConfirmed(tryout: TryoutRecord) {
  const [requester, recipient] = await Promise.all([
    getAthlete(tryout.requester_id),
    getAthlete(tryout.recipient_id),
  ]);
  if (!requester?.email) { console.warn('Requester has no email'); return; }

  const dateStr = formatDate(tryout.proposed_date, tryout.proposed_time);

  const html = `
<p>Hi ${requester.name ?? 'there'},</p>

<p>Your try-out request with <strong>${recipient?.name ?? 'your match'}</strong> has been confirmed.</p>

<p><strong>Date:</strong> ${dateStr}</p>
${tryout.location_note ? `<p><strong>Location:</strong> ${tryout.location_note}</p>` : ''}

<p><a href="${APP_URL}/tryouts" style="display:inline-block;background:#c9a96e;color:#0d1b2e;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:700;">View your try-outs</a></p>

<p style="color:#888;font-size:12px;">You are receiving this because you requested a try-out on EdgeMatch.</p>
`;

  await sendEmail(requester.email, `Try-out confirmed with ${recipient?.name ?? 'your match'}`, html);
  console.log(`Sent 'confirmed' email to ${requester.email}`);
}

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { type, record, old_record } = payload;
  const newStatus = record?.status;
  const oldStatus = old_record?.status;

  console.log(`Tryout ${record?.id}: ${oldStatus ?? 'new'} -> ${newStatus}`);

  try {
    // DISABLED: soft launch — manual matching only
    // if (type === 'INSERT' && newStatus === 'requested') {
    //   await handleRequested(record);
    // } else if (type === 'UPDATE' && newStatus !== oldStatus) {
    //   if (newStatus === 'requested') await handleRequested(record);
    //   else if (newStatus === 'confirmed') await handleConfirmed(record);
    // }
    console.log(`Tryout email skipped (soft launch): ${record?.id} -> ${newStatus}`);
  } catch (err) {
    console.error('Email handler error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
