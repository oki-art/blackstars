-- 041 · Lista diaria de María (lunes a jueves): Barrer y Control de baño
-- Las marcas van en la tabla que ya existe (limpieza_checks) con las claves "dia-barrer" y "dia-bano".
-- 1) Solo se pueden marcar o quitar el mismo día (hora de España). Un día olvidado se queda sin hacer.
-- 2) Cuando están las dos de hoy, llega un aviso (campana y móvil) a la administración y a quien tenga
--    "Limpieza: recibir el informe" (Adela). Una sola vez por día. María no lo recibe.
-- Solo se añaden una regla y una función. No se toca ningún dato.

create or replace function public.limpieza_diaria_solo_hoy() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.tarea like 'dia-%' and old.fecha <> v_hoy then
    raise exception 'La lista diaria solo se puede marcar el mismo día';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.tarea like 'dia-%' and new.fecha <> v_hoy then
    raise exception 'La lista diaria solo se puede marcar el mismo día';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists limpieza_checks_diaria on public.limpieza_checks;
create trigger limpieza_checks_diaria before insert or update or delete on public.limpieza_checks
  for each row execute function public.limpieza_diaria_solo_hoy();

create or replace function public.aviso_limpieza_diaria(p_fecha date)
returns int language plpgsql security definer set search_path = public as $$
declare v_nombre text; v_texto text; v_enlace text; v_n int := 0;
begin
  if not public.puede_escribir('limpieza') then raise exception 'permission denied'; end if;
  if (select count(distinct tarea) from public.limpieza_checks
       where fecha = p_fecha and tarea in ('dia-barrer', 'dia-bano')) < 2 then return 0; end if;
  v_enlace := '#/limpieza?t=infdiario&mes=' || to_char(p_fecha, 'YYYY-MM') || '&dia=' || p_fecha;
  if exists (select 1 from public.notificaciones where enlace = v_enlace) then return 0; end if;   -- ya avisado hoy
  select nombre into v_nombre from public.perfiles where id = auth.uid();
  select string_agg(case tarea when 'dia-barrer' then 'Barrer' else 'Control de baño' end || ' a las '
           || to_char(hecho_en at time zone 'Europe/Madrid', 'HH24:MI'), ' · ' order by hecho_en)
    into v_texto from public.limpieza_checks where fecha = p_fecha and tarea in ('dia-barrer', 'dia-bano');
  insert into public.notificaciones (perfil_id, tipo, titulo, texto, enlace, creado_por)
  select p.id, 'aviso',
         left('Limpieza diaria hecha · ' || to_char(p_fecha, 'DD/MM') || ' · ' || coalesce(split_part(trim(v_nombre), ' ', 1), ''), 200),
         left(coalesce(v_texto, ''), 4000), v_enlace, auth.uid()
  from public.perfiles p
  where p.activo and p.id <> auth.uid() and p.borrado_en is null
    and (p.rol = 'admin' or exists (select 1 from public.permisos pe where pe.perfil_id = p.id and pe.modulo = 'limpieza_informe' and pe.puede_ver));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.aviso_limpieza_diaria(date) from public, anon;
grant execute on function public.aviso_limpieza_diaria(date) to authenticated;
