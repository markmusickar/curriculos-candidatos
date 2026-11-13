-- Segurança dos currículos. Rode no SQL Editor do Supabase. Pode rodar mais de uma vez.
-- Precisa da função public.my_role(), criada pelos arquivos SQL do sistema de conferência
-- (os dois sistemas usam o mesmo projeto Supabase).
--
-- O que muda:
--  1) As fotos dos candidatos deixam de ser públicas (só o administrador vê, por link temporário).
--  2) Só entra foto JPEG de até 2 MB, com nome no formato esperado.
--  3) O envio do currículo passa a ter limites de tamanho e não aceita status/origem inventados.

-- 1 e 2) Bucket privado, só JPEG, até 2 MB
update storage.buckets
   set public = false,
       file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg']
 where id = 'candidato-fotos';

drop policy if exists "candidato envia foto" on storage.objects;
create policy "candidato envia foto"
on storage.objects for insert
to anon
with check (
  bucket_id = 'candidato-fotos'
  and name ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-z-]{1,80}\.jpg$'
);

-- 3) Limites de tamanho. NOT VALID: vale para os novos envios, sem travar os currículos antigos.
alter table public.job_applications drop constraint if exists job_applications_limites;
alter table public.job_applications
  add constraint job_applications_limites check (
    char_length(full_name) between 1 and 120
    and char_length(phone) between 1 and 30
    and char_length(city) between 1 and 80
    and (neighborhood is null or char_length(neighborhood) <= 80)
    and char_length(desired_role) between 1 and 60
    and (market_experience is null or char_length(market_experience) <= 20)
    and char_length(availability) between 1 and 40
    and (requirements is null or char_length(requirements) <= 800)
    and (experience is null or char_length(experience) <= 2000)
    and (notes is null or char_length(notes) <= 2000)
    and (marital_status is null or char_length(marital_status) <= 40)
    and (photo_path is null or char_length(photo_path) <= 200)
    and (age is null or age between 14 and 90)
    and (children_count is null or children_count <= 30)
  ) not valid;

-- Envio público: o candidato não escolhe status, origem nem data, e a foto precisa estar no nosso armazenamento.
drop policy if exists "candidato envia curriculo" on public.job_applications;
create policy "candidato envia curriculo"
on public.job_applications for insert
to anon
with check (
  status = 'novo'
  and source = 'formulario_web'
  and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
  and (photo_path is null or photo_path ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-z-]{1,80}\.jpg$')
  and (
    photo_url is null
    or photo_url like 'https://upozyqpdmxhhnynqoefs.supabase.co/storage/v1/object/public/candidato-fotos/%'
  )
);
