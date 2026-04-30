// Supabase Edge Function: schickt Expo Push Notifications an eine Liste von
// Usern. Wird vom Postgres-Trigger `posts_looking_notify` aufgerufen — und
// kann grundsätzlich auch von anderen Triggers/Server-Code genutzt werden
// (z. B. Chat, Event-Reminder).
//
// Aufruf:
//   POST /functions/v1/send-push
//   Authorization: Bearer <SERVICE_ROLE_KEY>
//   Body: {
//     user_ids: string[],
//     title:    string,
//     body:     string,
//     data?:    Record<string, unknown>,
//   }
//
// Response:
//   200 → { sent: number, expo?: any }
//
// Setup:
//   supabase functions deploy send-push
//   (mit verify-jwt: nur Service-Role-Key kommt durch — das ist sicher,
//   weil der Trigger den Service-Key aus Vault holt und im Header schickt.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface RequestBody {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let payload: RequestBody;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!Array.isArray(payload.user_ids) || payload.user_ids.length === 0) {
    return jsonResponse({ sent: 0 });
  }
  if (!payload.title || !payload.body) {
    return jsonResponse({ error: 'title und body sind Pflicht' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(
      { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY fehlt' },
      500,
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token, platform')
    .in('user_id', payload.user_ids);

  if (error) {
    console.error('[send-push] token lookup', error);
    return jsonResponse({ error: 'Token lookup failed' }, 500);
  }
  if (!tokens || tokens.length === 0) {
    return jsonResponse({ sent: 0 });
  }

  // Expo Push API akzeptiert Batches bis 100 Messages. Wir bauen pro Token
  // ein Message-Object und schicken in Chunks.
  const messages = tokens
    .map((t) => t.token)
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default' as const,
      priority: 'high' as const,
    }));

  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  const results: unknown[] = [];
  for (const chunk of chunks) {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });
      const json = await res.json();
      results.push(json);
    } catch (e) {
      console.error('[send-push] expo error', e);
      results.push({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  return jsonResponse({ sent: messages.length, expo: results });
});
