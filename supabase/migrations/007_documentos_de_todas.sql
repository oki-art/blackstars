-- 007 · Documentos: cualquiera del equipo puede subir un documento a la administración
-- (además de devolver firmados), y ve el historial de lo que ha enviado.
-- Solo cambia reglas de acceso; no toca datos.

-- ¿Recibe documentos esta persona? (administración o quien gestiona Documentos)
create or replace function public.recibe_documentos(p_perfil uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles p where p.id = p_perfil and p.activo and (p.rol = 'admin'
    or exists (select 1 from public.permisos pe where pe.perfil_id = p.id and pe.modulo = 'documentos' and pe.puede_escribir and not pe.solo_propias)));
$$;

-- A quién puedo enviar: quien gestiona, a todo el equipo; el resto, a la administración
create or replace function public.destinatarias()
returns table (id uuid, nombre text) language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from public.perfiles p
  where p.activo and (public.gestiona_documentos() or public.es_admin() or public.recibe_documentos(p.id))
  order by p.nombre;
$$;

alter policy documentos_select on public.documentos using (
  public.gestiona_documentos() or para_perfil = auth.uid() or creado_por = auth.uid());
alter policy documentos_insert on public.documentos with check (
  public.gestiona_documentos() or (creado_por = auth.uid() and not pide_firma and public.recibe_documentos(para_perfil)));

alter policy documentos_archivos_ver on storage.objects using (
  bucket_id = 'documentos' and (public.gestiona_documentos() or exists (
    select 1 from public.documentos d where d.id::text = (storage.foldername(name))[1] and (d.para_perfil = auth.uid() or d.creado_por = auth.uid()))));
alter policy documentos_archivos_subir on storage.objects with check (
  bucket_id = 'documentos' and (public.gestiona_documentos()
    or (storage.filename(name) like 'firmado.%' and exists (
      select 1 from public.documentos d where d.id::text = (storage.foldername(name))[1] and d.para_perfil = auth.uid()))
    -- documento nuevo: se sube el archivo antes de crear la ficha
    or (storage.filename(name) like 'original.%' and not exists (
      select 1 from public.documentos d where d.id::text = (storage.foldername(name))[1]))));

revoke all on function public.recibe_documentos(uuid) from public, anon;
grant execute on function public.recibe_documentos(uuid) to authenticated;
