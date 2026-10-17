-- 019 · Personas borradas del equipo
-- Al borrar a alguien desde Equipo su perfil no se elimina: se marca la fecha y se le quita el acceso,
-- para que deje de salir en Equipo y lo que apuntó siga diciendo quién lo hizo.
alter table public.perfiles add column if not exists borrado_en timestamptz;
