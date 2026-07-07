CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE memory_documents
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS memory_documents_embedding_hnsw_idx
  ON memory_documents USING hnsw (embedding vector_cosine_ops);
