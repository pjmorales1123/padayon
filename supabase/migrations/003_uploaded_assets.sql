-- Track uploaded files to avoid re-processing the same image/PDF pages.
create table if not exists uploaded_assets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  topic_id uuid references topics(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,

  file_hash text not null,
  file_name text,
  mime_type text,
  asset_type text check (asset_type in ('image', 'pdf')),

  preview_url text,
  storage_path text,
  extracted_text text,

  processing_status text default 'processed',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, file_hash)
);

create index if not exists idx_uploaded_assets_user_hash on uploaded_assets(user_id, file_hash);
create index if not exists idx_uploaded_assets_topic on uploaded_assets(topic_id);
