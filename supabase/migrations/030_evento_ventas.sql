-- 030 · Elegir si un evento tiene ventas (camisetas, entradas…)
-- En algunos eventos no se vende nada: con la casilla quitada, el apartado "Ventas y reservas" no sale en ese evento.
-- Solo se añade una columna; todos los eventos que ya hay siguen con ventas, como hasta ahora.

alter table public.eventos add column if not exists con_ventas boolean not null default true;

-- Halloween (el de Conchy) no tiene venta de camisetas: se quita el apartado (no se borra nada; se puede volver a marcar)
update public.eventos set con_ventas = false where titulo ilike '%halloween%';
