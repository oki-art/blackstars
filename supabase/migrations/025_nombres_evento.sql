-- 025 · Nombres de quien coordina y da clase en un evento
-- Una profesora no puede leer las fichas de otras profesoras (ni siempre la suya), así que en su evento
-- salía "—" en Coordina y en Profesoras. Esta función solo devuelve el NOMBRE de las profesoras de un
-- evento, y solo si quien pregunta puede abrir ese evento. No se toca ninguna tabla ni ningún permiso.

create or replace function public.nombres_evento(p_evento uuid)
returns table (profesora_id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.nombre from public.profesoras pr
  where pr.id in (
      select ep.profesora_id from public.evento_profesoras ep where ep.evento_id = p_evento
      union select ec.profesora_id from public.evento_coordinadoras ec where ec.evento_id = p_evento
      union select e.coordinadora_id from public.eventos e where e.id = p_evento)
    and public.puede_ver('eventos')
    and (not public.solo_propias('eventos') or p_evento in (select public.mis_eventos()));
$$;
revoke all on function public.nombres_evento(uuid) from public, anon;
grant execute on function public.nombres_evento(uuid) to authenticated;
