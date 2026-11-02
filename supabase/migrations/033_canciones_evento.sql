-- 033 · Canciones de las profesoras en un evento (por ejemplo, la gala de Navidad)
-- Cada profesora del evento apunta sus canciones: título, artista, duración, su orden de preferencia (1, 2, 3…)
-- y puede subir el archivo de música. Ella ve y cambia solo las suyas; la administración ve las de todas y las descarga.
-- Solo se añade: una columna en eventos (casilla, quitada en todos los eventos que ya hay), una tabla y un almacén
-- de archivos nuevo. No se toca ningún dato que ya exista.

-- Casilla del evento: «Las profesoras ponen sus canciones»
alter table public.eventos add column if not exists con_canciones boolean not null default false;

-- Quién ve todas las canciones: la administración y quien edita Eventos sin «solo lo mío»
create or replace function public.gestiona_canciones()
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or (public.puede_escribir('eventos') and not public.solo_propias('eventos'));
$$;

create table if not exists public.evento_canciones (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references public.eventos(id) on delete cascade,
  profesora_id   uuid not null references public.profesoras(id) on delete cascade,
  titulo         text not null check (length(trim(titulo)) > 0),
  artista        text,
  duracion_seg   integer check (duracion_seg is null or duracion_seg between 0 and 3600),
  orden          integer not null default 1 check (orden >= 1),
  archivo        text,            -- ruta en el almacén «canciones»: <evento>/<profesora>/<nombre>
  archivo_nombre text,            -- nombre original del archivo (Sarandonga.mp3)
  archivo_bytes  bigint,
  creado_por     uuid default auth.uid() references public.perfiles(id),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id),
  modificado_en  timestamptz
);
create index if not exists evento_canciones_evento on public.evento_canciones (evento_id, profesora_id, orden);

create trigger auditar_evento_canciones before insert or update on public.evento_canciones
  for each row execute function public.auditar();

alter table public.evento_canciones enable row level security;

-- Ver: la administración todas; la profesora, las suyas
create policy evento_canciones_select on public.evento_canciones for select using (
  public.gestiona_canciones() or profesora_id = public.mi_profesora());
-- Añadir, cambiar y borrar: la administración, o la profesora las suyas y solo en eventos donde está
create policy evento_canciones_insert on public.evento_canciones for insert with check (
  public.gestiona_canciones() or (profesora_id = public.mi_profesora() and evento_id in (select public.mis_eventos())));
create policy evento_canciones_update on public.evento_canciones for update
  using (public.gestiona_canciones() or (profesora_id = public.mi_profesora() and evento_id in (select public.mis_eventos())))
  with check (public.gestiona_canciones() or (profesora_id = public.mi_profesora() and evento_id in (select public.mis_eventos())));
create policy evento_canciones_delete on public.evento_canciones for delete using (
  public.gestiona_canciones() or (profesora_id = public.mi_profesora() and evento_id in (select public.mis_eventos())));

revoke all on public.evento_canciones from anon;
grant select, insert, update, delete on public.evento_canciones to authenticated;

-- Almacén privado para la música (máx. 50 MB por archivo, el máximo del plan gratuito; solo audio)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('canciones', 'canciones', false, 52428800, array['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/m4a',
  'audio/aac','audio/x-aac','audio/wav','audio/x-wav','audio/wave','audio/ogg','audio/webm','audio/flac','audio/x-flac'])
on conflict (id) do nothing;

-- Rutas: <id del evento>/<id de la profesora>/<archivo>. La profesora solo toca su carpeta y en sus eventos.
create policy canciones_archivos_ver on storage.objects for select to authenticated using (
  bucket_id = 'canciones' and (public.gestiona_canciones() or (storage.foldername(name))[2] = public.mi_profesora()::text));
create policy canciones_archivos_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'canciones' and (public.gestiona_canciones() or ((storage.foldername(name))[2] = public.mi_profesora()::text
    and (storage.foldername(name))[1] in (select e::text from public.mis_eventos() e))));
create policy canciones_archivos_cambiar on storage.objects for update to authenticated using (
  bucket_id = 'canciones' and (public.gestiona_canciones() or ((storage.foldername(name))[2] = public.mi_profesora()::text
    and (storage.foldername(name))[1] in (select e::text from public.mis_eventos() e))));
create policy canciones_archivos_borrar on storage.objects for delete to authenticated using (
  bucket_id = 'canciones' and (public.gestiona_canciones() or (storage.foldername(name))[2] = public.mi_profesora()::text));

revoke all on function public.gestiona_canciones() from public, anon;
grant execute on function public.gestiona_canciones() to authenticated;
