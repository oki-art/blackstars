-- 008 · Logros: la profesora marca ella misma la semana en que cumplió un reto y se le suma al momento.
-- La administración recibe un aviso para comprobarlo y puede quitarlo. La profesora solo puede marcar
-- el mes en curso, hasta la semana actual, y deshacer lo que marcó ella.

alter table public.logros_cumplidos add column if not exists marcado_por uuid default auth.uid() references public.perfiles(id) on delete set null;

-- ¿Este reto es del mes en curso y la semana ya ha llegado?
create or replace function public.logro_marcable(p_reto uuid, p_semana int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.logros_retos r where r.id = p_reto
    and r.mes = date_trunc('month', current_date)::date
    and p_semana <= least(4, ceil(extract(day from current_date) / 7.0)::int));
$$;
revoke all on function public.logro_marcable(uuid, int) from public, anon;
grant execute on function public.logro_marcable(uuid, int) to authenticated;

alter policy logros_cumplidos_insert on public.logros_cumplidos with check (
  public.gestiona_logros() or (public.puede_escribir('logros') and profesora_id = public.mi_profesora()
    and marcado_por = auth.uid() and public.logro_marcable(reto_id, semana)));
alter policy logros_cumplidos_delete on public.logros_cumplidos using (
  public.gestiona_logros() or (profesora_id = public.mi_profesora() and marcado_por = auth.uid()
    and public.logro_marcable(reto_id, semana)));

-- Aviso a la administración cuando una profesora marca un logro ella misma
create or replace function public.aviso_logro() returns trigger language plpgsql security definer set search_path = public as $$
declare v_prof text; v_reto text;
begin
  if public.gestiona_logros() then return new; end if;
  select nombre into v_prof from public.profesoras where id = new.profesora_id;
  select titulo into v_reto from public.logros_retos where id = new.reto_id;
  insert into public.notificaciones (perfil_id, tipo, titulo, texto, enlace, creado_por)
  select p.id, 'aviso', coalesce(v_prof, 'Una profesora') || ' ha marcado un logro', v_reto || ' · semana ' || new.semana,
         '#/logros/profesora/' || new.profesora_id, auth.uid()
  from public.perfiles p
  where p.activo and p.id is distinct from auth.uid() and (p.rol = 'admin' or exists (select 1 from public.permisos pe
    where pe.perfil_id = p.id and pe.modulo = 'logros' and pe.puede_escribir and not pe.solo_propias));
  return new;
end; $$;
create trigger aviso_logro after insert on public.logros_cumplidos for each row execute function public.aviso_logro();
