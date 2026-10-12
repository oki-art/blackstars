-- 010 · Notas de la profesora en la ficha de cada alumna (avances, esfuerzo, incidencias, familia...).
-- Las ve y las escribe quien puede ver a esa alumna (la profesora, solo sus alumnas).
-- Cada una borra o corrige solo las suyas; la administración, todas.
-- El nombre de quien escribe lo pone el servidor (no se puede falsear).

create table public.alumnas_notas (
  id             uuid primary key default gen_random_uuid(),
  alumna_id      uuid not null references public.alumnas(id) on delete cascade,
  tipo           text not null default 'otra' check (tipo in ('avance','esfuerzo','incidencia','familia','otra')),
  texto          text not null check (length(btrim(texto)) between 1 and 2000),
  autor_nombre   text,
  creado_por     uuid default auth.uid() references public.perfiles(id),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id),
  modificado_en  timestamptz
);
create index on public.alumnas_notas (alumna_id, creado_en desc);

create trigger auditar_alumnas_notas before insert or update on public.alumnas_notas
  for each row execute function public.auditar();

create or replace function public.alumnas_notas_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.autor_nombre := (select nombre from public.perfiles where id = auth.uid());
  else
    new.autor_nombre := old.autor_nombre;
    new.alumna_id := old.alumna_id;
  end if;
  return new;
end; $$;
create trigger alumnas_notas_autor before insert or update on public.alumnas_notas
  for each row execute function public.alumnas_notas_autor();
revoke all on function public.alumnas_notas_autor() from public, anon, authenticated;

-- ¿Puede ver a esta alumna? (mismo criterio que la ficha)
create or replace function public.ve_alumna(p_alumna uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.puede_ver('alumnas')
     and (not public.solo_propias('alumnas') or p_alumna in (select public.mis_alumnas()));
$$;
revoke all on function public.ve_alumna(uuid) from public, anon;
grant execute on function public.ve_alumna(uuid) to authenticated;

alter table public.alumnas_notas enable row level security;
create policy alumnas_notas_select on public.alumnas_notas for select using (public.ve_alumna(alumna_id));
create policy alumnas_notas_insert on public.alumnas_notas for insert with check (public.ve_alumna(alumna_id));
create policy alumnas_notas_update on public.alumnas_notas for update
  using (public.ve_alumna(alumna_id) and (creado_por = auth.uid() or public.es_admin()))
  with check (public.ve_alumna(alumna_id) and (creado_por = auth.uid() or public.es_admin()));
create policy alumnas_notas_delete on public.alumnas_notas for delete
  using (creado_por = auth.uid() or public.es_admin());

revoke all on public.alumnas_notas from anon;
