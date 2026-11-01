-- 031 · Contabilidad mensual (pagos al equipo y compras)
-- Una parte de la Caja que solo ve la administración, y quien tenga el permiso nuevo "Contabilidad" (p. ej. Adela).
--   · Profesoras: precio por hora del mes (8 / 10 / 12,5 / 15 €) × horas del mes que calcula la app.
--   · Cuota fija (María): cuota del mes; si falta días se resta lo proporcional. Plus o extra para todas.
--   · Al pagar se apunta un gasto en Caja marcado como "contabilidad": quien no tiene el permiso no lo ve.
--   · Las compras (camisetas, material…) que se apunten desde aquí también quedan marcadas así.
-- Solo se añade: un permiso, un apartado de caja, una columna en caja y una tabla nueva. No se toca ningún dato.

alter table public.permisos drop constraint if exists permisos_modulo_check;
alter table public.permisos add constraint permisos_modulo_check check (modulo in (
  'alumnas','profesoras','clases','inscripciones','incidencias','normas','caja',
  'eventos','formularios','escuelas_amigas','logros','iniciativas','documentos','pilates','contabilidad'));

alter table public.caja drop constraint if exists caja_apartado_check;
alter table public.caja add constraint caja_apartado_check
  check (apartado in ('mensualidad','evento','ventas','escuela_amiga','limpieza','papeleria','decoracion','material','local','cambio','equipo','otro'));

alter table public.caja add column if not exists contabilidad boolean not null default false;
create index if not exists caja_contabilidad_idx on public.caja (contabilidad) where contabilidad;

create or replace function public.ve_contabilidad() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or public.puede_ver('contabilidad');
$$;
create or replace function public.escribe_contabilidad() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or public.puede_escribir('contabilidad');
$$;

-- Caja: lo de contabilidad solo lo ve y lo toca quien tiene ese permiso; lo demás, igual que en la 026
alter policy caja_select on public.caja using (
  case when contabilidad then (select public.ve_contabilidad())
  when pilates
    then (select public.ve_caja_pilates())
         and (clase_id is null or not (select public.solo_propias('pilates')) or clase_id in (select public.mis_clases()))
    else (select public.ve_caja_general())
         and not coalesce(clase_id = any ((select public.privadas_caja_ocultas())::uuid[]), false)
  end);
alter policy caja_insert on public.caja with check (
  case when contabilidad then (select public.escribe_contabilidad())
  when pilates then (select public.escribe_caja_pilates()) else (select public.escribe_caja_general()) end);
alter policy caja_update on public.caja
  using (case when contabilidad then (select public.escribe_contabilidad())
    when pilates
    then (select public.escribe_caja_pilates())
         and (clase_id is null or not (select public.solo_propias('pilates')) or clase_id in (select public.mis_clases()))
    else (select public.escribe_caja_general()) end)
  with check (case when contabilidad then (select public.escribe_contabilidad())
    when pilates then (select public.escribe_caja_pilates()) else (select public.escribe_caja_general()) end);
-- Deshacer un pago de contabilidad (borrar su gasto): administración o quien edita Contabilidad
alter policy caja_delete on public.caja using (
  (select public.es_admin()) or (contabilidad and (select public.escribe_contabilidad())));

-- Lo que se paga a cada persona cada mes
--   persona: 'p:<id de profesora>', 'e:<id de perfil>' (equipo sin ficha) o 'n:<nombre>' (persona añadida a mano)
create table if not exists public.pagos_equipo (
  id          uuid primary key default gen_random_uuid(),
  mes         text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  persona     text not null check (length(persona) between 3 and 140),
  nombre      text not null check (length(trim(nombre)) between 1 and 120),
  tipo        text not null check (tipo in ('horas','fija')),
  tarifa      numeric(8,2) check (tarifa is null or tarifa >= 0),      -- € por hora (por horas)
  horas       numeric(8,2) check (horas is null or horas >= 0),        -- horas del mes que se pagaron
  cuota       numeric(10,2) check (cuota is null or cuota >= 0),       -- cuota fija del mes
  horas_semana numeric(6,2) check (horas_semana is null or horas_semana > 0),
  dias_semana smallint check (dias_semana is null or dias_semana between 1 and 7),
  dias_falta  smallint not null default 0 check (dias_falta between 0 and 31),
  pluses      jsonb not null default '[]'::jsonb check (jsonb_typeof(pluses) = 'array'),
  total       numeric(10,2) not null default 0,
  caja_id     uuid references public.caja(id) on delete set null,     -- pagado: su gasto en Caja
  creado_por     uuid default auth.uid() references public.perfiles(id),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id),
  modificado_en  timestamptz,
  unique (mes, persona)
);
create index if not exists pagos_equipo_mes_idx on public.pagos_equipo (mes);

drop trigger if exists auditar_pagos_equipo on public.pagos_equipo;
create trigger auditar_pagos_equipo before insert or update on public.pagos_equipo
  for each row execute function public.auditar();

alter table public.pagos_equipo enable row level security;
drop policy if exists pagos_equipo_select on public.pagos_equipo;
drop policy if exists pagos_equipo_insert on public.pagos_equipo;
drop policy if exists pagos_equipo_update on public.pagos_equipo;
drop policy if exists pagos_equipo_delete on public.pagos_equipo;
create policy pagos_equipo_select on public.pagos_equipo for select using ((select public.ve_contabilidad()));
create policy pagos_equipo_insert on public.pagos_equipo for insert with check ((select public.escribe_contabilidad()));
create policy pagos_equipo_update on public.pagos_equipo for update
  using ((select public.escribe_contabilidad())) with check ((select public.escribe_contabilidad()));
create policy pagos_equipo_delete on public.pagos_equipo for delete using ((select public.escribe_contabilidad()));
grant select, insert, update, delete on public.pagos_equipo to authenticated;
revoke all on public.pagos_equipo from anon;

-- La vista de la caja con autor vuelve a leer todas las columnas (incluida la nueva)
drop view if exists public.caja_con_autor;
create view public.caja_con_autor with (security_invoker = true) as
  select c.*, p.nombre as registrado_por
  from public.caja c left join public.perfiles p on p.id = c.creado_por;
grant select on public.caja_con_autor to authenticated;
revoke all on public.caja_con_autor from anon;

revoke all on function public.ve_contabilidad(), public.escribe_contabilidad() from public, anon;
grant execute on function public.ve_contabilidad(), public.escribe_contabilidad() to authenticated;

-- María, con su cuota fija (200 € al mes, 8 h a la semana en 4 días), para que salga ya este mes
insert into public.pagos_equipo (mes, persona, nombre, tipo, cuota, horas_semana, dias_semana, total)
values (to_char(now(), 'YYYY-MM'), 'n:maría', 'María', 'fija', 200, 8, 4, 200)
on conflict (mes, persona) do nothing;
