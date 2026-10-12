-- 006 · Avisos (campana + notificación al móvil) y Documentos (enviar, descargar, devolver firmado).
-- Solo añade: tablas nuevas, un almacén privado de archivos "documentos", la extensión pg_net
-- (para avisar al servicio que manda la notificación al móvil) y el módulo "documentos" en Permisos.

create extension if not exists pg_net with schema extensions;

-- ---------- NOTIFICACIONES ----------
-- Una fila por persona y aviso. El punto de la campana = filas sin leer.
create table public.notificaciones (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  tipo       text not null default 'aviso' check (tipo in ('aviso','norma','evento','iniciativa','documento')),
  titulo     text not null check (length(titulo) between 1 and 200),
  texto      text check (length(texto) <= 4000),
  enlace     text check (enlace is null or enlace like '#/%'),
  leida_en   timestamptz,
  push_enviada boolean not null default false,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en  timestamptz not null default now()
);
create index on public.notificaciones (perfil_id, creado_en desc);

-- Móviles donde cada persona ha activado los avisos
create table public.push_suscripciones (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  creado_en  timestamptz not null default now()
);

-- ¿Puede esta persona ver este módulo? (para decidir a quién avisar)
create or replace function public.perfil_puede_ver(p_perfil uuid, p_modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles p where p.id = p_perfil and p.activo and (p.rol = 'admin'
    or exists (select 1 from public.permisos pe where pe.perfil_id = p.id and pe.modulo = p_modulo and pe.puede_ver)));
$$;

-- Crea una notificación para cada persona que puede ver el módulo (menos quien lo ha hecho)
create or replace function public.avisar_modulo(p_modulo text, p_tipo text, p_titulo text, p_texto text, p_enlace text)
returns void language sql security definer set search_path = public as $$
  insert into public.notificaciones (perfil_id, tipo, titulo, texto, enlace, creado_por)
  select p.id, p_tipo, p_titulo, p_texto, p_enlace, auth.uid() from public.perfiles p
  where p.activo and p.id is distinct from auth.uid() and public.perfil_puede_ver(p.id, p_modulo);
$$;

create or replace function public.aviso_norma() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.activa then perform public.avisar_modulo('normas', 'norma', 'Norma nueva: ' || new.titulo, left(new.contenido, 300), '#/normas'); end if;
  return new;
end; $$;
create trigger aviso_norma after insert on public.normas for each row execute function public.aviso_norma();

create or replace function public.aviso_evento() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.avisar_modulo('eventos', 'evento', 'Evento nuevo: ' || new.titulo, to_char(new.fecha, 'DD/MM/YYYY'), '#/evento/' || new.id);
  return new;
end; $$;
create trigger aviso_evento after insert on public.eventos for each row execute function public.aviso_evento();

create or replace function public.aviso_iniciativa() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.creado_por is not null and new.creado_por is distinct from auth.uid()
     and (new.estado is distinct from old.estado or new.respuesta is distinct from old.respuesta) then
    insert into public.notificaciones (perfil_id, tipo, titulo, texto, enlace)
    values (new.creado_por, 'iniciativa', 'Respuesta a tu iniciativa: ' || new.titulo, new.respuesta, '#/iniciativa/' || new.id);
  end if;
  return new;
end; $$;
create trigger aviso_iniciativa after update on public.iniciativas for each row execute function public.aviso_iniciativa();

-- Al crear una notificación, se pide al servicio "enviar-push" que la mande al móvil
create or replace function public.lanzar_push() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://cwgkmdxdvzrqtgpgqrru.supabase.co/functions/v1/enviar-push',
    body := jsonb_build_object('id', new.id),
    headers := '{"Content-Type":"application/json"}'::jsonb);
  return new;
exception when others then return new;  -- si falla el aviso al móvil, la notificación se guarda igual
end; $$;
create trigger lanzar_push after insert on public.notificaciones for each row execute function public.lanzar_push();

alter table public.notificaciones enable row level security;
alter table public.push_suscripciones enable row level security;
create policy notificaciones_select on public.notificaciones for select using (perfil_id = auth.uid());
create policy notificaciones_update on public.notificaciones for update using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
-- Avisos escritos a mano: solo la administración
create policy notificaciones_insert on public.notificaciones for insert with check (public.es_admin());
create policy notificaciones_delete on public.notificaciones for delete using (perfil_id = auth.uid() or public.es_admin());
-- Quien la recibe solo puede marcarla como leída
create or replace function public.solo_marcar_leida() returns trigger language plpgsql set search_path = public as $$
begin
  if not public.es_admin() then
    new.perfil_id := old.perfil_id; new.tipo := old.tipo; new.titulo := old.titulo; new.texto := old.texto;
    new.enlace := old.enlace; new.push_enviada := old.push_enviada; new.creado_por := old.creado_por; new.creado_en := old.creado_en;
  end if;
  return new;
end; $$;
create trigger solo_marcar_leida before update on public.notificaciones for each row execute function public.solo_marcar_leida();

create policy push_select on public.push_suscripciones for select using (perfil_id = auth.uid());
create policy push_insert on public.push_suscripciones for insert with check (perfil_id = auth.uid());
create policy push_delete on public.push_suscripciones for delete using (perfil_id = auth.uid());

-- ---------- DOCUMENTOS ----------
create or replace function public.gestiona_documentos()
returns boolean language sql stable security definer set search_path = public as $$
  select public.puede_escribir('documentos') and not public.solo_propias('documentos');
$$;

