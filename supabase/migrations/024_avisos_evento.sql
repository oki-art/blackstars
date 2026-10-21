-- 024 · Avisos de eventos solo para quien puede abrirlos
-- Antes, al crear un evento, el aviso "Evento nuevo" llegaba a todas las personas con el permiso Eventos,
-- también a las profesoras con "solo lo suyo", que luego no podían abrirlo (daba error).
-- Ahora:
--   · "Evento nuevo" solo llega a quien ve todos los eventos (administración y gestión).
--   · A una profesora le llega "Te han añadido al evento…" cuando la ponen como profesora o coordinadora.
--   · Se borran los avisos de eventos que ya tenían profesoras que no pueden abrirlos.
-- No se toca ningún evento ni ningún permiso.

-- ¿Ve esta persona todos los eventos (no solo los suyos)?
create or replace function public.perfil_ve_todos_eventos(p_perfil uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles p where p.id = p_perfil and p.activo and (p.rol = 'admin'
    or exists (select 1 from public.permisos pe where pe.perfil_id = p.id and pe.modulo = 'eventos' and pe.puede_ver and not pe.solo_propias)));
$$;

create or replace function public.aviso_evento() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notificaciones (perfil_id, tipo, titulo, texto, enlace, creado_por)
  select p.id, 'evento', 'Evento nuevo: ' || new.titulo, to_char(new.fecha, 'DD/MM/YYYY'), '#/evento/' || new.id, auth.uid()
  from public.perfiles p
  where p.activo and p.id is distinct from auth.uid() and public.perfil_ve_todos_eventos(p.id);
  return new;
end; $$;

-- Cuando ponen a una profesora en un evento (como profesora o coordinadora), le llega el aviso a ella
create or replace function public.aviso_evento_profesora() returns trigger language plpgsql security definer set search_path = public as $$
declare v_perfil uuid; v_evento record;
begin
  if new.profesora_id is null then return new; end if;
  select perfil_id into v_perfil from public.profesoras where id = new.profesora_id;
  if v_perfil is null or v_perfil = auth.uid() or public.perfil_ve_todos_eventos(v_perfil) then return new; end if;
  -- Si ya está en el evento por otro lado (profesora y coordinadora a la vez), no se repite el aviso
  if exists (select 1 from public.notificaciones where perfil_id = v_perfil and enlace = '#/evento/' || new.evento_id) then return new; end if;
  select titulo, fecha into v_evento from public.eventos where id = new.evento_id;
  insert into public.notificaciones (perfil_id, tipo, titulo, texto, enlace, creado_por)
  values (v_perfil, 'evento', 'Te han añadido al evento: ' || v_evento.titulo, to_char(v_evento.fecha, 'DD/MM/YYYY'), '#/evento/' || new.evento_id, auth.uid());
  return new;
end; $$;
drop trigger if exists aviso_evento_profesora on public.evento_profesoras;
create trigger aviso_evento_profesora after insert on public.evento_profesoras for each row execute function public.aviso_evento_profesora();
drop trigger if exists aviso_evento_coordinadora on public.evento_coordinadoras;
create trigger aviso_evento_coordinadora after insert on public.evento_coordinadoras for each row execute function public.aviso_evento_profesora();

revoke all on function public.perfil_ve_todos_eventos(uuid) from public, anon, authenticated;
revoke all on function public.aviso_evento_profesora() from public, anon, authenticated;

-- Limpieza: avisos de eventos que una profesora no puede abrir (no es profesora ni coordinadora de ese evento)
delete from public.notificaciones n
where n.tipo = 'evento' and n.enlace like '#/evento/%'
  and not public.perfil_ve_todos_eventos(n.perfil_id)
  and substring(n.enlace from 10) not in (
    select ep.evento_id::text from public.evento_profesoras ep join public.profesoras pr on pr.id = ep.profesora_id where pr.perfil_id = n.perfil_id
    union
    select e.id::text from public.eventos e join public.profesoras pr on pr.id = e.coordinadora_id where pr.perfil_id = n.perfil_id
    union
    select ec.evento_id::text from public.evento_coordinadoras ec join public.profesoras pr on pr.id = ec.profesora_id where pr.perfil_id = n.perfil_id);
