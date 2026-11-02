-- Chỉ mục bộ đệm thư (D1). File .eml gốc nằm trên R2 tại r2_key.
-- Áp dụng: npx wrangler d1 execute mailtion-buffer --remote --file schema.sql
CREATE TABLE IF NOT EXISTS inbound (
  id TEXT PRIMARY KEY,               -- deliveryId gửi kèm webhook, Mailtion dùng để chống trùng
  received_at TEXT NOT NULL,         -- ISO time Worker nhận thư
  envelope_from TEXT NOT NULL,
  envelope_to TEXT NOT NULL,
  subject TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT,                       -- NULL nếu ghi R2 lỗi (thư vẫn có thể đã giao)
  status TEXT NOT NULL,              -- pending | delivered | dropped | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_attempt_at TEXT,
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_inbound_status_received ON inbound(status, received_at);
CREATE INDEX IF NOT EXISTS idx_inbound_received ON inbound(received_at);
