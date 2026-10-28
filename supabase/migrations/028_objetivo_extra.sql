-- 028 · Objetivo extra en los eventos
-- En un evento (p. ej. Halloween) las profesoras apuntan a las niñas interesadas: nombre, madre/padre o tutor/a y teléfono.
-- Si esa niña se inscribe después en una clase de la escuela, la profesora gana el plus del evento (p. ej. 10 € por niña).
--   · La administración activa el objetivo en el evento y pone cuántos € por niña. Cada profesora tiene un código (CONCHY).
--   · El plus se valida solo al inscribir a la niña en una clase: por el teléfono, o por el código que dé la familia.
--   · La profesora solo ve sus interesadas; la administración y gestión ven todas.
--   · Pagar el plus apunta un gasto del evento en Caja (si se borra ese gasto, vuelve a quedar sin pagar).
-- Solo se añade: una columna en eventos y dos tablas nuevas. No se toca ningún dato.

alter table public.eventos add column if not exists objetivo_euros numeric(10,2) check (objetivo_euros is null or objetivo_euros > 0);

-- Código de cada profesora en un evento con objetivo extra
create table if not exists public.evento_codigos (
  evento_id     uuid not null references public.eventos(id) on delete cascade,
  profesora_id  uuid not null references public.profesoras(id) on delete cascade,
  codigo        text not null check (codigo ~ '^[A-Z0-9]{2,20}$'),
  primary key (evento_id, profesora_id)
);
create unique index if not exists evento_codigos_unico on public.evento_codigos (evento_id, codigo);

-- Niñas interesadas que apunta cada profesora en el evento
create table if not exists public.evento_interesadas (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references public.eventos(id) on delete cascade,
  profesora_id   uuid not null references public.profesoras(id) on delete cascade,
  nombre         text not null check (length(trim(nombre)) between 1 and 120),
  tutor_nombre   text check (length(tutor_nombre) <= 120),
  telefono       text not null check (length(regexp_replace(telefono, '\D', '', 'g')) between 9 and 15),
  nota           text check (length(nota) <= 300),
  alumna_id      uuid references public.alumnas(id) on delete set null,
  inscripcion_id uuid references public.inscripciones(id) on delete set null,
  validada_en    timestamptz,             -- se ha apuntado a una clase: cuenta para el plus
  caja_id        uuid references public.caja(id) on delete set null,   -- plus ya pagado (gasto en Caja)
  creado_por     uuid default auth.uid() references public.perfiles(id),
  creado_en      timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id),
  modificado_en  timestamptz
);
create index if not exists evento_interesadas_evento_idx on public.evento_interesadas (evento_id, profesora_id);
create index if not exists evento_interesadas_pendientes_idx on public.evento_interesadas (evento_id) where validada_en is null;

drop trigger if exists auditar_evento_interesadas on public.evento_interesadas;
create trigger auditar_evento_interesadas before insert or update on public.evento_interesadas
  for each row execute function public.auditar();

-- Gestiona el objetivo: administración o quien edita Eventos sin "solo lo suyo"
create or replace function public.gestiona_objetivo() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or (public.puede_escribir('eventos') and not public.solo_propias('eventos'));
$$;
-- Ve todas las interesadas: lo anterior o quien ve todos los eventos (gestión, recepción)
create or replace function public.ve_todo_objetivo() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or (public.puede_ver('eventos') and not public.solo_propias('eventos'));
$$;

