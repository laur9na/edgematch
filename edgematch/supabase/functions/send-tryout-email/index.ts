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
 * On every new tryout request, sends a notification email to
 * laurenaletter@gmail.com with full details so she can
 * manually contact the clubs and pair them.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const APP_URL          = Deno.env.get('APP_URL') ?? 'https://app.edgematch.co';
const FROM_EMAIL       = 'EdgeMatch <onboarding@resend.dev>';
const LAURENA_EMAIL    = 'laurenaletter@gmail.com';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface TryoutRecord {
  id: string;
  requester_id: string;
  recipient_id: string;
  proposed_date: string | null;
  proposed_time: string | null;
  location_note: string | null;
  status: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: TryoutRecord;
  old_record: TryoutRecord | null;
}

async function getAthleteWithClub(id: string) {
  const { data } = await supabase
    .from('athletes')
    .select('id, name, email, discipline, skating_level, partner_role, location_city, location_state, club_name, clubs(name, contact_email, website, phone, city, state)')
    .eq('id', id)
    .single();
  return data;
}

function levelLabel(l: string | null): string {
  const map: Record<string, string> = {
    pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile', intermediate: 'Intermediate',
    novice: 'Novice', junior: 'Junior', senior: 'Senior', adult: 'Adult',
  };
  return l ? (map[l] ?? l) : '';
}

function disciplineLabel(d: string | null): string {
  return d === 'pairs' ? 'Pairs' : d === 'ice_dance' ? 'Ice dance' : (d ?? '');
}

function roleLabel(r: string | null): string {
  return r === 'man' ? 'Man' : r === 'lady' ? 'Lady' : (r ?? '');
}

function formatDate(date: string | null, time: string | null): string {
  if (!date) return 'TBD';
  const d = new Date(date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return time ? `${dateStr} at ${time}` : dateStr;
}

function athleteBlock(a: any, label: string): string {
  if (!a) return `<p><em>${label} info unavailable</em></p>`;
  const club = a.clubs ?? null;
  const loc = [a.location_city, a.location_state].filter(Boolean).join(', ');
  const clubName = club?.name ?? a.club_name ?? null;
  const clubCity = [club?.city, club?.state].filter(Boolean).join(', ');

  return `
<table style="border:1px solid #e2e8f0;border-radius:4px;padding:12px 16px;margin:8px 0;background:#f8fafc;width:100%;border-collapse:collapse;">
  <tr><td colspan="2" style="font-weight:700;font-size:15px;padding:4px 8px;color:#0d1b2e;">${a.name}</td></tr>
  <tr><td style="padding:3px 8px;color:#64748b;width:120px;">Discipline</td><td style="padding:3px 8px;">${disciplineLabel(a.discipline)} · ${levelLabel(a.skating_level)} · ${roleLabel(a.partner_role)}</td></tr>
  ${loc ? `<tr><td style="padding:3px 8px;color:#64748b;">Location</td><td style="padding:3px 8px;">${loc}</td></tr>` : ''}
  ${a.email ? `<tr><td style="padding:3px 8px;color:#64748b;">Email</td><td style="padding:3px 8px;"><a href="mailto:${a.email}">${a.email}</a></td></tr>` : ''}
  ${clubName ? `<tr><td style="padding:3px 8px;color:#64748b;vertical-align:top;">Club</td><td style="padding:3px 8px;"><strong>${clubName}</strong>${clubCity ? ` · ${clubCity}` : ''}${club?.contact_email ? `<br><a href="mailto:${club.contact_email}">${club.contact_email}</a>` : ''}${club?.website ? `<br><a href="${club.website}">${club.website}</a>` : ''}${club?.phone ? `<br>${club.phone}` : ''}</td></tr>` : ''}
</table>`;
}

async function notifyLaurena(tryout: TryoutRecord) {
  const [requester, recipient] = await Promise.all([
    getAthleteWithClub(tryout.requester_id),
    getAthleteWithClub(tryout.recipient_id),
  ]);

  const dateStr = formatDate(tryout.proposed_date, tryout.proposed_time);

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<h2 style="color:#0d1b2e;margin-bottom:4px;">New try-out request on EdgeMatch</h2>
<p style="color:#64748b;margin-top:0;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">

<p style="margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;">Requested by</p>
${athleteBlock(requester, 'Requester')}

<p style="margin:16px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;">Wants to try out with</p>
${athleteBlock(recipient, 'Recipient')}

<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">

<p><strong>Proposed date:</strong> ${dateStr}</p>
${tryout.location_note ? `<p><strong>Location note:</strong> ${tryout.location_note}</p>` : ''}

<p style="margin-top:20px;">
  <a href="${APP_URL}/matches" style="display:inline-block;background:#c9a96e;color:#0d1b2e;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:700;font-size:14px;">View in EdgeMatch</a>
</p>

<p style="color:#94a3b8;font-size:12px;margin-top:24px;">EdgeMatch · automated notification</p>
</div>`;

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set : skipping email');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: LAURENA_EMAIL,
      subject: `Try-out request: ${requester?.name ?? '?'} + ${recipient?.name ?? '?'}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend error ${res.status}: ${body}`);
  } else {
    console.log(`Notified ${LAURENA_EMAIL}: ${requester?.name} -> ${recipient?.name}`);
  }
}

Deno.serve(async (req: Request) => {
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
    if (type === 'INSERT' && newStatus === 'requested') {
      await notifyLaurena(record);
    } else if (type === 'UPDATE' && newStatus === 'requested' && oldStatus !== 'requested') {
      await notifyLaurena(record);
    }
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
