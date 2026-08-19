-- Alias aprendidos: ordenante del banco -> contacto de Zoho Books
create table if not exists payment_aliases (
  id                uuid primary key default gen_random_uuid(),
  ordenante         text not null unique,
  zoho_contact_id   text,
  cliente_nombre    text,
  veces_usado       integer not null default 1,
  creado_por        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now(),
  last_used_at      timestamptz not null default now()
);

-- Movimientos bancarios importados, para no procesar dos veces el mismo
create table if not exists bank_transactions (
  id             uuid primary key default gen_random_uuid(),
  fingerprint    text not null unique,
  posting_date   date not null,
  description    text not null,
  amount         numeric(12,2) not null,
  tipo           text,
  ordenante      text,
  ref_factura    text,
  proposal_id    uuid references proposals(id) on delete set null,
  zoho_payment_id text,
  conciliado_at  timestamptz,
  conciliado_por uuid references users(id) on delete set null,
  ignorado       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_bank_tx_pendientes
  on bank_transactions(posting_date desc) where conciliado_at is null and ignorado = false;
