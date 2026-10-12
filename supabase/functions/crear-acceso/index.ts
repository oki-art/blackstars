// Da acceso a la app a una persona nueva (solo la administración puede llamarlo).
// Crea su usuario con email y contraseña, pone su nombre, la enlaza con su ficha de profesora
// (si la hay) y le pone los permisos de la plantilla elegida.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const resp = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    // ¿Quién llama? Tiene que ser administración activa
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: yo } = await admin.auth.getUser(token);
    if (!yo || !yo.user) return resp({ error: 'Tienes que haber entrado en la app' }, 401);
    const { data: p } = await admin.from('perfiles').select('rol,activo').eq('id', yo.user.id).maybeSingle();
    if (!p || p.rol !== 'admin' || !p.activo) return resp({ error: 'Solo la administración puede dar acceso' }, 403);

    const { nombre, email, clave, profesora_id, permisos } = await req.json();
    if (!nombre || !email || !clave || String(clave).length < 8) return resp({ error: 'Faltan datos (la contraseña necesita 8 caracteres o más)' }, 400);
    const { data: nuevo, error } = await admin.auth.admin.createUser({ email: String(email).trim().toLowerCase(), password: String(clave), email_confirm: true, user_metadata: { nombre, cambiar_clave: true } });
    if (error || !nuevo.user) return resp({ error: /already|registered|exists/i.test(error?.message || '') ? 'Ese email ya tiene acceso' : 'No se pudo crear el usuario' }, 400);
    const id = nuevo.user.id;
    await admin.from('perfiles').update({ nombre: String(nombre).trim() }).eq('id', id);
    if (profesora_id) await admin.from('profesoras').update({ perfil_id: id }).eq('id', profesora_id);
    if (Array.isArray(permisos) && permisos.length) {
      await admin.from('permisos').insert(permisos.slice(0, 20).map((x: { modulo: string; puede_ver: boolean; puede_escribir: boolean; solo_propias: boolean }) => ({
        perfil_id: id, modulo: x.modulo, puede_ver: !!x.puede_ver, puede_escribir: !!x.puede_escribir, solo_propias: !!x.solo_propias })));
    }
    return resp({ ok: true, id });
  } catch (_e) {
    return resp({ error: 'Algo ha fallado' }, 500);
  }
});
