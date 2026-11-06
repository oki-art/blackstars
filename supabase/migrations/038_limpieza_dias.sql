-- 038 · Días de limpieza: todos los viernes salen solos; aquí solo se guardan los cambios
--   · viernes + nueva  → ese viernes la limpieza se pasa a otro día
--   · viernes + nueva vacía → esa semana no hay limpieza
--   · viernes vacío + nueva → día extra
-- Lo ve quien ve Limpieza y lo cambia quien la edita (María, Raúl). Solo se añade una tabla.

create table if not exists public.limpieza_cambios (
  id         uuid primary key default gen_random_uuid(),
  viernes    date unique check (viernes is null or extract(isodow from viernes) = 5),
  nueva      date,
  check (viernes is not null or nueva is not null),
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_nombre text,
  creado_en  timestamptz not null default now()
);

create or replace function public.limpieza_cambios_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.creado_por := auth.uid(); new.creado_en := now();
  select nombre into new.creado_nombre from public.perfiles where id = auth.uid();
  return new;
end $$;
drop trigger if exists limpieza_cambios_autor on public.limpieza_cambios;
create trigger limpieza_cambios_autor before insert or update on public.limpieza_cambios
  for each row execute function public.limpieza_cambios_autor();

alter table public.limpieza_cambios enable row level security;
drop policy if exists limpieza_cambios_select on public.limpieza_cambios;
create policy limpieza_cambios_select on public.limpieza_cambios for select using ((select public.puede_ver('limpieza')));
drop policy if exists limpieza_cambios_insert on public.limpieza_cambios;
create policy limpieza_cambios_insert on public.limpieza_cambios for insert with check ((select public.puede_escribir('limpieza')));
drop policy if exists limpieza_cambios_update on public.limpieza_cambios;
create policy limpieza_cambios_update on public.limpieza_cambios for update using ((select public.puede_escribir('limpieza'))) with check ((select public.puede_escribir('limpieza')));
drop policy if exists limpieza_cambios_delete on public.limpieza_cambios;
create policy limpieza_cambios_delete on public.limpieza_cambios for delete using ((select public.puede_escribir('limpieza')));

revoke all on public.limpieza_cambios from anon;
grant select, insert, update, delete on public.limpieza_cambios to authenticated;
