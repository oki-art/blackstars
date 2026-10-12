-- 005 · Iniciativas: propuestas de las profesoras (una clase nueva, un cambio, un evento, cualquier idea).
-- La profesora escribe su propuesta y ve en qué estado está; la administración la estudia y responde.
-- Solo añade: una tabla nueva y el módulo "iniciativas" en Permisos. No toca datos existentes.

create table public.iniciativas (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null default 'otra' check (tipo in ('clase','cambio','evento','otra')),
  titulo      text not null check (length(titulo) between 1 and 200),
  descripcion text check (length(descripcion) <= 4000),
  estado      text not null default 'nueva' check (estado in ('nueva','estudio','aprobada','descartada')),
  respuesta   text check (length(respuesta) <= 4000),
  creado_por  uuid default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id),
  modificado_en  timestamptz
);
create index on public.iniciativas (creado_en desc);
create trigger auditar_iniciativas before insert or update on public.iniciativas
  for each row execute function public.auditar();

create or replace view public.iniciativas_con_autor with (security_invoker = true) as
  select i.*, p.nombre as registrado_por
  from public.iniciativas i left join public.perfiles p on p.id = i.creado_por;

-- Gestionar = editar Iniciativas sin "solo lo suyo" (administración)
create or replace function public.gestiona_iniciativas()
returns boolean language sql stable security definer set search_path = public as $$
  select public.puede_escribir('iniciativas') and not public.solo_propias('iniciativas');
$$;

alter table public.iniciativas enable row level security;
-- Ver: con "solo lo suyo", solo las propias
create policy iniciativas_select on public.iniciativas for select using (
  public.puede_ver('iniciativas') and (not public.solo_propias('iniciativas') or creado_por = auth.uid()));
-- Proponer: cualquiera con permiso de editar; las profesoras solo pueden crearlas como "nueva" y sin respuesta
create policy iniciativas_insert on public.iniciativas for insert with check (
  public.puede_escribir('iniciativas') and (public.gestiona_iniciativas() or (estado = 'nueva' and respuesta is null)));
-- Cambiar estado y responder: la administración
create policy iniciativas_update on public.iniciativas for update
  using (public.gestiona_iniciativas()) with check (public.gestiona_iniciativas());
create policy iniciativas_delete on public.iniciativas for delete using (public.es_admin());

revoke all on public.iniciativas, public.iniciativas_con_autor from anon;
revoke all on function public.gestiona_iniciativas() from public, anon;
grant execute on function public.gestiona_iniciativas() to authenticated;

-- Nuevo módulo "iniciativas" en Permisos (misma lista + iniciativas)
alter table public.permisos drop constraint permisos_modulo_check;
alter table public.permisos add constraint permisos_modulo_check check (modulo in (
  'alumnas','profesoras','clases','inscripciones','incidencias','normas','caja',
  'eventos','formularios','escuelas_amigas','logros','iniciativas'));
