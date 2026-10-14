-- 012 · Datos personales de cada profesora (talla de camiseta, DNI, cuenta bancaria...).
-- Son datos sensibles: los ve y los corrige SOLO la administración y la propia profesora (los suyos).
-- Van en una tabla aparte porque la ficha de profesoras la pueden ver otras personas del equipo.

create table public.profesoras_datos (
  profesora_id        uuid primary key references public.profesoras(id) on delete cascade,
  dni                 text,
  fecha_nacimiento    date,
  direccion           text,
  seguridad_social    text,
  iban                text,
  talla_camiseta      text check (talla_camiseta in ('XS','S','M','L','XL','XXL')),
  talla_pantalon      text,
  emergencia_nombre   text,
  emergencia_telefono text,
  notas               text,
  creado_por          uuid default auth.uid() references public.perfiles(id),
  creado_en           timestamptz not null default now(),
  modificado_por      uuid references public.perfiles(id),
  modificado_en       timestamptz
);

create trigger auditar_profesoras_datos before insert or update on public.profesoras_datos
  for each row execute function public.auditar();

alter table public.profesoras_datos enable row level security;
create policy profesoras_datos_select on public.profesoras_datos for select
  using (public.es_admin() or profesora_id = public.mi_profesora());
create policy profesoras_datos_insert on public.profesoras_datos for insert
  with check (public.es_admin() or profesora_id = public.mi_profesora());
create policy profesoras_datos_update on public.profesoras_datos for update
  using (public.es_admin() or profesora_id = public.mi_profesora())
  with check (public.es_admin() or profesora_id = public.mi_profesora());
create policy profesoras_datos_delete on public.profesoras_datos for delete
  using (public.es_admin());

revoke all on public.profesoras_datos from anon;
