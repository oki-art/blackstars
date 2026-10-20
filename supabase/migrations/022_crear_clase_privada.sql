-- 022 · Arreglo: no dejaba crear una clase privada (Pilates)
-- Con la 021, la lista de clases privadas visibles se calculaba antes de crear la clase,
-- así que la clase recién creada no estaba en ella y salía "No tienes permiso".
-- Ahora se mira directamente: la administración, quien tenga el permiso Pilates o su profesora.
-- Misma regla que antes, igual de rápida. No se toca ningún dato.
alter policy clases_select on public.clases using (
  (select public.puede_ver('clases'))
  and (not (select public.solo_propias('clases')) or id in (select public.mis_clases()))
  and (not privada
       or (select public.es_admin())
       or ((select public.puede_ver('pilates')) and not (select public.solo_propias('pilates')))
       or id in (select public.mis_clases())));

notify pgrst, 'reload schema';
