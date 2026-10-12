-- 011 · Horas de las profesoras (Caja › Horas).
-- Las horas se calculan en la app con el horario de cada clase y los días del mes.
-- Aquí solo se guardan las excepciones: días sin clase (festivos) y faltas o cambios de profesora.
-- Lo ve quien ve Caja; lo apunta quien puede editar Caja (y la administración).

create table public.dias_sin_clase (
  fecha          date primary key,
  motivo         text,
  creado_por     uuid default auth.uid() references public.perfiles(id),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id),
  modificado_en  timestamptz
);

-- Un cambio por clase y día: la cubre otra profesora, otra persona del equipo, o se anula.
create table public.clases_cambios (
  id                 uuid primary key default gen_random_uuid(),
  fecha              date not null,
  clase_id           uuid not null references public.clases(id) on delete cascade,
  falta_profesora_id uuid references public.profesoras(id),
  cubre_profesora_id uuid references public.profesoras(id),
  cubre_perfil_id    uuid references public.perfiles(id),
  anulada            boolean not null default false,
  nota               text,
  creado_por         uuid default auth.uid() references public.perfiles(id),
  creado_en          timestamptz not null default now(),
  modificado_por     uuid references public.perfiles(id),
  modificado_en      timestamptz,
  unique (fecha, clase_id),
  check (num_nonnulls(cubre_profesora_id, cubre_perfil_id) + anulada::int = 1)
);
create index on public.clases_cambios (fecha);

create trigger auditar_dias_sin_clase before insert or update on public.dias_sin_clase
  for each row execute function public.auditar();
create trigger auditar_clases_cambios before insert or update on public.clases_cambios
  for each row execute function public.auditar();

alter table public.dias_sin_clase enable row level security;
alter table public.clases_cambios enable row level security;
create policy dias_sin_clase_select on public.dias_sin_clase for select using (public.puede_ver('caja'));
create policy dias_sin_clase_insert on public.dias_sin_clase for insert with check (public.puede_escribir('caja'));
create policy dias_sin_clase_update on public.dias_sin_clase for update using (public.puede_escribir('caja')) with check (public.puede_escribir('caja'));
create policy dias_sin_clase_delete on public.dias_sin_clase for delete using (public.puede_escribir('caja'));
create policy clases_cambios_select on public.clases_cambios for select using (public.puede_ver('caja'));
create policy clases_cambios_insert on public.clases_cambios for insert with check (public.puede_escribir('caja'));
create policy clases_cambios_update on public.clases_cambios for update using (public.puede_escribir('caja')) with check (public.puede_escribir('caja'));
create policy clases_cambios_delete on public.clases_cambios for delete using (public.puede_escribir('caja'));
revoke all on public.dias_sin_clase, public.clases_cambios from anon;

-- Personas del equipo sin ficha de profesora (gestión, caja...) que también pueden cubrir una clase.
create or replace function public.equipo_sin_ficha()
returns table (id uuid, nombre text) language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from public.perfiles p
  where public.puede_ver('caja') and p.activo
    and not exists (select 1 from public.profesoras f where f.perfil_id = p.id)
  order by p.nombre;
$$;
revoke all on function public.equipo_sin_ficha() from public, anon;
grant execute on function public.equipo_sin_ficha() to authenticated;
