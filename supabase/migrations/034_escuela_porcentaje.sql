-- 034 · Escuela amiga: elegir cómo nos paga, "por horas" (como hasta ahora) o "por porcentaje"
-- Por porcentaje: lo que cobran a sus alumnas (nº de alumnas × precio al mes) se reparte;
-- un porcentaje es para Blackstars y el resto se lo queda la escuela amiga.
-- Ejemplo: 10 alumnas × 30 € = 300 €; con un 35 % para nosotros son 105 € y 195 € para ellas.
-- Solo se añaden columnas (todas las escuelas que ya hay siguen "por horas") y se amplía el resumen.
-- No se borra ni se cambia ningún dato.

alter table public.escuelas_amigas
  add column if not exists modo_cobro text not null default 'horas',
  add column if not exists precio_alumna numeric(10,2) not null default 0,
  add column if not exists porcentaje_nuestro numeric(5,2) not null default 0;

do $$ begin
  alter table public.escuelas_amigas add constraint escuelas_amigas_modo_cobro_chk check (modo_cobro in ('horas', 'porcentaje'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.escuelas_amigas add constraint escuelas_amigas_precio_alumna_chk check (precio_alumna >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.escuelas_amigas add constraint escuelas_amigas_porcentaje_chk check (porcentaje_nuestro between 0 and 100);
exception when duplicate_object then null; end $$;

-- Resumen: mismas columnas de antes (en el mismo orden) y al final las nuevas.
-- cuota_mensual = lo que NOS paga al mes, según el modo de la escuela.
create or replace view public.escuela_amiga_resumen with (security_invoker = true) as
  select e.id, e.nombre, e.tarifa_hora_semana, e.activa,
         coalesce(h.horas_semana, 0)  as horas_semana,
         coalesce(k.n_clases, 0)      as n_clases,
         coalesce(k.n_alumnas, 0)     as n_alumnas,
         case when e.modo_cobro = 'porcentaje'
              then round(coalesce(k.n_alumnas, 0) * e.precio_alumna * e.porcentaje_nuestro / 100.0, 2)
              else round(coalesce(h.horas_semana, 0) * e.tarifa_hora_semana, 2) end as cuota_mensual,
         e.modo_cobro, e.precio_alumna, e.porcentaje_nuestro,
         round(coalesce(k.n_alumnas, 0) * e.precio_alumna, 2) as total_alumnas
  from public.escuelas_amigas e
  left join (
    select c.escuela_amiga_id, sum(extract(epoch from (ch.hora_fin - ch.hora_inicio)) / 3600.0) as horas_semana
    from public.clase_horarios ch join public.clases c on c.id = ch.clase_id
    where c.activa and c.escuela_amiga_id is not null
    group by c.escuela_amiga_id
  ) h on h.escuela_amiga_id = e.id
  left join (
    select c.escuela_amiga_id, count(*) as n_clases, sum(coalesce(c.alumnas_externas, 0)) as n_alumnas
    from public.clases c where c.activa and c.escuela_amiga_id is not null
    group by c.escuela_amiga_id
  ) k on k.escuela_amiga_id = e.id;
revoke all on public.escuela_amiga_resumen from anon;
