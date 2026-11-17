-- 042 · Agenda de temas importantes: lista por prioridad con título, tipo, etiquetas, descripción y fecha opcional.
-- Se ve con el permiso nuevo "Agenda" (la administración siempre). Se le da a Adela (ver y editar).
-- Solo añade una tabla y el módulo "agenda" en Permisos. No toca datos existentes.

create table if not exists public.agenda_temas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (length(titulo) between 1 and 200),
  tipo        text not null default 'otro' check (tipo in ('sustitucion','horario','conflicto','otro')),
  etiquetas   text[] not null default '{}',
  descripcion text check (length(descripcion) <= 4000),
  fecha       date,
  -- Prioridad: el número más pequeño va arriba. Los nuevos entran al final.
  orden       double precision not null default extract(epoch from now()),
  hecho       boolean not null default false,
  hecho_por   uuid references public.perfiles(id) on delete set null,
  hecho_nombre text,
  hecho_en    timestamptz,
  creado_nombre text,
  creado_por  uuid default auth.uid() references public.perfiles(id) on delete set null,
  creado_en   timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id) on delete set null,
  modificado_en  timestamptz
);
create index if not exists agenda_temas_orden on public.agenda_temas (hecho, orden);

drop trigger if exists auditar_agenda_temas on public.agenda_temas;
create trigger auditar_agenda_temas before insert or update on public.agenda_temas
  for each row execute function public.auditar();

-- Quién lo apuntó y quién lo dio por hecho (lo pone el servidor, con su nombre para que todas lo vean)
create or replace function public.agenda_quien()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nombre text;
begin
  select nombre into v_nombre from public.perfiles where id = auth.uid();
  if tg_op = 'INSERT' then
    new.creado_nombre := v_nombre;
    if new.hecho then new.hecho_por := auth.uid(); new.hecho_nombre := v_nombre; new.hecho_en := now(); end if;
  else
    new.creado_nombre := old.creado_nombre;
    if new.hecho and not old.hecho then
      new.hecho_por := auth.uid(); new.hecho_nombre := v_nombre; new.hecho_en := now();
    elsif not new.hecho then
      new.hecho_por := null; new.hecho_nombre := null; new.hecho_en := null;
    else
      new.hecho_por := old.hecho_por; new.hecho_nombre := old.hecho_nombre; new.hecho_en := old.hecho_en;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists agenda_quien on public.agenda_temas;
create trigger agenda_quien before insert or update on public.agenda_temas
  for each row execute function public.agenda_quien();

alter table public.agenda_temas enable row level security;
drop policy if exists agenda_select on public.agenda_temas;
create policy agenda_select on public.agenda_temas for select using ((select public.puede_ver('agenda')));
drop policy if exists agenda_insert on public.agenda_temas;
create policy agenda_insert on public.agenda_temas for insert with check ((select public.puede_escribir('agenda')));
drop policy if exists agenda_update on public.agenda_temas;
create policy agenda_update on public.agenda_temas for update
  using ((select public.puede_escribir('agenda'))) with check ((select public.puede_escribir('agenda')));
drop policy if exists agenda_delete on public.agenda_temas;
create policy agenda_delete on public.agenda_temas for delete using ((select public.puede_escribir('agenda')));

revoke all on public.agenda_temas from anon;
grant select, insert, update, delete on public.agenda_temas to authenticated;
revoke all on function public.agenda_quien() from public, anon;

-- Nuevo módulo "agenda" en Permisos (misma lista que la 039 + agenda)
alter table public.permisos drop constraint if exists permisos_modulo_check;
alter table public.permisos add constraint permisos_modulo_check check (modulo in (
  'alumnas','profesoras','clases','inscripciones','incidencias','normas','caja',
  'eventos','formularios','escuelas_amigas','logros','iniciativas','documentos','pilates','contabilidad','limpieza','limpieza_informe','agenda'));

-- Adela: ver y editar la Agenda (la administración ya la ve siempre)
insert into public.permisos (perfil_id, modulo, puede_ver, puede_escribir, solo_propias)
select p.id, 'agenda', true, true, false
from public.perfiles p join auth.users u on u.id = p.id
where lower(u.email) = 'adela.sof@gmail.com'
on conflict (perfil_id, modulo) do update set puede_ver = true, puede_escribir = true, solo_propias = false;

notify pgrst, 'reload schema';
