-- Permite que o administrador exclua um candidato e a foto dele (botão "Excluir" da área administrativa).
-- Precisa da função public.my_role(), criada pelos arquivos SQL do sistema de conferência.

drop policy if exists "admin exclui curriculos" on public.job_applications;
create policy "admin exclui curriculos"
on public.job_applications for delete
to authenticated
using (public.my_role() = 'admin');

drop policy if exists "admin exclui fotos candidato" on storage.objects;
create policy "admin exclui fotos candidato"
on storage.objects for delete
to authenticated
using (bucket_id = 'candidato-fotos' and public.my_role() = 'admin');
