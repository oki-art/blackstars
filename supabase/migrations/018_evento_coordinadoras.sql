-- 018 · Coordinación de eventos: una coordinadora principal y las que se quieran añadir.
-- Puede ser una profesora (de su ficha) o cualquier otra persona del equipo escrita por su nombre
-- (Adela, María…), aunque todavía no tenga usuario en la app.
-- Solo se añade: la columna antigua eventos.coordinadora_id se queda y su valor se copia aquí como principal.

create table public.evento_coordinadoras (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references public.eventos(id) on delete cascade,
  profesora_id  uuid references public.profesoras(id) on delete cascade,
  nombre        text,                     -- si no es profesora (Adela, María…)
  principal     boolean not null default false,
  creado_por    uuid default auth.uid() references public.perfiles(id),
  creado_en     timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id),
  modificado_en  timestamptz,
  check (profesora_id is not null or nullif(trim(nombre), '') is not null)
);
create index evento_coordinadoras_evento_idx on public.evento_coordinadoras (evento_id);
-- Una sola principal por evento y sin repetir a la misma persona
create unique index evento_coordinadoras_una_principal on public.evento_coordinadoras (evento_id) where principal;
create unique index evento_coordinadoras_profesora on public.evento_coordinadoras (evento_id, profesora_id) where profesora_id is not null;
create unique index evento_coordinadoras_nombre on public.evento_coordinadoras (evento_id, lower(trim(nombre))) where profesora_id is null;

create trigger auditar_evento_coordinadoras before insert or update on public.evento_coordinadoras
  for each row execute function public.auditar();

-- La coordinadora que ya tenían los eventos pasa a ser su principal
insert into public.evento_coordinadoras (evento_id, profesora_id, principal)
  select id, coordinadora_id, true from public.eventos where coordinadora_id is not null;

-- Una profesora ve los eventos que coordina (principal o no), como antes
create or replace function public.mis_eventos()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select ep.evento_id from public.evento_profesoras ep
  join public.profesoras pr on pr.id = ep.profesora_id
  where pr.perfil_id = auth.uid()
  union
  select e.id from public.eventos e
  join public.profesoras pr on pr.id = e.coordinadora_id
  where pr.perfil_id = auth.uid()
  union
  select ec.evento_id from public.evento_coordinadoras ec
  join public.profesoras pr on pr.id = ec.profesora_id
  where pr.perfil_id = auth.uid();
$$;
revoke all on function public.mis_eventos() from public, anon;
grant execute on function public.mis_eventos() to authenticated;

alter table public.evento_coordinadoras enable row level security;
create policy evento_coordinadoras_select on public.evento_coordinadoras for select using (
  public.puede_ver('eventos')
  and (not public.solo_propias('eventos') or evento_id in (select public.mis_eventos())));
create policy evento_coordinadoras_insert on public.evento_coordinadoras for insert with check (public.puede_escribir('eventos'));
create policy evento_coordinadoras_update on public.evento_coordinadoras for update
  using (public.puede_escribir('eventos')) with check (public.puede_escribir('eventos'));
create policy evento_coordinadoras_delete on public.evento_coordinadoras for delete using (public.puede_escribir('eventos'));
grant select, insert, update, delete on public.evento_coordinadoras to authenticated;
revoke all on public.evento_coordinadoras from anon;
