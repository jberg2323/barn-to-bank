-- Feature request screenshots / PDFs (base64 data URLs, max 2 per row)
alter table public.feature_requests
  add column if not exists attachments jsonb;

comment on column public.feature_requests.attachments is 'Optional array of {name,mime,size,dataUrl} uploads from staff app';