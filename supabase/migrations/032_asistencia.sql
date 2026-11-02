-- 032 · Pasar lista: asistencia de cada alumna en cada día de clase
-- Una fila por alumna, clase y día: presente = true (vino) o false (faltó). Sin fila = sin marcar.
-- La profesora la marca en sus clases; la administración (y quien vea todas las clases) ve y marca todas.
-- Solo añade una tabla nueva: no toca ningún dato que ya exista.

create table if not exists public.asistencias (
  id            uuid primary key default gen_random_uuid(),
  clase_id      uuid not null references public.clases(id) on delete cascade,
  alumna_id     uuid not null references public.alumnas(id) on delete cascade,
  fecha         date not null,
  presente      boolean not null,
  creado_por    uuid default auth.uid() references public.perfiles(id),
  modificado_en timestamptz not null default now(),
  unique (clase_id, alumna_id, fecha)
);
create index if not exists asistencias_clase_fecha on public.asistencias (clase_id, fecha);
create index if not exists asistencias_alumna on public.asistencias (alumna_id, fecha);

alter table public.asistencias enable row level security;

-- Quien ve Clases: todas, o solo las suyas si tiene "solo lo mío" (profesoras)
create policy asistencias_select on public.asistencias for select using (
  public.puede_ver('clases') and (not public.solo_propias('clases') or clase_id in (select public.mis_clases())));
create policy asistencias_insert on public.asistencias for insert with check (
  public.puede_ver('clases') and (not public.solo_propias('clases') or clase_id in (select public.mis_clases())));
create policy asistencias_update on public.asistencias for update using (
  public.puede_ver('clases') and (not public.solo_propias('clases') or clase_id in (select public.mis_clases())))
  with check (public.puede_ver('clases') and (not public.solo_propias('clases') or clase_id in (select public.mis_clases())));
create policy asistencias_delete on public.asistencias for delete using (
  public.puede_ver('clases') and (not public.solo_propias('clases') or clase_id in (select public.mis_clases())));

revoke all on public.asistencias from anon;
grant select, insert, update, delete on public.asistencias to authenticated;
