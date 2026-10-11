-- 004 · Logros: retos mensuales para profesoras y estrellas semanales para alumnas.
-- Retos: los crea la administración (máximo 5 al mes, todos valen lo mismo).
-- Cada mes tiene 4 semanas (1–7, 8–14, 15–21, 22–fin). Progreso = casillas cumplidas / (retos × 4).
-- Estrellas: la profesora da de 0 a 3 en Esfuerzo, Tareas y Actitud cada semana.

-- La profesora enlazada con quien ha entrado
create or replace function public.mi_profesora()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profesoras where perfil_id = auth.uid();
$$;

-- Gestionar retos = editar Logros sin "solo lo suyo" (administración)
create or replace function public.gestiona_logros()
returns boolean language sql stable security definer set search_path = public as $$
  select public.puede_escribir('logros') and not public.solo_propias('logros');
$$;

create table public.logros_plantillas (
  id        uuid primary key default gen_random_uuid(),
  titulo    text not null unique,
  activa    boolean not null default true,
  creado_en timestamptz not null default now()
);
insert into public.logros_plantillas (titulo) values
  ('Sube un vídeo a TikTok o a redes una vez por semana'),
  ('Ponte la camiseta Blackstars en clase');

create table public.logros_meses (
  mes        date primary key check (extract(day from mes) = 1),
  recompensa text
);

create table public.logros_retos (
  id        uuid primary key default gen_random_uuid(),
  mes       date not null check (extract(day from mes) = 1),
  titulo    text not null,
  creado_en timestamptz not null default now()
);
create index on public.logros_retos (mes);

create or replace function public.logros_max_retos()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.logros_retos where mes = new.mes and id <> new.id) >= 5 then
    raise exception 'Máximo 5 retos al mes';
  end if;
  return new;
end; $$;
create trigger logros_max_retos before insert or update of mes on public.logros_retos
  for each row execute function public.logros_max_retos();
revoke all on function public.logros_max_retos() from public, anon, authenticated;

create table public.logros_cumplidos (
  reto_id      uuid not null references public.logros_retos(id) on delete cascade,
  profesora_id uuid not null references public.profesoras(id) on delete cascade,
  semana       smallint not null check (semana between 1 and 4),
  creado_en    timestamptz not null default now(),
  primary key (reto_id, profesora_id, semana)
);

create table public.logros_estrellas (
  id            uuid primary key default gen_random_uuid(),
  alumna_id     uuid not null references public.alumnas(id) on delete cascade,
  clase_id      uuid not null references public.clases(id) on delete cascade,
  mes           date not null check (extract(day from mes) = 1),
  semana        smallint not null check (semana between 1 and 4),
  esfuerzo      smallint not null default 0 check (esfuerzo between 0 and 3),
  tareas        smallint not null default 0 check (tareas between 0 and 3),
  actitud       smallint not null default 0 check (actitud between 0 and 3),
  creado_por    uuid default auth.uid() references public.perfiles(id),
  modificado_en timestamptz not null default now(),
  unique (alumna_id, clase_id, mes, semana)
);
create index on public.logros_estrellas (clase_id, mes);

-- Seguridad
alter table public.logros_plantillas enable row level security;
alter table public.logros_meses      enable row level security;
alter table public.logros_retos      enable row level security;
alter table public.logros_cumplidos  enable row level security;
alter table public.logros_estrellas  enable row level security;

create policy logros_plantillas_select on public.logros_plantillas for select using (public.puede_ver('logros'));
create policy logros_plantillas_insert on public.logros_plantillas for insert with check (public.gestiona_logros());
create policy logros_plantillas_update on public.logros_plantillas for update using (public.gestiona_logros()) with check (public.gestiona_logros());
create policy logros_plantillas_delete on public.logros_plantillas for delete using (public.gestiona_logros());

create policy logros_meses_select on public.logros_meses for select using (public.puede_ver('logros'));
create policy logros_meses_insert on public.logros_meses for insert with check (public.gestiona_logros());
create policy logros_meses_update on public.logros_meses for update using (public.gestiona_logros()) with check (public.gestiona_logros());

create policy logros_retos_select on public.logros_retos for select using (public.puede_ver('logros'));
create policy logros_retos_insert on public.logros_retos for insert with check (public.gestiona_logros());
create policy logros_retos_update on public.logros_retos for update using (public.gestiona_logros()) with check (public.gestiona_logros());
create policy logros_retos_delete on public.logros_retos for delete using (public.gestiona_logros());

create policy logros_cumplidos_select on public.logros_cumplidos for select using (
  public.puede_ver('logros') and (not public.solo_propias('logros') or profesora_id = public.mi_profesora()));
create policy logros_cumplidos_insert on public.logros_cumplidos for insert with check (public.gestiona_logros());
create policy logros_cumplidos_delete on public.logros_cumplidos for delete using (public.gestiona_logros());

create policy logros_estrellas_select on public.logros_estrellas for select using (
  public.puede_ver('logros') and (not public.solo_propias('logros') or clase_id in (select public.mis_clases())));
create policy logros_estrellas_insert on public.logros_estrellas for insert with check (
  public.puede_escribir('logros') and (not public.solo_propias('logros') or clase_id in (select public.mis_clases())));
create policy logros_estrellas_update on public.logros_estrellas for update using (
  public.puede_escribir('logros') and (not public.solo_propias('logros') or clase_id in (select public.mis_clases())))
  with check (public.puede_escribir('logros') and (not public.solo_propias('logros') or clase_id in (select public.mis_clases())));
create policy logros_estrellas_delete on public.logros_estrellas for delete using (public.gestiona_logros());

revoke all on public.logros_plantillas, public.logros_meses, public.logros_retos,
              public.logros_cumplidos, public.logros_estrellas from anon;
revoke all on function public.mi_profesora() from public, anon;
revoke all on function public.gestiona_logros() from public, anon;
grant execute on function public.mi_profesora() to authenticated;
grant execute on function public.gestiona_logros() to authenticated;

-- Nuevo módulo "logros" en Permisos (misma lista + logros)
alter table public.permisos drop constraint permisos_modulo_check;
alter table public.permisos add constraint permisos_modulo_check check (modulo in (
  'alumnas','profesoras','clases','inscripciones','incidencias','normas','caja',
  'eventos','formularios','escuelas_amigas','logros'));
