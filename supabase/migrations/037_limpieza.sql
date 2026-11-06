-- 037 · Limpieza: lista diaria con checks e inventario de productos de limpieza
-- Lo ve y lo edita la administración y quien tenga el permiso nuevo "Limpieza" (María; Adela si se lo da Raúl).
-- No va en ninguna plantilla: las profesoras no lo tienen.
-- Solo se añade: un permiso y dos tablas nuevas. No se toca ningún dato.

alter table public.permisos drop constraint if exists permisos_modulo_check;
alter table public.permisos add constraint permisos_modulo_check check (modulo in (
  'alumnas','profesoras','clases','inscripciones','incidencias','normas','caja',
  'eventos','formularios','escuelas_amigas','logros','iniciativas','documentos','pilates','contabilidad','limpieza'));

-- Cada tarea marcada un día. Sin fila = sin hacer. La tarea es una clave fija de la app (p. ej. "banos-3").
create table if not exists public.limpieza_checks (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  tarea      text not null check (length(tarea) between 1 and 40),
  hecho_por  uuid references public.perfiles(id) on delete set null,
  hecho_nombre text,
  hecho_en   timestamptz not null default now(),
  unique (fecha, tarea)
);
create index if not exists limpieza_checks_fecha on public.limpieza_checks (fecha);

-- Productos de limpieza y cómo están: hay / poco (queda poco) / agotado
create table if not exists public.limpieza_productos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (length(trim(nombre)) between 1 and 80),
  estado     text not null default 'hay' check (estado in ('hay','poco','agotado')),
  creado_en  timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id) on delete set null,
  modificado_nombre text,
  modificado_en timestamptz not null default now()
);

-- Quién y cuándo lo pone el servidor (no se puede falsificar desde el móvil)
create or replace function public.limpieza_autor() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  select nombre into n from public.perfiles where id = auth.uid();
  if tg_table_name = 'limpieza_checks' then
    new.hecho_por := auth.uid(); new.hecho_nombre := n; new.hecho_en := now();
  else
    new.modificado_por := auth.uid(); new.modificado_nombre := n; new.modificado_en := now();
    if tg_op = 'INSERT' then new.creado_en := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists limpieza_checks_autor on public.limpieza_checks;
create trigger limpieza_checks_autor before insert or update on public.limpieza_checks
  for each row execute function public.limpieza_autor();
drop trigger if exists limpieza_productos_autor on public.limpieza_productos;
create trigger limpieza_productos_autor before insert or update on public.limpieza_productos
  for each row execute function public.limpieza_autor();

alter table public.limpieza_checks enable row level security;
alter table public.limpieza_productos enable row level security;

drop policy if exists limpieza_checks_select on public.limpieza_checks;
create policy limpieza_checks_select on public.limpieza_checks for select using ((select public.puede_ver('limpieza')));
drop policy if exists limpieza_checks_insert on public.limpieza_checks;
create policy limpieza_checks_insert on public.limpieza_checks for insert with check ((select public.puede_escribir('limpieza')));
drop policy if exists limpieza_checks_update on public.limpieza_checks;
create policy limpieza_checks_update on public.limpieza_checks for update using ((select public.puede_escribir('limpieza'))) with check ((select public.puede_escribir('limpieza')));
drop policy if exists limpieza_checks_delete on public.limpieza_checks;
create policy limpieza_checks_delete on public.limpieza_checks for delete using ((select public.puede_escribir('limpieza')));

drop policy if exists limpieza_productos_select on public.limpieza_productos;
create policy limpieza_productos_select on public.limpieza_productos for select using ((select public.puede_ver('limpieza')));
drop policy if exists limpieza_productos_insert on public.limpieza_productos;
create policy limpieza_productos_insert on public.limpieza_productos for insert with check ((select public.puede_escribir('limpieza')));
drop policy if exists limpieza_productos_update on public.limpieza_productos;
create policy limpieza_productos_update on public.limpieza_productos for update using ((select public.puede_escribir('limpieza'))) with check ((select public.puede_escribir('limpieza')));
drop policy if exists limpieza_productos_delete on public.limpieza_productos;
create policy limpieza_productos_delete on public.limpieza_productos for delete using ((select public.puede_escribir('limpieza')));

revoke all on public.limpieza_checks, public.limpieza_productos from anon;
grant select, insert, update, delete on public.limpieza_checks, public.limpieza_productos to authenticated;
