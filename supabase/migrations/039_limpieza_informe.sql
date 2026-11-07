-- 039 · Informe de limpieza: cuando María pulsa "Terminar limpieza", se guarda el informe del día
-- y les llega un aviso (campana y notificación del móvil) a la administración y a quien tenga el permiso nuevo
-- "Limpieza: recibir el informe" (Adela). Quien marca la limpieza (María) no recibe el aviso ni ve el informe.

alter table public.permisos drop constraint if exists permisos_modulo_check;
alter table public.permisos add constraint permisos_modulo_check check (modulo in (
  'alumnas','profesoras','clases','inscripciones','incidencias','normas','caja',
  'eventos','formularios','escuelas_amigas','logros','iniciativas','documentos','pilates','contabilidad','limpieza','limpieza_informe'));
-- Solo se añade una tabla y una función. Además deshace el cambio de prueba del 7-nov (viernes 13 → sábado 7).

create table if not exists public.limpieza_informes (
  fecha          date primary key,
  hechas         int not null default 0,
  total          int not null default 0,
  terminado_por  uuid references public.perfiles(id) on delete set null,
  terminado_nombre text,
  terminado_en   timestamptz not null default now()
);
alter table public.limpieza_informes enable row level security;
drop policy if exists limpieza_informes_select on public.limpieza_informes;
create policy limpieza_informes_select on public.limpieza_informes for select using ((select public.puede_ver('limpieza')) or (select public.puede_ver('limpieza_informe')));
-- Quien recibe el informe también puede leer las tareas marcadas (para ver el informe)
drop policy if exists limpieza_checks_select on public.limpieza_checks;
create policy limpieza_checks_select on public.limpieza_checks for select using ((select public.puede_ver('limpieza')) or (select public.puede_ver('limpieza_informe')));
revoke all on public.limpieza_informes from anon;
grant select on public.limpieza_informes to authenticated;

-- Terminar: guarda el informe y avisa (menos a quien lo termina). p_resumen = "5 de 16 hechas · faltan …" (lo arma la app)
create or replace function public.terminar_limpieza(p_fecha date, p_hechas int, p_total int, p_resumen text)
returns int language plpgsql security definer set search_path = public as $$
declare v_nombre text; v_n int := 0; v_titulo text;
begin
  if not public.puede_escribir('limpieza') then raise exception 'permission denied'; end if;
  if p_fecha > current_date + 1 then raise exception 'Esa limpieza todavía no ha llegado'; end if;
  select nombre into v_nombre from public.perfiles where id = auth.uid();
  insert into public.limpieza_informes (fecha, hechas, total, terminado_por, terminado_nombre, terminado_en)
  values (p_fecha, greatest(p_hechas, 0), greatest(p_total, 0), auth.uid(), v_nombre, now())
  on conflict (fecha) do update set hechas = excluded.hechas, total = excluded.total,
    terminado_por = excluded.terminado_por, terminado_nombre = excluded.terminado_nombre, terminado_en = now();
  v_titulo := 'Informe de limpieza · ' || to_char(p_fecha, 'DD/MM') || ' · ' || coalesce(split_part(trim(v_nombre), ' ', 1), '');
  insert into public.notificaciones (perfil_id, tipo, titulo, texto, enlace, creado_por)
  select p.id, 'aviso', left(v_titulo, 200), left(coalesce(p_resumen, ''), 4000), '#/limpieza?t=informe&dia=' || p_fecha, auth.uid()
  from public.perfiles p
  where p.activo and p.id <> auth.uid() and p.borrado_en is null
    and (p.rol = 'admin' or exists (select 1 from public.permisos pe where pe.perfil_id = p.id and pe.modulo = 'limpieza_informe' and pe.puede_ver));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.terminar_limpieza(date, int, int, text) from public, anon;
grant execute on function public.terminar_limpieza(date, int, int, text) to authenticated;

-- Deshace la prueba del 7-nov: el viernes 13 vuelve a su sitio (solo si no se marcó nada el sábado 7)
delete from public.limpieza_cambios
 where viernes = '2026-11-13' and nueva = '2026-11-07'
   and not exists (select 1 from public.limpieza_checks where fecha = '2026-11-07');
