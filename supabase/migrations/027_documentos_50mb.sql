-- Documentos: archivos de hasta 50 MB (el máximo del plan gratuito) en vez de 10 MB
update storage.buckets set file_size_limit = 52428800 where id = 'documentos';
