-- 021 · Que la app vaya más rápida
-- Las reglas de quién ve qué preguntaban los permisos una vez POR CADA FILA (cada cobro, cada alumna…).
-- Ahora se preguntan una sola vez por consulta. Las reglas son las mismas: solo cambia la velocidad.
-- No se toca ningún dato.

-- Clases privadas (Pilates): las listas se calculan una vez y se comparan
create or replace function public.privadas_visibles() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.clases where privada and public.ve_privada(id);
$$;
create or replace function public.privadas_ocultas() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.clases where privada and not public.ve_privada(id);
$$;
create or replace function public.privadas_caja_visibles() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.clases where privada and public.ve_caja_privada(id);
$$;
create or replace function public.privadas_caja_ocultas() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.clases where privada and not public.ve_caja_privada(id);
$$;
-- Alumnas que solo están en clases privadas que esta persona no ve
create or replace function public.alumnas_ocultas() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct i.alumna_id), '{}') from public.inscripciones i
  where i.clase_id = any (public.privadas_ocultas())
    and not exists (select 1 from public.inscripciones j where j.alumna_id = i.alumna_id and not (j.clase_id = any (public.privadas_ocultas())));
$$;
revoke all on function public.privadas_visibles(), public.privadas_ocultas(), public.privadas_caja_visibles(),
  public.privadas_caja_ocultas(), public.alumnas_ocultas() from public, anon;
grant execute on function public.privadas_visibles(), public.privadas_ocultas(), public.privadas_caja_visibles(),
  public.privadas_caja_ocultas(), public.alumnas_ocultas() to authenticated;

-- Las cuatro reglas de las clases privadas, reescritas
alter policy clases_select on public.clases using (
  (select public.puede_ver('clases'))
  and (not (select public.solo_propias('clases')) or id in (select public.mis_clases()))
  and (not privada or id = any ((select public.privadas_visibles())::uuid[])));

alter policy alumnas_select on public.alumnas using (
  (select public.puede_ver('alumnas'))
  and (not (select public.solo_propias('alumnas')) or id in (select public.mis_alumnas()))
  and not (id = any ((select public.alumnas_ocultas())::uuid[])));

alter policy inscripciones_select on public.inscripciones using (
  (select public.puede_ver('inscripciones'))
  and (not (select public.solo_propias('inscripciones')) or clase_id in (select public.mis_clases()))
  and not (clase_id = any ((select public.privadas_ocultas())::uuid[])));

alter policy caja_select on public.caja using (
  ((select public.puede_ver('caja')) and not coalesce(clase_id = any ((select public.privadas_caja_ocultas())::uuid[]), false))
  or coalesce(clase_id = any ((select public.privadas_caja_visibles())::uuid[]), false));

-- El resto de reglas: misma condición, pero cada permiso se pregunta una vez
do $$
declare r record; q text; c text;
  patron text := '((public\.)?(puede_ver|puede_escribir|solo_propias)\(''[a-z_]+''::text\)|(public\.)?(es_admin|gestiona_documentos|gestiona_ventas|mi_profesora)\(\)|auth\.uid\(\))';
begin
  for r in select * from pg_policies where schemaname = 'public'
    and (tablename, policyname) not in (('clases','clases_select'),('alumnas','alumnas_select'),('inscripciones','inscripciones_select'),('caja','caja_select'))
  loop
    q := case when r.qual is null or r.qual ~* '\(\s*select\s+(public\.)?(puede_ver|puede_escribir|solo_propias|es_admin)' then null
              else regexp_replace(r.qual, patron, '(select \1)', 'g') end;
    c := case when r.with_check is null or r.with_check ~* '\(\s*select\s+(public\.)?(puede_ver|puede_escribir|solo_propias|es_admin)' then null
              else regexp_replace(r.with_check, patron, '(select \1)', 'g') end;
    if q is not null and q <> r.qual then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, q);
    end if;
    if c is not null and c <> r.with_check then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, c);
    end if;
  end loop;
end $$;

-- Índices para las búsquedas más usadas
create index if not exists caja_clase_idx on public.caja (clase_id);
create index if not exists caja_alumna_idx on public.caja (alumna_id);
create index if not exists permisos_perfil_idx on public.permisos (perfil_id);

notify pgrst, 'reload schema';
