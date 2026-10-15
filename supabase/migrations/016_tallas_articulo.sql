-- 016 · Tallas propias de cada artículo (niña 3-4 años… 13-14 años, XS… XXL), editables.
-- Si un artículo no tiene lista, la app usa la de siempre. Solo añade una columna: no borra nada.
alter table public.evento_articulos add column if not exists tallas text[];
