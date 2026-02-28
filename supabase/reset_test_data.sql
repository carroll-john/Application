begin;

delete from public.applications;

alter sequence if exists public.application_number_seq restart with 1000000;

commit;

delete from storage.objects
where bucket_id = 'application-documents';
