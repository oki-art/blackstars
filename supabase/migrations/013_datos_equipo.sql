-- 013 · Datos personales del resto del equipo (recepción, gestión...) que no tienen ficha de profesora.
-- Mismos datos que profesoras_datos (DNI, cuenta, tallas...), pero ligados al usuario.
-- Los ve y los corrige SOLO la administración y la propia persona (los suyos).

create table public.perfiles_datos (
  perfil_id           uuid primary key references public.perfiles(id) on delete cascade,
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

create trigger auditar_perfiles_datos before insert or update on public.perfiles_datos
  for each row execute function public.auditar();

alter table public.perfiles_datos enable row level security;
create policy perfiles_datos_select on public.perfiles_datos for select
  using (public.es_admin() or perfil_id = auth.uid());
create policy perfiles_datos_insert on public.perfiles_datos for insert
  with check (public.es_admin() or perfil_id = auth.uid());
create policy perfiles_datos_update on public.perfiles_datos for update
  using (public.es_admin() or perfil_id = auth.uid())
  with check (public.es_admin() or perfil_id = auth.uid());
create policy perfiles_datos_delete on public.perfiles_datos for delete
  using (public.es_admin());

revoke all on public.perfiles_datos from anon;