create table public.documentos (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null check (length(titulo) between 1 and 200),
  nota            text check (length(nota) <= 2000),
  para_perfil     uuid not null references public.perfiles(id) on delete cascade,
  archivo         text not null,          -- ruta en el almacén "documentos"
  pide_firma      boolean not null default true,
  estado          text not null default 'pendiente' check (estado in ('pendiente','firmado','visto')),
  archivo_firmado text,
  devuelto_en     timestamptz,
  creado_por      uuid default auth.uid() references public.perfiles(id),
  creado_en       timestamptz not null default now(),
  modificado_por  uuid references public.perfiles(id),
  modificado_en   timestamptz
);
create index on public.documentos (para_perfil, creado_en desc);
create trigger auditar_documentos before insert or update on public.documentos for each row execute function public.auditar();

-- Quien lo recibe solo puede devolver el firmado (o marcarlo como visto)
create or replace function public.documento_solo_devolver() returns trigger language plpgsql set search_path = public as $$
begin
  if not public.gestiona_documentos() then
    new.titulo := old.titulo; new.nota := old.nota; new.para_perfil := old.para_perfil;
    new.archivo := old.archivo; new.pide_firma := old.pide_firma;
    if new.archivo_firmado is distinct from old.archivo_firmado then new.devuelto_en := now(); end if;
  end if;
  return new;
end; $$;
create trigger documento_solo_devolver before update on public.documentos for each row execute function public.documento_solo_devolver();

create or replace function public.aviso_documento() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notificaciones (perfil_id, tipo, titulo, texto, enlace)
    values (new.para_perfil, 'documento', 'Documento nuevo: ' || new.titulo,
            case when new.pide_firma then 'Descárgalo, fírmalo y súbelo firmado.' else new.nota end, '#/documento/' || new.id);
  elsif new.estado = 'firmado' and old.estado <> 'firmado' and new.creado_por is not null then
    insert into public.notificaciones (perfil_id, tipo, titulo, enlace)
    values (new.creado_por, 'documento', 'Documento firmado: ' || new.titulo, '#/documento/' || new.id);
  end if;
  return new;
end; $$;
create trigger aviso_documento after insert or update on public.documentos for each row execute function public.aviso_documento();

alter table public.documentos enable row level security;
create policy documentos_select on public.documentos for select using (public.gestiona_documentos() or para_perfil = auth.uid());
create policy documentos_insert on public.documentos for insert with check (public.gestiona_documentos());
create policy documentos_update on public.documentos for update
  using (public.gestiona_documentos() or para_perfil = auth.uid()) with check (public.gestiona_documentos() or para_perfil = auth.uid());
create policy documentos_delete on public.documentos for delete using (public.es_admin());

create or replace view public.documentos_con_autor with (security_invoker = true) as
  select d.*, p.nombre as registrado_por from public.documentos d left join public.perfiles p on p.id = d.creado_por;

-- Personas a las que se puede enviar un documento (nombre e id), solo para quien gestiona documentos
create or replace function public.destinatarias()
returns table (id uuid, nombre text) language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from public.perfiles p where p.activo and (public.gestiona_documentos() or public.es_admin()) order by p.nombre;
$$;

-- Almacén privado de archivos (máx. 10 MB; PDF y fotos)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760, array['application/pdf','image/jpeg','image/png','image/heic'])
on conflict (id) do nothing;

-- Rutas: <id del documento>/original.ext y <id del documento>/firmado.ext
create policy documentos_archivos_ver on storage.objects for select to authenticated using (
  bucket_id = 'documentos' and (public.gestiona_documentos() or exists (
    select 1 from public.documentos d where d.id::text = (storage.foldername(name))[1] and d.para_perfil = auth.uid())));
create policy documentos_archivos_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'documentos' and (public.gestiona_documentos() or (storage.filename(name) like 'firmado.%' and exists (
    select 1 from public.documentos d where d.id::text = (storage.foldername(name))[1] and d.para_perfil = auth.uid()))));
create policy documentos_archivos_cambiar on storage.objects for update to authenticated using (
  bucket_id = 'documentos' and (public.gestiona_documentos() or (storage.filename(name) like 'firmado.%' and exists (
    select 1 from public.documentos d where d.id::text = (storage.foldername(name))[1] and d.para_perfil = auth.uid()))));
create policy documentos_archivos_borrar on storage.objects for delete to authenticated using (bucket_id = 'documentos' and public.es_admin());

-- Permisos de funciones
revoke all on public.notificaciones, public.push_suscripciones, public.documentos, public.documentos_con_autor from anon;
do $$
declare f text;
begin
  foreach f in array array['public.perfil_puede_ver(uuid,text)','public.avisar_modulo(text,text,text,text,text)',
    'public.aviso_norma()','public.aviso_evento()','public.aviso_iniciativa()','public.lanzar_push()',
    'public.aviso_documento()','public.solo_marcar_leida()','public.documento_solo_devolver()']
  loop execute format('revoke all on function %s from public, anon, authenticated', f); end loop;
  foreach f in array array['public.gestiona_documentos()','public.destinatarias()']
  loop execute format('revoke all on function %s from public, anon', f); execute format('grant execute on function %s to authenticated', f); end loop;
end; $$;

-- Nuevo módulo "documentos" en Permisos (enviar documentos; recibirlos no necesita permiso)
alter table public.permisos drop constraint permisos_modulo_check;
alter table public.permisos add constraint permisos_modulo_check check (modulo in (
  'alumnas','profesoras','clases','inscripciones','incidencias','normas','caja',
  'eventos','formularios','escuelas_amigas','logros','iniciativas','documentos'));
