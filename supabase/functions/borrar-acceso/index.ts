// Borra a una persona del equipo (solo la administración puede llamarlo).
// Su usuario se borra "suave": no puede volver a entrar, pero su perfil se queda para que
// lo que apuntó siga diciendo quién lo hizo. Se le quitan los permisos y la ficha de profesora queda sin enlazar.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const resp = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: yo } = await admin.auth.getUser(token);
    if (!yo || !yo.user) return resp({ error: 'Tienes que haber entrado en la app' }, 401);
    const { data: p } = await admin.from('perfiles').select('rol,activo').eq('id', yo.user.id).maybeSingle();
    if (!p || p.rol !== 'admin' || !p.activo) return resp({ error: 'Solo la administración puede borrar personas' }, 403);

    const { id } = await req.json();
    if (!id || id === yo.user.id) return resp({ error: 'No puedes borrarte a ti' }, 400);
    const { data: otra } = await admin.from('perfiles').select('rol').eq('id', id).maybeSingle();
    if (!otra) return resp({ error: 'Esa persona no existe' }, 404);
    if (otra.rol === 'admin') return resp({ error: 'No se puede borrar a otra administración' }, 400);

    const { error } = await admin.auth.admin.deleteUser(id, true);
    if (error) return resp({ error: 'No se pudo borrar su acceso' }, 500);
    await admin.from('permisos').delete().eq('perfil_id', id);
    await admin.from('push_suscripciones').delete().eq('perfil_id', id);
    await admin.from('profesoras').update({ perfil_id: null }).eq('perfil_id', id);
    await admin.from('perfiles').update({ activo: false, borrado_en: new Date().toISOString() }).eq('id', id);
    return resp({ ok: true });
  } catch (_e) {
    return resp({ error: 'Algo ha fallado' }, 500);
  }
});
