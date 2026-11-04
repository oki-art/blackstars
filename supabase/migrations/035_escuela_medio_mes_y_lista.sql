-- 035 · Escuela amiga por porcentaje: precio de MEDIO MES por alumna y lista de alumnas con nombre (opcional)
-- Ejemplo: mes completo 35 €, medio mes 20 €. En Contabilidad se ponen cuántas alumnas
-- pagaron el mes completo y cuántas medio mes, y sale el total y nuestra parte.
-- Solo se añaden columnas y una tabla nueva. No se toca ningún dato.

alter table public.escuelas_amigas
  add column if not exists precio_medio_alumna numeric(10,2) not null default 0;

do $$ begin
  alter table public.escuelas_amigas add constraint escuelas_amigas_precio_medio_chk check (precio_medio_alumna >= 0);
exception when duplicate_object then null; end $$;

-- Lista de alumnas con nombre (opcional, por escuela). Ej.: Estudio Ritmo sí, otras no.
-- Cada mes, en Contabilidad, a cada alumna se le marca Mes completo / Medio mes / No paga.
-- Solo lo ve y lo cambia quien tiene Contabilidad (Raúl, y Adela si se lo da). María no.
alter table public.escuelas_amigas add column if not exists con_lista boolean not null default false;

create table if not exists public.escuela_alumnas (
  id               uuid primary key default gen_random_uuid(),
  escuela_amiga_id uuid not null references public.escuelas_amigas(id) on delete cascade,
  clase_id         uuid references public.clases(id) on delete set null,
  nombre           text not null check (length(trim(nombre)) > 0),
  activa           boolean not null default true,
  creado_por       uuid default auth.uid() references public.perfiles(id),
  creado_en        timestamptz not null default now(),
  modificado_por   uuid references public.perfiles(id),
  modificado_en    timestamptz
);
create index if not exists escuela_alumnas_escuela on public.escuela_alumnas (escuela_amiga_id, activa);

drop trigger if exists auditar_escuela_alumnas on public.escuela_alumnas;
create trigger auditar_escuela_alumnas before insert or update on public.escuela_alumnas
  for each row execute function public.auditar();

alter table public.escuela_alumnas enable row level security;
drop policy if exists escuela_alumnas_select on public.escuela_alumnas;
drop policy if exists escuela_alumnas_insert on public.escuela_alumnas;
drop policy if exists escuela_alumnas_update on public.escuela_alumnas;
drop policy if exists escuela_alumnas_delete on public.escuela_alumnas;
create policy escuela_alumnas_select on public.escuela_alumnas for select using ((select public.ve_contabilidad()));
create policy escuela_alumnas_insert on public.escuela_alumnas for insert with check ((select public.escribe_contabilidad()));
create policy escuela_alumnas_update on public.escuela_alumnas for update
  using ((select public.escribe_contabilidad())) with check ((select public.escribe_contabilidad()));
create policy escuela_alumnas_delete on public.escuela_alumnas for delete using ((select public.escribe_contabilidad()));
revoke all on public.escuela_alumnas from anon;
grant select, insert, update, delete on public.escuela_alumnas to authenticated;

-- Lo que pagó cada alumna ese mes (nombre, clase, completo/medio/no, importe), guardado con el cobro del mes
alter table public.pagos_equipo add column if not exists detalle jsonb not null default '[]'::jsonb;
