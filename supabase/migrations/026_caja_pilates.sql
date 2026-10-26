-- 026 · Caja de Pilates separada de la caja general
-- Dos cajas que no se mezclan:
--   · Caja general (clases de niñas, eventos, escuela amiga, gastos de recepción): la ve quien tiene el permiso Caja.
--   · Caja de Pilates (cobros de las clases de Pilates y sus gastos): la ve quien tiene el permiso Pilates.
--   · La administración ve las dos.
-- La profesora de Pilates solo ve la caja de Pilates, aunque tenga encendido el permiso Caja.
-- No se borra nada: se añade una columna y se marcan como Pilates los cobros de Pilates que ya hay.

alter table public.caja add column if not exists pilates boolean not null default false;

update public.caja set pilates = true
where not pilates and clase_id in (select id from public.clases where privada);

create index if not exists caja_pilates_idx on public.caja (pilates) where pilates;

-- ¿Es la profesora de Pilates? Tiene el permiso Pilates y es profesora ("solo lo suyo")
-- o da alguna clase de Pilates. A ella no se le enseña la caja general.
create or replace function public.es_caja_pilates() returns boolean
language sql stable security definer set search_path = public as $$
  select not public.es_admin() and public.puede_ver('pilates') and (
    public.solo_propias('pilates')
    or exists (select 1 from public.permisos pe where pe.perfil_id = auth.uid() and pe.solo_propias and pe.modulo <> 'iniciativas')
    or exists (select 1 from public.clases c join public.profesoras pr on pr.id = c.profesora_id
               where c.privada and pr.perfil_id = auth.uid()));
$$;

-- Caja general: permiso Caja y no ser la profesora de Pilates
create or replace function public.ve_caja_general() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or (public.puede_ver('caja') and not public.es_caja_pilates());
$$;
create or replace function public.escribe_caja_general() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or (public.puede_escribir('caja') and not public.es_caja_pilates());
$$;

-- Caja de Pilates: permiso Pilates. Con "solo lo suyo", los cobros solo de sus clases (los gastos de Pilates, todos).
create or replace function public.ve_caja_pilates() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or public.puede_ver('pilates');
$$;
create or replace function public.escribe_caja_pilates() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or public.puede_escribir('pilates');
$$;

-- Lo de Pilates se marca solo: un cobro de una clase de Pilates, o cualquier cosa que apunte su profesora
create or replace function public.marcar_caja_pilates() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.clase_id is not null and exists (select 1 from public.clases where id = new.clase_id and privada) then
    new.pilates := true;
  elsif public.es_caja_pilates() then
    new.pilates := true;
  end if;
  return new;
end; $$;
drop trigger if exists marcar_caja_pilates on public.caja;
create trigger marcar_caja_pilates before insert or update on public.caja
  for each row execute function public.marcar_caja_pilates();

-- Quién ve cada movimiento
alter policy caja_select on public.caja using (
  case when pilates
    then (select public.ve_caja_pilates())
         and (clase_id is null or not (select public.solo_propias('pilates')) or clase_id in (select public.mis_clases()))
    else (select public.ve_caja_general())
         and not coalesce(clase_id = any ((select public.privadas_caja_ocultas())::uuid[]), false)
  end);

-- Quién apunta y corrige (borrar sigue siendo solo de la administración)
alter policy caja_insert on public.caja with check (
  case when pilates then (select public.escribe_caja_pilates()) else (select public.escribe_caja_general()) end);
alter policy caja_update on public.caja
  using (case when pilates
    then (select public.escribe_caja_pilates())
         and (clase_id is null or not (select public.solo_propias('pilates')) or clase_id in (select public.mis_clases()))
    else (select public.escribe_caja_general()) end)
  with check (case when pilates then (select public.escribe_caja_pilates()) else (select public.escribe_caja_general()) end);

-- Lo que colgaba del permiso Caja (ventas de eventos, horas del equipo) pasa a ser de la caja general
alter policy evento_articulos_select on public.evento_articulos
  using ((select public.ve_caja_general()) or evento_id in (select id from public.eventos));
alter policy evento_reservas_select on public.evento_reservas
  using ((select public.ve_caja_general()) or evento_id in (select id from public.eventos));
create or replace function public.gestiona_ventas() returns boolean language sql stable security definer set search_path = public as $$
  select public.puede_escribir('eventos') or public.escribe_caja_general();
$$;
alter policy dias_sin_clase_select on public.dias_sin_clase using ((select public.ve_caja_general()));
alter policy dias_sin_clase_insert on public.dias_sin_clase with check ((select public.escribe_caja_general()));
alter policy dias_sin_clase_update on public.dias_sin_clase using ((select public.escribe_caja_general())) with check ((select public.escribe_caja_general()));
alter policy dias_sin_clase_delete on public.dias_sin_clase using ((select public.escribe_caja_general()));
alter policy clases_cambios_select on public.clases_cambios using ((select public.ve_caja_general()));
alter policy clases_cambios_insert on public.clases_cambios with check ((select public.escribe_caja_general()));
alter policy clases_cambios_update on public.clases_cambios using ((select public.escribe_caja_general())) with check ((select public.escribe_caja_general()));
alter policy clases_cambios_delete on public.clases_cambios using ((select public.escribe_caja_general()));

-- La vista con autor se rehace para que incluya la columna nueva
drop view if exists public.caja_con_autor;
create view public.caja_con_autor with (security_invoker = true) as
  select c.*, p.nombre as registrado_por
  from public.caja c left join public.perfiles p on p.id = c.creado_por;
grant select on public.caja_con_autor to authenticated;
revoke all on public.caja_con_autor from anon;

revoke all on function public.es_caja_pilates(), public.ve_caja_general(), public.escribe_caja_general(),
  public.ve_caja_pilates(), public.escribe_caja_pilates(), public.marcar_caja_pilates() from public, anon;
grant execute on function public.es_caja_pilates(), public.ve_caja_general(), public.escribe_caja_general(),
  public.ve_caja_pilates(), public.escribe_caja_pilates() to authenticated;

notify pgrst, 'reload schema';
