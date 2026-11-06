-- 036 · Escuela amiga: código de descuento de bienvenida e interesadas
-- Ej.: código OLIVIA5 para la clase "Ritmos latinos" con Olivia: 5 € de descuento en la cuota del mes,
-- solo para las 5 primeras inscripciones. Cada interesada se invita por WhatsApp y, cuando se inscribe,
-- se marca como inscrita y gasta una plaza. Solo se añaden tablas nuevas. No se toca ningún dato.

-- Un código por escuela amiga
create table if not exists public.escuela_codigos (
  id               uuid primary key default gen_random_uuid(),
  escuela_amiga_id uuid not null unique references public.escuelas_amigas(id) on delete cascade,
  codigo           text not null check (length(trim(codigo)) between 2 and 20),
  clase            text,
  profesora        text,
  euros            numeric(10,2) not null default 5 check (euros >= 0),
  plazas           integer not null default 5 check (plazas between 1 and 100),
  activo           boolean not null default true,
  creado_por       uuid default auth.uid() references public.perfiles(id),
  creado_en        timestamptz not null default now(),
  modificado_por   uuid references public.perfiles(id),
  modificado_en    timestamptz
);

-- Las interesadas a las que se manda la invitación
create table if not exists public.escuela_interesadas (
  id               uuid primary key default gen_random_uuid(),
  escuela_amiga_id uuid not null references public.escuelas_amigas(id) on delete cascade,
  nombre           text not null check (length(trim(nombre)) > 0),
  telefono         text,
  nota             text,
  invitada_en      timestamptz,
  inscrita_en      timestamptz,
  creado_por       uuid default auth.uid() references public.perfiles(id),
  creado_en        timestamptz not null default now(),
  modificado_por   uuid references public.perfiles(id),
  modificado_en    timestamptz
);
create index if not exists escuela_interesadas_escuela on public.escuela_interesadas (escuela_amiga_id, creado_en);

drop trigger if exists auditar_escuela_codigos on public.escuela_codigos;
create trigger auditar_escuela_codigos before insert or update on public.escuela_codigos
  for each row execute function public.auditar();
drop trigger if exists auditar_escuela_interesadas on public.escuela_interesadas;
create trigger auditar_escuela_interesadas before insert or update on public.escuela_interesadas
  for each row execute function public.auditar();

-- No se puede pasar de las plazas del código (ej. la 6.ª inscrita ya no tiene descuento)
create or replace function public.escuela_interesadas_plazas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_plazas int; v_usadas int;
begin
  if new.inscrita_en is not null and (tg_op = 'INSERT' or old.inscrita_en is null) then
    select plazas into v_plazas from public.escuela_codigos where escuela_amiga_id = new.escuela_amiga_id;
    select count(*) into v_usadas from public.escuela_interesadas
      where escuela_amiga_id = new.escuela_amiga_id and inscrita_en is not null and id <> new.id;
    if v_plazas is not null and v_usadas >= v_plazas then
      raise exception 'Ya no quedan plazas con descuento (las % están cogidas)', v_plazas;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists escuela_interesadas_plazas on public.escuela_interesadas;
create trigger escuela_interesadas_plazas before insert or update on public.escuela_interesadas
  for each row execute function public.escuela_interesadas_plazas();

-- Permisos: lo mismo que Escuelas amigas (ver / editar)
alter table public.escuela_codigos enable row level security;
alter table public.escuela_interesadas enable row level security;
do $$
declare t text;
begin
  foreach t in array array['escuela_codigos', 'escuela_interesadas'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select using ((select public.puede_ver(''escuelas_amigas'')))', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check ((select public.puede_escribir(''escuelas_amigas'')))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using ((select public.puede_escribir(''escuelas_amigas''))) with check ((select public.puede_escribir(''escuelas_amigas'')))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using ((select public.puede_escribir(''escuelas_amigas'')))', t || '_delete', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
revoke all on function public.escuela_interesadas_plazas() from public, anon;
