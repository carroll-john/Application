-- Eligibility feedback is stored as a small JSON document in the private
-- application-documents bucket.
update storage.buckets
set allowed_mime_types = case
  when allowed_mime_types is null then array['application/json']::text[]
  when 'application/json' = any(allowed_mime_types) then allowed_mime_types
  else array_append(allowed_mime_types, 'application/json')
end
where id = 'application-documents';
