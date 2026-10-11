-- 002 · Una clase puede tener varios días y horarios (p. ej. lunes y miércoles de 17 a 18).
-- Hay una sola sala ("Principal"): dos clases activas no pueden coincidir el mismo día a la misma hora.
set local search_path = public, extensions;

create table public.clase_horarios (
  id          uuid primary key default gen_random_uuid(),
  clase_id    uuid not null references public.clases(id) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 1 and 7),   -- 1 = lunes
  hora_inicio time not null,
  hora_fin    time not null,
  activa      boolean not null default true,   -- copia de clases.activa (la mantiene un trigger)
  check (hora_fin > hora_inicio),
  exclude using gist (
    dia_semana with =,
    tsrange(timestamp '2000-01-01' + hora_inicio, timestamp '2000-01-01' + hora_fin) with &&
  ) where (activa)
);
create index on public.clase_horarios (clase_id);

-- Pasar los horarios que ya existen
insert into public.clase_horarios (clase_id, dia_semana, hora_inicio, hora_fin, activa)
select id, dia_semana, hora_inicio, hora_fin, activa from public.clases;

-- activa del horario = activa de su clase
create or replace function public.horario_activa()
returns trigger language plpgsql set search_path = public as $$
begin
  new.activa := coalesce((select c.activa from public.clases c where c.id = new.clase_id), true);
  return new;
end; $$;
create trigger horario_activa before insert or update on public.clase_horarios
  for each row execute function public.horario_activa();

create or replace function public.clase_activa_a_horarios()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.activa is distinct from old.activa then
    update public.clase_horarios set activa = new.activa where clase_id = new.id;
  end if;
  return new;
end; $$;
create trigger clase_activa_a_horarios after update of activa on public.clases
  for each row execute function public.clase_activa_a_horarios();
revoke all on function public.horario_activa() from public, anon, authenticated;
revoke all on function public.clase_activa_a_horarios() from public, anon, authenticated;

-- Seguridad: igual que las clases
alter table public.clase_horarios enable row level security;
create policy clase_horarios_select on public.clase_horarios for select using (
  public.puede_ver('clases')
  and (not public.solo_propias('clases') or clase_id in (select public.mis_clases())));
create policy clase_horarios_insert on public.clase_horarios for insert with check (public.puede_escribir('clases'));
create policy clase_horarios_update on public.clase_horarios for update using (public.puede_escribir('clases')) with check (public.puede_escribir('clases'));
create policy clase_horarios_delete on public.clase_horarios for delete using (public.puede_escribir('clases'));
revoke all on public.clase_horarios from anon;

-- Los horarios se guardan desde la app (borra los de la clase e inserta los nuevos;
-- si alguno choca, vuelve a poner los que tenía). No se usa función en la base de datos.

-- La cuota de escuela amiga ahora suma todos los horarios de sus clases
create or replace view public.escuela_amiga_resumen with (security_invoker = true) as
  select e.id, e.nombre, e.tarifa_hora_semana, e.activa,
         coalesce(h.horas_semana, 0)  as horas_semana,
         coalesce(k.n_clases, 0)      as n_clases,
         coalesce(k.n_alumnas, 0)     as n_alumnas,
         round(coalesce(h.horas_semana, 0) * e.tarifa_hora_semana, 2) as cuota_mensual
  from public.escuelas_amigas e
  left join (
    select c.escuela_amiga_id, sum(extract(epoch from (ch.hora_fin - ch.hora_inicio)) / 3600.0) as horas_semana
    from public.clase_horarios ch join public.clases c on c.id = ch.clase_id
    where c.activa and c.escuela_amiga_id is not null
    group by c.escuela_amiga_id
  ) h on h.escuela_amiga_id = e.id
  left join (
    select c.escuela_amiga_id, count(*) as n_clases, sum(coalesce(c.alumnas_externas, 0)) as n_alumnas
    from public.clases c where c.activa and c.escuela_amiga_id is not null
    group by c.escuela_amiga_id
  ) k on k.escuela_amiga_id = e.id;
revoke all on public.escuela_amiga_resumen from anon;

-- clases.dia_semana / hora_inicio / hora_fin se mantienen como copia del primer horario
-- (la app los rellena) para no borrar ni cambiar columnas existentes. La sala deja de usarse (null).
