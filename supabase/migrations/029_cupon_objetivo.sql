-- 029 · Cupón de descuento para la familia en el objetivo extra
-- El código de la profesora es también un cupón: si la niña se apunta a una clase en el mes elegido (p. ej. noviembre),
-- tiene un descuento (p. ej. 5 €) en la cuota de ese mes. Se aplica una sola vez, al cobrar esa mensualidad en Caja.
-- Solo se añade: dos columnas en eventos y una en evento_interesadas. No se toca ningún dato.

alter table public.eventos
  add column if not exists cupon_euros numeric(10,2) check (cupon_euros is null or cupon_euros > 0),
  add column if not exists cupon_mes date check (cupon_mes is null or extract(day from cupon_mes) = 1);

-- Cobro de Caja en el que se usó el cupón (si se borra ese cobro, el cupón vuelve a quedar sin usar)
alter table public.evento_interesadas add column if not exists cupon_caja_id uuid references public.caja(id) on delete set null;

-- La profesora tampoco puede marcar el cupón como usado
create or replace function public.proteger_interesada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Las funciones de abajo (validar al inscribir, código, pagar, cupón) pasan con su propia marca
  if public.gestiona_objetivo() or current_setting('bs.objetivo', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.profesora_id := public.mi_profesora();
    new.alumna_id := null; new.inscripcion_id := null; new.validada_en := null; new.caja_id := null; new.cupon_caja_id := null;
  else
    new.evento_id := old.evento_id; new.profesora_id := old.profesora_id;
    new.alumna_id := old.alumna_id; new.inscripcion_id := old.inscripcion_id;
    new.validada_en := old.validada_en; new.caja_id := old.caja_id; new.cupon_caja_id := old.cupon_caja_id;
  end if;
  return new;
end; $$;

-- El aviso verde al inscribir dice también si hay cupón para la niña
drop function if exists public.objetivo_codigo(text);
create function public.objetivo_codigo(p_codigo text)
returns table (evento_id uuid, evento text, profesora_id uuid, profesora text, euros numeric, cupon_euros numeric, cupon_mes date)
language sql stable security definer set search_path = public as $$
  select e.id, e.titulo, pr.id, pr.nombre, e.objetivo_euros, e.cupon_euros, e.cupon_mes
  from public.evento_codigos c
  join public.eventos e on e.id = c.evento_id and e.objetivo_euros is not null
  join public.profesoras pr on pr.id = c.profesora_id
  where c.codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'))
    and (public.es_admin() or public.puede_escribir('inscripciones') or public.ve_todo_objetivo())
  order by e.fecha desc limit 1;
$$;
revoke all on function public.objetivo_codigo(text) from public, anon;
grant execute on function public.objetivo_codigo(text) to authenticated;

-- ¿Tiene esta alumna un cupón para la cuota de este mes? Vale si se apuntó (por un evento con cupón) a una clase
-- en ese mismo mes y todavía no lo ha usado.
create or replace function public.cupon_alumna(p_alumna uuid, p_fecha date)
returns table (interesada_id uuid, euros numeric, codigo text, profesora text, evento text)
language sql stable security definer set search_path = public as $$
  select i.id, e.cupon_euros, c.codigo, pr.nombre, e.titulo
  from public.evento_interesadas i
  join public.eventos e on e.id = i.evento_id and e.cupon_euros is not null and e.cupon_mes = date_trunc('month', p_fecha)::date
  join public.inscripciones ins on ins.id = i.inscripcion_id
  join public.profesoras pr on pr.id = i.profesora_id
  left join public.evento_codigos c on c.evento_id = i.evento_id and c.profesora_id = i.profesora_id
  where i.alumna_id = p_alumna and i.validada_en is not null and i.cupon_caja_id is null
    and date_trunc('month', ins.fecha_alta) = date_trunc('month', p_fecha)
    and (public.es_admin() or public.escribe_caja_general())
  order by i.validada_en limit 1;
$$;
revoke all on function public.cupon_alumna(uuid, date) from public, anon;
grant execute on function public.cupon_alumna(uuid, date) to authenticated;

-- Marcar el cupón como usado en un cobro de Caja (de esa misma alumna)
create or replace function public.usar_cupon(p_interesada uuid, p_caja uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.es_admin() or public.escribe_caja_general()) then raise exception 'Sin permiso'; end if;
  perform set_config('bs.objetivo', '1', true);
  update public.evento_interesadas i set cupon_caja_id = p_caja
  where i.id = p_interesada and i.cupon_caja_id is null
    and exists (select 1 from public.caja k where k.id = p_caja and k.alumna_id = i.alumna_id and k.tipo = 'ingreso');
end; $$;
revoke all on function public.usar_cupon(uuid, uuid) from public, anon;
grant execute on function public.usar_cupon(uuid, uuid) to authenticated;
