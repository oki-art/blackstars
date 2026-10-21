// "Ver como": la administración mira la app tal como la ve otra persona del equipo (solo la administración puede llamarlo).
// Devuelve un código de un solo uso para abrir una sesión de esa persona; mientras tanto la app no deja cambiar nada.
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
    if (!p || p.rol !== 'admin' || !p.activo) return resp({ error: 'Solo la administración puede ver la app como otra persona' }, 403);

    const { perfil_id } = await req.json();
    if (!perfil_id || perfil_id === yo.user.id) return resp({ error: 'Elige a otra persona del equipo' }, 400);
    const { data: otra } = await admin.from('perfiles').select('rol,activo,borrado_en').eq('id', perfil_id).maybeSingle();
    if (!otra || otra.borrado_en || !otra.activo) return resp({ error: 'Esa persona no puede entrar en la app' }, 400);
    if (otra.rol === 'admin') return resp({ error: 'Tiene acceso completo: ve lo mismo que tú' }, 400);
    const { data: u } = await admin.auth.admin.getUserById(perfil_id);
    if (!u || !u.user || !u.user.email) return resp({ error: 'Esa persona no tiene usuario' }, 400);
    // Enlace de entrada sin enviar ningún correo: solo se usa su código, una vez
    const { data: enlace, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email });
    if (error || !enlace || !enlace.properties || !enlace.properties.hashed_token) return resp({ error: 'No se pudo abrir su vista' }, 500);
    return resp({ ok: true, token_hash: enlace.properties.hashed_token });
  } catch (_e) {
    return resp({ error: 'Algo ha fallado' }, 500);
  }
});
