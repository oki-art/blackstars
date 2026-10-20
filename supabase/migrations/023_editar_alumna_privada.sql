-- 023 · Editar los datos de una alumna de Pilates (y un poco más de velocidad)
-- La profesora de Pilates (con el permiso) y la administración pueden corregir o completar
-- la ficha corta de sus alumnas: nombre, apellidos, email, teléfono y edad. No se borra nada.
create or replace function public.editar_alumna_privada(p_alumna uuid, p_clase uuid, p_nombre text, p_apellidos text,
  p_email text, p_telefono text, p_edad integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.gestiona_privada(p_clase) then raise exception 'No tienes permiso para editar alumnas en esta clase'; end if;
  if not exists (select 1 from public.inscripciones where alumna_id = p_alumna and clase_id = p_clase) then
    raise exception 'Esa alumna no está en esta clase'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre'; end if;
  update public.alumnas set nombre = trim(p_nombre), apellidos = nullif(trim(p_apellidos), ''), email = nullif(trim(p_email), ''),
    telefono = nullif(trim(p_telefono), ''), edad = p_edad
  where id = p_alumna;
end; $$;
revoke all on function public.editar_alumna_privada(uuid, uuid, text, text, text, text, integer) from public, anon;
grant execute on function public.editar_alumna_privada(uuid, uuid, text, text, text, text, integer) to authenticated;

-- Alumnas que solo están en clases privadas que esta persona no ve: la lista de clases ocultas se calcula una vez
create or replace function public.alumnas_ocultas() returns uuid[]
language sql stable security definer set search_path = public as $$
  with ocultas as (select public.privadas_ocultas() as l)
  select coalesce(array_agg(distinct i.alumna_id), '{}') from public.inscripciones i, ocultas o
  where i.clase_id = any (o.l)
    and not exists (select 1 from public.inscripciones j where j.alumna_id = i.alumna_id and not (j.clase_id = any (o.l)));
$$;

notify pgrst, 'reload schema';
