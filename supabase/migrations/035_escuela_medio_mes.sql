-- 035 · Escuela amiga por porcentaje: precio de MEDIO MES por alumna (además del mes completo)
-- Ejemplo: mes completo 35 €, medio mes 20 €. En Contabilidad se ponen cuántas alumnas
-- pagaron el mes completo y cuántas medio mes, y sale el total y nuestra parte.
-- Solo se añade una columna (0 en las escuelas que ya hay). No se toca ningún dato.

alter table public.escuelas_amigas
  add column if not exists precio_medio_alumna numeric(10,2) not null default 0;

do $$ begin
  alter table public.escuelas_amigas add constraint escuelas_amigas_precio_medio_chk check (precio_medio_alumna >= 0);
exception when duplicate_object then null; end $$;
