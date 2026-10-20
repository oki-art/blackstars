-- 020 · Clases privadas (Pilates)
-- Una clase marcada como privada (Pilates) solo la ven la administración, quien tenga el permiso "Pilates"
-- (Adela) y su profesora. María no ve la clase, ni sus alumnas, ni sus cobros.
-- Su profesora, con el permiso Pilates en Editar, apunta alumnas con ficha corta (con la edad) y cobra en efectivo.
-- No se borra nada: se añaden dos columnas, unas funciones y una condición más en lo que cada persona puede leer.

-- Nuevo permiso "pilates"
alter table public.permisos drop constraint permisos_modulo_check;
alter table public.permisos add constraint permisos_modulo_check check (modulo in (
  'alumnas','profesoras','clases','inscripciones','incidencias','normas','caja',
  'eventos','formularios','escuelas_amigas','logros','iniciativas','documentos','pilates'));

alter table public.clases  add column if not exists privada boolean not null default false;
alter table public.alumnas add column if not exists edad smallint check (edad between 1 and 120);

-- ¿Es privada esta clase?
create or replace function public.es_privada(p_clase uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select privada from public.clases where id = p_clase), false);
$$;

-- ¿Ve esta clase privada? La administración, su profesora y quien tenga el permiso Pilates (sin "solo lo suyo")
create or replace function public.ve_privada(p_clase uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or p_clase in (select public.mis_clases())
      or (public.puede_ver('pilates') and not public.solo_propias('pilates'));
$$;

-- ¿Ve los cobros de esta clase privada? Hace falta el permiso Pilates (la profesora, solo los de su clase)
create or replace function public.ve_caja_privada(p_clase uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or (public.puede_ver('pilates')
      and (not public.solo_propias('pilates') or p_clase in (select public.mis_clases())));
$$;

-- ¿Puede apuntar alumnas y cobrar en esta clase privada?
create or replace function public.gestiona_privada(p_clase uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_privada(p_clase) and (public.es_admin() or (public.puede_escribir('pilates')
      and (not public.solo_propias('pilates') or p_clase in (select public.mis_clases()))));
$$;

-- Una alumna que solo está en clases privadas solo la ve quien ve alguna de esas clases
create or replace function public.alumna_visible_privada(p_alumna uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.inscripciones i join public.clases c on c.id = i.clase_id
                     where i.alumna_id = p_alumna and c.privada)
      or exists (select 1 from public.inscripciones i join public.clases c on c.id = i.clase_id
                 where i.alumna_id = p_alumna and (not c.privada or public.ve_privada(c.id)));
$$;

-- Lo que cada persona puede leer: lo de antes y, además, nada de una clase privada que no le toca
alter policy clases_select on public.clases using (
  public.puede_ver('clases')
  and (not public.solo_propias('clases') or id in (select public.mis_clases()))
  and (not privada or public.ve_privada(id)));

alter policy alumnas_select on public.alumnas using (
  public.puede_ver('alumnas')
  and (not public.solo_propias('alumnas') or id in (select public.mis_alumnas()))
  and public.alumna_visible_privada(id));

alter policy inscripciones_select on public.inscripciones using (
  public.puede_ver('inscripciones')
  and (not public.solo_propias('inscripciones') or clase_id in (select public.mis_clases()))
  and (not public.es_privada(clase_id) or public.ve_privada(clase_id)));

-- Caja: quien ve la caja ve todo menos lo de clases privadas que no le tocan;
-- la profesora de Pilates (con el permiso) ve los cobros de su clase aunque no vea la caja
alter policy caja_select on public.caja using (
  (public.puede_ver('caja') and (clase_id is null or not public.es_privada(clase_id) or public.ve_caja_privada(clase_id)))
  or (clase_id is not null and public.es_privada(clase_id) and public.ve_caja_privada(clase_id)));

-- Cobrar una mensualidad (solo efectivo). Una alumna no puede tener dos cobros en el mismo mes y clase.
create or replace function public.cobrar_privada(p_clase uuid, p_alumna uuid, p_importe numeric, p_medio boolean default false, p_mes date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.clases; ini date := date_trunc('month', p_mes)::date; fin date := (date_trunc('month', p_mes) + interval '1 month')::date; nueva uuid;
begin
  if not public.gestiona_privada(p_clase) then raise exception 'No tienes permiso para cobrar en esta clase'; end if;
  if p_importe is null or p_importe <= 0 then raise exception 'El importe tiene que ser mayor que 0'; end if;
  if not exists (select 1 from public.inscripciones where alumna_id = p_alumna and clase_id = p_clase) then
    raise exception 'Esa alumna no está en esta clase'; end if;
  -- Un doble toque no cobra dos veces
  perform pg_advisory_xact_lock(hashtext(p_alumna::text || p_clase::text));
  if exists (select 1 from public.caja where alumna_id = p_alumna and clase_id = p_clase and tipo = 'ingreso' and fecha >= ini and fecha < fin) then
    raise exception 'Esa alumna ya tiene cobrado este mes'; end if;
  select * into c from public.clases where id = p_clase;
  insert into public.caja (fecha, tipo, concepto, importe, metodo, alumna_id, clase_id, apartado)
  values (case when current_date >= ini and current_date < fin then current_date else ini end, 'ingreso',
          'Mensualidad ' || c.nombre || case when p_medio then ' · medio mes' else '' end, p_importe, 'efectivo', p_alumna, p_clase, 'mensualidad')
  returning id into nueva;
  return nueva;
end; $$;

-- Apuntar una alumna (ficha corta) en la clase y, si ya ha pagado, cobrarle el mes
create or replace function public.apuntar_alumna_privada(p_clase uuid, p_nombre text, p_apellidos text, p_email text, p_telefono text,
  p_edad integer, p_importe numeric default null, p_medio boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare nueva uuid;
begin
  if not public.gestiona_privada(p_clase) then raise exception 'No tienes permiso para apuntar alumnas en esta clase'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre'; end if;
  insert into public.alumnas (nombre, apellidos, email, telefono, edad)
  values (trim(p_nombre), nullif(trim(p_apellidos), ''), nullif(trim(p_email), ''), nullif(trim(p_telefono), ''), p_edad)
  returning id into nueva;
  insert into public.inscripciones (alumna_id, clase_id) values (nueva, p_clase);
  if p_importe is not null then perform public.cobrar_privada(p_clase, nueva, p_importe, p_medio); end if;
  return nueva;
end; $$;

-- Deshacer un cobro hecho por error
create or replace function public.borrar_cobro_privada(p_caja uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.caja;
begin
  select * into r from public.caja where id = p_caja;
  if not found or r.clase_id is null or not public.gestiona_privada(r.clase_id) then raise exception 'No puedes borrar ese cobro'; end if;
  delete from public.caja where id = p_caja;
end; $$;

-- Borrar una alumna apuntada por error: se quita de la clase con sus cobros de esa clase;
-- su ficha se borra solo si no está en ninguna otra clase
create or replace function public.borrar_alumna_privada(p_alumna uuid, p_clase uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.gestiona_privada(p_clase) then raise exception 'No tienes permiso para borrar alumnas en esta clase'; end if;
  if not exists (select 1 from public.inscripciones where alumna_id = p_alumna and clase_id = p_clase) then
    raise exception 'Esa alumna no está en esta clase'; end if;
  delete from public.caja where alumna_id = p_alumna and clase_id = p_clase;
  delete from public.inscripciones where alumna_id = p_alumna and clase_id = p_clase;
  if not exists (select 1 from public.inscripciones where alumna_id = p_alumna) then
    delete from public.alumnas where id = p_alumna; end if;
end; $$;

revoke all on function public.es_privada(uuid), public.ve_privada(uuid), public.ve_caja_privada(uuid), public.gestiona_privada(uuid),
  public.alumna_visible_privada(uuid), public.cobrar_privada(uuid, uuid, numeric, boolean, date),
  public.apuntar_alumna_privada(uuid, text, text, text, text, integer, numeric, boolean),
  public.borrar_cobro_privada(uuid), public.borrar_alumna_privada(uuid, uuid) from public, anon;
grant execute on function public.es_privada(uuid), public.ve_privada(uuid), public.ve_caja_privada(uuid), public.gestiona_privada(uuid),
  public.alumna_visible_privada(uuid), public.cobrar_privada(uuid, uuid, numeric, boolean, date),
  public.apuntar_alumna_privada(uuid, text, text, text, text, integer, numeric, boolean),
  public.borrar_cobro_privada(uuid), public.borrar_alumna_privada(uuid, uuid) to authenticated;

-- Para que Supabase vea las columnas nuevas enseguida
notify pgrst, 'reload schema';
