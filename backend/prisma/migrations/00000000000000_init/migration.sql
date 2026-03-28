-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "max_agents" INTEGER NOT NULL DEFAULT 39,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_agents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "custom_name" TEXT,
    "custom_prompt" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tenant_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "key" TEXT NOT NULL,
    "caller_name" TEXT NOT NULL,
    "caller_last_name" TEXT NOT NULL DEFAULT '',
    "caller_phone" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "key_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "retention_until" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "text_plain" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "call_sid" TEXT,
    "caller_phone" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "duration" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'es-ES',
    "nif_provided" TEXT,
    "session_id" TEXT,
    "recording_url" TEXT,
    "transferred_to" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "session_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "storage_type" TEXT NOT NULL DEFAULT 'local',
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "tenant_agents_tenant_id_service_id_key" ON "tenant_agents"("tenant_id", "service_id");
CREATE UNIQUE INDEX "call_history_call_sid_key" ON "call_history"("call_sid");

CREATE INDEX "sessions_key_caller_phone_idx" ON "sessions"("key", "caller_phone");
CREATE INDEX "sessions_deleted_at_idx" ON "sessions"("deleted_at");
CREATE INDEX "sessions_retention_until_idx" ON "sessions"("retention_until");
CREATE INDEX "sessions_tenant_id_idx" ON "sessions"("tenant_id");

CREATE INDEX "messages_session_id_idx" ON "messages"("session_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

CREATE INDEX "call_history_service_id_idx" ON "call_history"("service_id");
CREATE INDEX "call_history_caller_phone_idx" ON "call_history"("caller_phone");
CREATE INDEX "call_history_created_at_idx" ON "call_history"("created_at");
CREATE INDEX "call_history_tenant_id_idx" ON "call_history"("tenant_id");

CREATE INDEX "documents_session_id_idx" ON "documents"("session_id");
CREATE INDEX "documents_tenant_id_idx" ON "documents"("tenant_id");

-- Full-text search index (Spanish)
CREATE INDEX "messages_text_plain_fts_idx" ON "messages" USING GIN (to_tsvector('spanish', "text_plain")) WHERE "text_plain" IS NOT NULL;

-- Foreign Keys
ALTER TABLE "tenant_agents" ADD CONSTRAINT "tenant_agents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_history" ADD CONSTRAINT "call_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