-- Una profesora no puede darse por validada ni pagada, ni apuntar a nombre de otra
create or replace function public.proteger_interesada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Las funciones de abajo (validar al inscribir, código, pagar) pasan con su propia marca
  if public.gestiona_objetivo() or current_setting('bs.objetivo', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.profesora_id := public.mi_profesora();
    new.alumna_id := null; new.inscripcion_id := null; new.validada_en := null; new.caja_id := null;
  else
    new.evento_id := old.evento_id; new.profesora_id := old.profesora_id;
    new.alumna_id := old.alumna_id; new.inscripcion_id := old.inscripcion_id;
    new.validada_en := old.validada_en; new.caja_id := old.caja_id;
  end if;
  return new;
end; $$;
drop trigger if exists proteger_interesada on public.evento_interesadas;
create trigger proteger_interesada before insert or update on public.evento_interesadas
  for each row execute function public.proteger_interesada();

alter table public.evento_codigos enable row level security;
create policy evento_codigos_select on public.evento_codigos for select using (
  public.puede_ver('eventos') and (not public.solo_propias('eventos') or evento_id in (select public.mis_eventos())));
create policy evento_codigos_insert on public.evento_codigos for insert with check ((select public.gestiona_objetivo()));
create policy evento_codigos_update on public.evento_codigos for update
  using ((select public.gestiona_objetivo())) with check ((select public.gestiona_objetivo()));
create policy evento_codigos_delete on public.evento_codigos for delete using ((select public.gestiona_objetivo()));
grant select, insert, update, delete on public.evento_codigos to authenticated;
revoke all on public.evento_codigos from anon;

alter table public.evento_interesadas enable row level security;
create policy evento_interesadas_select on public.evento_interesadas for select using (
  (select public.ve_todo_objetivo()) or profesora_id = (select public.mi_profesora()));
-- La profesora apunta en los eventos en los que tiene código; corrige o borra las suyas mientras no estén validadas
create policy evento_interesadas_insert on public.evento_interesadas for insert with check (
  (select public.gestiona_objetivo())
  or exists (select 1 from public.evento_codigos c where c.evento_id = evento_interesadas.evento_id and c.profesora_id = (select public.mi_profesora())));
create policy evento_interesadas_update on public.evento_interesadas for update
  using ((select public.gestiona_objetivo()) or (profesora_id = (select public.mi_profesora()) and validada_en is null))
  with check ((select public.gestiona_objetivo()) or profesora_id = (select public.mi_profesora()));
create policy evento_interesadas_delete on public.evento_interesadas for delete using (
  (select public.gestiona_objetivo()) or (profesora_id = (select public.mi_profesora()) and validada_en is null));
grant select, insert, update, delete on public.evento_interesadas to authenticated;
revoke all on public.evento_interesadas from anon;

-- Últimos 9 números de un teléfono (así da igual si lleva +34, espacios o guiones)
create or replace function public.tel9(t text) returns text
language sql immutable set search_path = public as $$
  select nullif(right(regexp_replace(coalesce(t, ''), '\D', '', 'g'), 9), '');
$$;

-- Da por conseguida una interesada y le avisa a su profesora
create or replace function public.validar_interesada(p_id uuid, p_alumna uuid, p_inscripcion uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  perform set_config('bs.objetivo', '1', true);
  update public.evento_interesadas set alumna_id = p_alumna, inscripcion_id = p_inscripcion, validada_en = now()
  where id = p_id and validada_en is null
  returning evento_id, profesora_id, nombre into v;
  if v.profesora_id is null then return; end if;
  insert into public.notificaciones (perfil_id, tipo, titulo, texto, enlace, creado_por)
  select pr.perfil_id, 'evento', 'Objetivo extra: ' || v.nombre || ' se ha apuntado a clase',
         e.titulo || coalesce(' · +' || replace(rtrim(to_char(e.objetivo_euros, 'FM999990.99'), '.'), '.', ',') || ' €', ''),
         '#/evento/' || v.evento_id, auth.uid()
  from public.profesoras pr, public.eventos e
  where pr.id = v.profesora_id and e.id = v.evento_id and pr.perfil_id is not null and pr.perfil_id is distinct from auth.uid();
end; $$;
revoke all on function public.validar_interesada(uuid, uuid, uuid) from public, anon, authenticated;

-- Al inscribir a una alumna en una clase: si es su primera clase y su teléfono (o el del tutor/a) coincide
-- con una interesada pendiente de un evento con objetivo, cuenta para la profesora que la apuntó primero.
create or replace function public.objetivo_al_inscribir() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if new.fecha_baja is not null then return new; end if;
  if exists (select 1 from public.evento_interesadas where alumna_id = new.alumna_id and validada_en is not null) then return new; end if;
  if exists (select 1 from public.inscripciones where alumna_id = new.alumna_id and id <> new.id) then return new; end if;
  select i.id into v_id
  from public.evento_interesadas i
  join public.eventos e on e.id = i.evento_id and e.objetivo_euros is not null
  join public.alumnas a on a.id = new.alumna_id
  where i.validada_en is null
    and (i.alumna_id = new.alumna_id or public.tel9(i.telefono) in (public.tel9(a.telefono), public.tel9(a.tutor_telefono)))
  order by i.creado_en limit 1;
  if v_id is not null then perform public.validar_interesada(v_id, new.alumna_id, new.id); end if;
  return new;
end; $$;
drop trigger if exists objetivo_al_inscribir on public.inscripciones;
create trigger objetivo_al_inscribir after insert on public.inscripciones
  for each row execute function public.objetivo_al_inscribir();
revoke all on function public.objetivo_al_inscribir() from public, anon, authenticated;

-- ¿De quién es este código? (para el aviso verde al inscribir). Toma el evento más reciente con ese código.
create or replace function public.objetivo_codigo(p_codigo text)
returns table (evento_id uuid, evento text, profesora_id uuid, profesora text, euros numeric)
language sql stable security definer set search_path = public as $$
  select e.id, e.titulo, pr.id, pr.nombre, e.objetivo_euros
  from public.evento_codigos c
  join public.eventos e on e.id = c.evento_id and e.objetivo_euros is not null
  join public.profesoras pr on pr.id = c.profesora_id
  where c.codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'))
    and (public.es_admin() or public.puede_escribir('inscripciones') or public.ve_todo_objetivo())
  order by e.fecha desc limit 1;
$$;
revoke all on function public.objetivo_codigo(text) from public, anon;
grant execute on function public.objetivo_codigo(text) to authenticated;

-- La familia dice el código al apuntar a la niña en clase: cuenta para esa profesora
-- (si no la apuntó en el evento, se crea su ficha de interesada con los datos de la alumna).
create or replace function public.objetivo_aplicar_codigo(p_alumna uuid, p_codigo text)
returns text language plpgsql security definer set search_path = public as $$
declare v_cod record; v_alu record; v_ins uuid; v_id uuid;
begin
  if not (public.es_admin() or public.puede_escribir('inscripciones')) then raise exception 'Sin permiso'; end if;
  select * into v_cod from public.objetivo_codigo(p_codigo);
  if v_cod.evento_id is null then return 'codigo'; end if;
  if exists (select 1 from public.evento_interesadas where alumna_id = p_alumna and validada_en is not null) then return 'ya'; end if;
  select id into v_ins from public.inscripciones where alumna_id = p_alumna and fecha_baja is null order by creado_en desc limit 1;
  if v_ins is null then return 'sin_clase'; end if;
  select nombre, apellidos, telefono, tutor_nombre, tutor_telefono into v_alu from public.alumnas where id = p_alumna;
  select id into v_id from public.evento_interesadas
  where evento_id = v_cod.evento_id and profesora_id = v_cod.profesora_id and validada_en is null
    and (alumna_id = p_alumna or lower(trim(nombre)) in (lower(trim(v_alu.nombre)), lower(trim(v_alu.nombre || ' ' || coalesce(v_alu.apellidos, ''))))
         or public.tel9(telefono) in (public.tel9(v_alu.telefono), public.tel9(v_alu.tutor_telefono)))
  order by creado_en limit 1;
  if v_id is null then
    perform set_config('bs.objetivo', '1', true);
    insert into public.evento_interesadas (evento_id, profesora_id, nombre, tutor_nombre, telefono, nota)
    values (v_cod.evento_id, v_cod.profesora_id, trim(v_alu.nombre || ' ' || coalesce(v_alu.apellidos, '')), v_alu.tutor_nombre,
            coalesce(nullif(v_alu.tutor_telefono, ''), nullif(v_alu.telefono, ''), '000000000'), 'Dijo el código al apuntarse')
    returning id into v_id;
  end if;
  perform public.validar_interesada(v_id, p_alumna, v_ins);
  return 'ok';
end; $$;
revoke all on function public.objetivo_aplicar_codigo(uuid, text) from public, anon;
grant execute on function public.objetivo_aplicar_codigo(uuid, text) to authenticated;

-- Pagar el plus de una profesora: un gasto del evento en Caja con lo que se le debe
create or replace function public.pagar_objetivo(p_evento uuid, p_profesora uuid, p_metodo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_n int; v_eur numeric; v_nom text; v_tit text; v_caja uuid;
begin
  if not (public.gestiona_objetivo() and public.escribe_caja_general()) then raise exception 'Sin permiso'; end if;
  select objetivo_euros, titulo into v_eur, v_tit from public.eventos where id = p_evento;
  select count(*) into v_n from public.evento_interesadas
  where evento_id = p_evento and profesora_id = p_profesora and validada_en is not null and caja_id is null;
  if v_eur is null or v_n = 0 then raise exception 'No hay nada pendiente de pagar'; end if;
  select nombre into v_nom from public.profesoras where id = p_profesora;
  insert into public.caja (fecha, tipo, concepto, importe, metodo, apartado, evento_id)
  values (current_date, 'gasto', 'Objetivo extra · ' || v_nom || ' (' || v_n || ' alumna' || case when v_n = 1 then '' else 's' end || ')',
          v_n * v_eur, p_metodo, 'evento', p_evento)
  returning id into v_caja;
  perform set_config('bs.objetivo', '1', true);
  update public.evento_interesadas set caja_id = v_caja
  where evento_id = p_evento and profesora_id = p_profesora and validada_en is not null and caja_id is null;
  return v_caja;
end; $$;
revoke all on function public.pagar_objetivo(uuid, uuid, text) from public, anon;
grant execute on function public.pagar_objetivo(uuid, uuid, text) to authenticated;
