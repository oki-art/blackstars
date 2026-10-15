-- 015 · Ventas y reservas dentro de un evento (camisetas, entradas de teatro...).
-- Cada evento puede tener artículos con su precio (Camiseta 15 €, Entrada 8 €).
-- Cada reserva dice quién compra (alumna o nombre), cuántas unidades, talla y si está pagada.
-- Al marcar "pagada" se crea el ingreso en caja (apartado evento) y queda enlazado a la reserva.
-- Solo se añaden tablas y funciones: no se toca ni se borra nada de lo que ya hay.

create table public.evento_articulos (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.eventos(id) on delete cascade,
  nombre     text not null,
  precio     numeric(10,2) not null check (precio >= 0),
  con_talla  boolean not null default false,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en  timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id),
  modificado_en  timestamptz
);

create table public.evento_reservas (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  articulo_id uuid not null references public.evento_articulos(id) on delete restrict,
  alumna_id   uuid references public.alumnas(id) on delete set null,
  comprador   text,                       -- si no es alumna (familiar, público...)
  cantidad    integer not null check (cantidad > 0),
  talla       text,
  importe     numeric(10,2) not null check (importe >= 0),
  estado      text not null default 'reservada' check (estado in ('reservada','pagada','cancelada')),
  metodo      text check (metodo in ('efectivo','tarjeta','bizum','transferencia')),
  pagado_en   timestamptz,
  caja_id     uuid references public.caja(id) on delete set null,
  nota        text,
  creado_por  uuid default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id),
  modificado_en  timestamptz,
  check (alumna_id is not null or comprador is not null)
);
create index evento_reservas_evento_idx on public.evento_reservas (evento_id);

create trigger auditar_evento_articulos before insert or update on public.evento_articulos for each row execute function public.auditar();
create trigger auditar_evento_reservas before insert or update on public.evento_reservas for each row execute function public.auditar();

-- Quién gestiona las ventas: quien edita eventos o quien edita la caja (recepción)
create or replace function public.gestiona_ventas() returns boolean language sql stable security definer set search_path = public as $$
  select public.puede_escribir('eventos') or public.puede_escribir('caja');
$$;
revoke all on function public.gestiona_ventas() from public, anon;
grant execute on function public.gestiona_ventas() to authenticated;

alter table public.evento_articulos enable row level security;
alter table public.evento_reservas enable row level security;

-- Se ven si se ve el evento (respeta "solo lo mío" de las profesoras) o si se ve la caja
create policy evento_articulos_select on public.evento_articulos for select
  using (public.puede_ver('caja') or evento_id in (select id from public.eventos));
create policy evento_articulos_insert on public.evento_articulos for insert with check (public.gestiona_ventas());
create policy evento_articulos_update on public.evento_articulos for update using (public.gestiona_ventas()) with check (public.gestiona_ventas());
create policy evento_articulos_delete on public.evento_articulos for delete using (public.gestiona_ventas());

create policy evento_reservas_select on public.evento_reservas for select
  using (public.puede_ver('caja') or evento_id in (select id from public.eventos));
create policy evento_reservas_insert on public.evento_reservas for insert
  with check (public.gestiona_ventas() and estado = 'reservada' and caja_id is null);
-- El pago no se marca a mano: se hace con pagar_reserva(), que crea el ingreso en caja
create policy evento_reservas_update on public.evento_reservas for update
  using (public.gestiona_ventas()) with check (public.gestiona_ventas());
create policy evento_reservas_delete on public.evento_reservas for delete using (public.es_admin());

-- Una reserva pagada no se cambia a mano (solo la administración puede deshacer el pago)
create or replace function public.reserva_protegida() returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('blackstars.pago', true) = 'si' then return new; end if;
  if old.estado = 'pagada' or new.estado = 'pagada' or new.caja_id is distinct from old.caja_id then
    raise exception 'Para cobrar o deshacer un pago usa los botones de la app';
  end if;
  return new;
end; $$;
create trigger reserva_protegida before update on public.evento_reservas for each row execute function public.reserva_protegida();

-- Cobrar: marca la reserva como pagada y crea el ingreso en caja (todo a la vez)
create or replace function public.pagar_reserva(p_id uuid, p_metodo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.evento_reservas; a public.evento_articulos; nueva uuid;
begin
  if not public.puede_escribir('caja') then raise exception 'No tienes permiso para cobrar'; end if;
  select * into r from public.evento_reservas where id = p_id for update;
  if not found then raise exception 'Esa reserva no existe'; end if;
  if r.estado <> 'reservada' then raise exception 'Esa reserva ya está pagada o cancelada'; end if;
  select * into a from public.evento_articulos where id = r.articulo_id;
  insert into public.caja (fecha, tipo, concepto, importe, metodo, alumna_id, apartado, evento_id)
  values (current_date, 'ingreso', a.nombre || ' ×' || r.cantidad || coalesce(' · talla ' || r.talla, '') || coalesce(' · ' || r.comprador, ''),
          r.importe, p_metodo, r.alumna_id, 'evento', r.evento_id)
  returning id into nueva;
  perform set_config('blackstars.pago', 'si', true);
  update public.evento_reservas set estado = 'pagada', pagado_en = now(), metodo = p_metodo, caja_id = nueva where id = p_id;
  perform set_config('blackstars.pago', 'no', true);
  return nueva;
end; $$;

-- Deshacer un pago (equivocación): solo la administración. Borra el ingreso y la reserva vuelve a "reservada"
create or replace function public.deshacer_pago(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.evento_reservas;
begin
  if not public.es_admin() then raise exception 'Solo la administración puede deshacer un pago'; end if;
  select * into r from public.evento_reservas where id = p_id for update;
  if not found or r.estado <> 'pagada' then raise exception 'Esa reserva no está pagada'; end if;
  perform set_config('blackstars.pago', 'si', true);
  update public.evento_reservas set estado = 'reservada', pagado_en = null, metodo = null, caja_id = null where id = p_id;
  perform set_config('blackstars.pago', 'no', true);
  if r.caja_id is not null then delete from public.caja where id = r.caja_id; end if;
end; $$;

revoke all on function public.pagar_reserva(uuid, text) from public, anon;
revoke all on function public.deshacer_pago(uuid) from public, anon;
grant execute on function public.pagar_reserva(uuid, text) to authenticated;
grant execute on function public.deshacer_pago(uuid) to authenticated;
revoke all on public.evento_articulos, public.evento_reservas from anon;
