// Manda al móvil una notificación recién creada en la tabla "notificaciones".
// La llama la base de datos (disparador lanzar_push) con { id }. Solo envía avisos de los
// últimos 2 minutos que aún no se hayan enviado, así que repetir la llamada no hace nada.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails('mailto:kieroserai@gmail.com', Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);

Deno.serve(async (req) => {
  try {
    const { id } = await req.json();
    if (typeof id !== 'string') return new Response('falta id', { status: 400 });
    const hace2min = new Date(Date.now() - 120000).toISOString();
    // Marca como enviada a la vez que la lee: si llegan dos llamadas, solo una la envía
    const { data: n } = await sb.from('notificaciones').update({ push_enviada: true })
      .eq('id', id).eq('push_enviada', false).gte('creado_en', hace2min).select('perfil_id,titulo,texto,enlace').maybeSingle();
    if (!n) return new Response('nada que enviar');
    const { data: subs } = await sb.from('push_suscripciones').select('id,endpoint,p256dh,auth').eq('perfil_id', n.perfil_id);
    const carga = JSON.stringify({ titulo: n.titulo, texto: n.texto || '', enlace: n.enlace || '#/avisos' });
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 86400 });
      } catch (e) {
        // Móvil que ya no acepta avisos (app borrada o permiso quitado): se olvida
        if (e && (e.statusCode === 404 || e.statusCode === 410)) await sb.from('push_suscripciones').delete().eq('id', s.id);
      }
    }));
    return new Response('ok');
  } catch (_e) {
    return new Response('error', { status: 500 });
  }
});
