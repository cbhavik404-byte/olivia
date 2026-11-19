import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDataDir(): string {
  const preferred = path.join(__dirname, '.nexa-data');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), '.nexa-data');
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, 'nexa.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize persistent relational tables
db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL DEFAULT 'bhavik-core',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'Manual',
    status TEXT NOT NULL DEFAULT 'Active',
    verificationStatus TEXT NOT NULL DEFAULT 'UserVerified',
    confidence REAL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    lastRecalledAt TEXT,
    recallCount INTEGER NOT NULL DEFAULT 0,
    relatedMemoryIds TEXT NOT NULL DEFAULT '[]',
    sourceConversationId TEXT,
    tier TEXT NOT NULL DEFAULT 'long_term',
    projectId TEXT,
    projectName TEXT,
    personalityId TEXT NOT NULL DEFAULT 'shared',
    resolutionStatus TEXT NOT NULL DEFAULT 'open'
  );

  CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(tier);
  CREATE INDEX IF NOT EXISTS idx_memories_personality ON memories(personalityId);
  CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(projectId);

  CREATE TABLE IF NOT EXISTS conversation_snapshots (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    projectId TEXT,
    personalityId TEXT NOT NULL DEFAULT 'default',
    summary TEXT NOT NULL DEFAULT '',
    turns TEXT NOT NULL DEFAULT '[]',
    savedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS personality_language_configs (
    personalityId TEXT PRIMARY KEY,
    languageRegister TEXT NOT NULL DEFAULT 'casual',
    profanityLevel INTEGER NOT NULL DEFAULT 1,
    allowSlang INTEGER NOT NULL DEFAULT 1,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS personality_knowledge (
    id TEXT PRIMARY KEY,
    personalityId TEXT NOT NULL,
    topic TEXT NOT NULL,
    summary TEXT NOT NULL,
    sourceUrl TEXT NOT NULL DEFAULT '',
    sourceTitle TEXT NOT NULL DEFAULT '',
    publishedAt TEXT NOT NULL DEFAULT '',
    retrievedAt TEXT NOT NULL,
    contentHash TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    verificationStatus TEXT NOT NULL DEFAULT 'CONFIRMED',
    UNIQUE(personalityId, contentHash)
  );

  CREATE INDEX IF NOT EXISTS idx_knowledge_persona ON personality_knowledge(personalityId, retrievedAt DESC);

  CREATE TABLE IF NOT EXISTS knowledge_update_logs (
    id TEXT PRIMARY KEY,
    personalityId TEXT NOT NULL,
    status TEXT NOT NULL,
    itemsAdded INTEGER NOT NULL DEFAULT 0,
    itemsUpdated INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actionType TEXT NOT NULL,
    target TEXT NOT NULL,
    status TEXT NOT NULL,
    confirmedByUser INTEGER NOT NULL DEFAULT 0,
    details TEXT NOT NULL DEFAULT '',
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_telemetry (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    operation TEXT NOT NULL,
    model TEXT NOT NULL,
    attemptCount INTEGER NOT NULL DEFAULT 1,
    fallbackUsed INTEGER NOT NULL DEFAULT 0,
    latencyMs INTEGER NOT NULL,
    status TEXT NOT NULL,
    httpStatus INTEGER NOT NULL,
    errorMessage TEXT,
    promptTokens INTEGER,
    completionTokens INTEGER,
    totalTokens INTEGER,
    estimatedCostUsd REAL,
    costStatus TEXT NOT NULL DEFAULT 'pricing_unavailable',
    createdAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_api_telemetry_created ON api_telemetry(createdAt DESC);

  CREATE TABLE IF NOT EXISTS news_articles (
    id TEXT PRIMARY KEY,
    headline TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    whyItMatters TEXT NOT NULL DEFAULT '',
    publishedAt TEXT NOT NULL,
    eventTime TEXT NOT NULL DEFAULT '',
    sourceLinks TEXT NOT NULL DEFAULT '[]',
    confidenceStatus TEXT NOT NULL DEFAULT 'DEVELOPING',
    crossCheckCount INTEGER NOT NULL DEFAULT 1,
    contentHash TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_news_category_pub ON news_articles(category, publishedAt DESC);
  CREATE INDEX IF NOT EXISTS idx_news_created ON news_articles(createdAt DESC);

  CREATE TABLE IF NOT EXISTS capability_gaps (
    id TEXT PRIMARY KEY,
    commandText TEXT NOT NULL,
    intent TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'logged',
    occurrenceCount INTEGER NOT NULL DEFAULT 1,
    lastOccurredAt TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_capability_gaps_last ON capability_gaps(lastOccurredAt DESC);

  CREATE TABLE IF NOT EXISTS improvement_backlog (
    id TEXT PRIMARY KEY,
    proposedFeature TEXT NOT NULL,
    whyNeeded TEXT NOT NULL,
    expectedBenefit TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'Medium',
    dependencies TEXT NOT NULL DEFAULT '[]',
    priority TEXT NOT NULL DEFAULT 'Medium',
    status TEXT NOT NULL DEFAULT 'Proposed',
    sourceType TEXT NOT NULL DEFAULT 'system_audit',
    requiresApproval INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_improvement_priority ON improvement_backlog(priority, updatedAt DESC);
`);

// Safe schema migration for personality_knowledge 3-layer columns
try {
  const cols = db.prepare('PRAGMA table_info(personality_knowledge)').all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has('layer')) {
    db.exec("ALTER TABLE personality_knowledge ADD COLUMN layer TEXT NOT NULL DEFAULT 'knowledge_update'");
  }
  if (!colNames.has('isHistorical')) {
    db.exec('ALTER TABLE personality_knowledge ADD COLUMN isHistorical INTEGER NOT NULL DEFAULT 0');
  }
  if (!colNames.has('sourceDate')) {
    db.exec("ALTER TABLE personality_knowledge ADD COLUMN sourceDate TEXT NOT NULL DEFAULT ''");
  }
  if (!colNames.has('confidence')) {
    db.exec('ALTER TABLE personality_knowledge ADD COLUMN confidence REAL NOT NULL DEFAULT 0.9');
  }
} catch (migErr) {
  console.warn('[serverDb] Migration notice for personality_knowledge:', migErr);
}

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function listMemories(filters?: { tier?: string; projectId?: string; personalityId?: string }) {
  let sql = 'SELECT * FROM memories WHERE 1=1';
  const params: any[] = [];
  if (filters?.tier) {
    sql += ' AND tier = ?';
    params.push(filters.tier);
  }
  if (filters?.projectId) {
    sql += ' AND projectId = ?';
    params.push(filters.projectId);
  }
  if (filters?.personalityId) {
    sql += " AND (personalityId = ? OR personalityId = 'shared')";
    params.push(filters.personalityId);
  }
  sql += ' ORDER BY updatedAt DESC';
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map((r) => ({
    ...r,
    tags: parseJsonSafe<string[]>(r.tags, []),
    relatedMemoryIds: parseJsonSafe<string[]>(r.relatedMemoryIds, []),
  }));
}

export function upsertMemory(mem: any) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO memories (
      id, userId, title, content, category, tags, source, status,
      verificationStatus, confidence, createdAt, updatedAt, lastRecalledAt,
      recallCount, relatedMemoryIds, sourceConversationId,
      tier, projectId, projectName, personalityId, resolutionStatus
    ) VALUES (
      @id, @userId, @title, @content, @category, @tags, @source, @status,
      @verificationStatus, @confidence, @createdAt, @updatedAt, @lastRecalledAt,
      @recallCount, @relatedMemoryIds, @sourceConversationId,
      @tier, @projectId, @projectName, @personalityId, @resolutionStatus
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      category = excluded.category,
      tags = excluded.tags,
      status = excluded.status,
      verificationStatus = excluded.verificationStatus,
      confidence = excluded.confidence,
      updatedAt = excluded.updatedAt,
      lastRecalledAt = excluded.lastRecalledAt,
      recallCount = excluded.recallCount,
      relatedMemoryIds = excluded.relatedMemoryIds,
      tier = excluded.tier,
      projectId = excluded.projectId,
      projectName = excluded.projectName,
      personalityId = excluded.personalityId,
      resolutionStatus = excluded.resolutionStatus
  `);

  stmt.run({
    id: mem.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: mem.userId || 'bhavik-core',
    title: String(mem.title || 'Untitled').slice(0, 200),
    content: String(mem.content || ''),
    category: mem.category || 'Active',
    tags: JSON.stringify(Array.isArray(mem.tags) ? mem.tags : []),
    source: mem.source || 'Manual',
    status: mem.status || 'Active',
    verificationStatus: mem.verificationStatus || 'UserVerified',
    confidence: mem.confidence ?? 1.0,
    createdAt: mem.createdAt || now,
    updatedAt: mem.updatedAt || now,
    lastRecalledAt: mem.lastRecalledAt || null,
    recallCount: Number(mem.recallCount || 0),
    relatedMemoryIds: JSON.stringify(Array.isArray(mem.relatedMemoryIds) ? mem.relatedMemoryIds : []),
    sourceConversationId: mem.sourceConversationId || null,
    tier: mem.tier || 'long_term',
    projectId: mem.projectId || null,
    projectName: mem.projectName || null,
    personalityId: mem.personalityId || 'shared',
    resolutionStatus: mem.resolutionStatus || 'open',
  });
}

export function deleteMemoryById(id: string) {
  db.prepare('DELETE FROM memories WHERE id = ?').run(id);
}

export function listSnapshots() {
  const rows = db.prepare('SELECT * FROM conversation_snapshots ORDER BY savedAt DESC LIMIT 50').all() as any[];
  return rows.map((r) => ({
    ...r,
    turns: parseJsonSafe(r.turns, []),
  }));
}

export function saveSnapshot(snap: any) {
  const id = snap.id || `snap-${Date.now()}`;
  const savedAt = snap.savedAt || new Date().toISOString();
  db.prepare(`
    INSERT INTO conversation_snapshots (id, title, projectId, personalityId, summary, turns, savedAt)
    VALUES (@id, @title, @projectId, @personalityId, @summary, @turns, @savedAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      projectId = excluded.projectId,
      personalityId = excluded.personalityId,
      summary = excluded.summary,
      turns = excluded.turns,
      savedAt = excluded.savedAt
  `).run({
    id,
    title: String(snap.title || 'Session Context').slice(0, 160),
    projectId: snap.projectId || null,
    personalityId: snap.personalityId || 'default',
    summary: String(snap.summary || ''),
    turns: JSON.stringify(Array.isArray(snap.turns) ? snap.turns.slice(-80) : []),
    savedAt,
  });
  return { id, savedAt };
}

export function deleteSnapshot(id: string) {
  db.prepare('DELETE FROM conversation_snapshots WHERE id = ?').run(id);
}

export function getAllLanguageConfigs() {
  const rows = db.prepare('SELECT * FROM personality_language_configs').all() as any[];
  return rows.map((r) => ({
    personalityId: r.personalityId,
    languageRegister: r.languageRegister,
    profanityLevel: Number(r.profanityLevel),
    allowSlang: Boolean(r.allowSlang),
    updatedAt: r.updatedAt,
  }));
}

export function upsertLanguageConfig(config: {
  personalityId: string;
  languageRegister: string;
  profanityLevel: number;
  allowSlang: boolean;
}) {
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO personality_language_configs (personalityId, languageRegister, profanityLevel, allowSlang, updatedAt)
    VALUES (@personalityId, @languageRegister, @profanityLevel, @allowSlang, @updatedAt)
    ON CONFLICT(personalityId) DO UPDATE SET
      languageRegister = excluded.languageRegister,
      profanityLevel = excluded.profanityLevel,
      allowSlang = excluded.allowSlang,
      updatedAt = excluded.updatedAt
  `).run({
    personalityId: config.personalityId,
    languageRegister: config.languageRegister || 'casual',
    profanityLevel: Math.max(0, Math.min(3, Number(config.profanityLevel ?? 1))),
    allowSlang: config.allowSlang ? 1 : 0,
    updatedAt,
  });
  return { ...config, updatedAt };
}

export function listKnowledgeForPersonality(personalityId: string, limit: number = 25, layer?: string) {
  let sql = `
    SELECT * FROM personality_knowledge
    WHERE personalityId = ?
  `;
  const params: any[] = [personalityId];
  if (layer) {
    sql += ' AND layer = ?';
    params.push(layer);
  }
  sql += ' ORDER BY retrievedAt DESC LIMIT ?';
  params.push(limit);
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map((r) => ({
    ...r,
    isHistorical: Boolean(r.isHistorical),
    layer: r.layer || 'knowledge_update',
    sourceDate: r.sourceDate || r.publishedAt || '',
    confidence: Number(r.confidence ?? 0.9),
  }));
}

export function addOrUpdateKnowledge(entry: {
  personalityId: string;
  topic: string;
  summary: string;
  sourceUrl?: string;
  sourceTitle?: string;
  publishedAt?: string;
  verificationStatus?: string;
  layer?: 'core' | 'knowledge_update' | 'perspective';
  isHistorical?: boolean;
  sourceDate?: string;
  confidence?: number;
}): 'added' | 'duplicate' | 'updated' {
  // Core profile is strictly protected from automated updates
  const safeLayer = entry.layer === 'core' ? 'knowledge_update' : (entry.layer || 'knowledge_update');
  const normalized = `${entry.personalityId}::${safeLayer}::${entry.topic.toLowerCase().trim()}::${entry.summary.toLowerCase().trim().slice(0, 120)}`;
  const contentHash = crypto.createHash('sha256').update(normalized).digest('hex');
  const existing = db.prepare('SELECT id, version, summary FROM personality_knowledge WHERE personalityId = ? AND contentHash = ?').get(entry.personalityId, contentHash) as any;

  if (existing) {
    return 'duplicate';
  }

  // Check if same topic+layer exists to increment version
  const sameTopic = db.prepare('SELECT id, version FROM personality_knowledge WHERE personalityId = ? AND LOWER(topic) = LOWER(?) AND layer = ? ORDER BY version DESC LIMIT 1').get(entry.personalityId, entry.topic, safeLayer) as any;
  const nextVersion = sameTopic ? Number(sameTopic.version) + 1 : 1;
  const retrievedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO personality_knowledge (
      id, personalityId, topic, summary, sourceUrl, sourceTitle, publishedAt, retrievedAt, contentHash, version, verificationStatus,
      layer, isHistorical, sourceDate, confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `know-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    entry.personalityId,
    entry.topic,
    entry.summary,
    entry.sourceUrl || '',
    entry.sourceTitle || '',
    entry.publishedAt || retrievedAt.slice(0, 10),
    retrievedAt,
    contentHash,
    nextVersion,
    entry.verificationStatus || 'CONFIRMED',
    safeLayer,
    entry.isHistorical ? 1 : 0,
    entry.sourceDate || entry.publishedAt || retrievedAt.slice(0, 10),
    Number(entry.confidence ?? 0.9)
  );

  return sameTopic ? 'updated' : 'added';
}

export function logKnowledgeUpdate(log: {
  personalityId: string;
  status: 'success' | 'skipped' | 'error';
  itemsAdded: number;
  itemsUpdated: number;
  message: string;
}) {
  db.prepare(`
    INSERT INTO knowledge_update_logs (id, personalityId, status, itemsAdded, itemsUpdated, message, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `klog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    log.personalityId,
    log.status,
    log.itemsAdded,
    log.itemsUpdated,
    log.message,
    new Date().toISOString()
  );
}

export function listKnowledgeLogs(limit: number = 30) {
  return db.prepare('SELECT * FROM knowledge_update_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
}

export function addAuditLog(entry: {
  actionType: string;
  target: string;
  status: 'confirmed' | 'executed' | 'rejected' | 'failed';
  confirmedByUser: boolean;
  details: string;
}) {
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO audit_logs (id, actionType, target, status, confirmedByUser, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, entry.actionType, entry.target, entry.status, entry.confirmedByUser ? 1 : 0, entry.details, timestamp);
  return { id, ...entry, timestamp };
}

export function listAuditLogs(limit: number = 50) {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit) as any[];
  return rows.map((r) => ({ ...r, confirmedByUser: Boolean(r.confirmedByUser) }));
}

export function exportFullBackup() {
  return {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    memories: listMemories(),
    snapshots: listSnapshots(),
    languageConfigs: getAllLanguageConfigs(),
    knowledgeLogs: listKnowledgeLogs(100),
    auditLogs: listAuditLogs(100),
  };
}

export function importBackup(payload: any) {
  let importedMemories = 0;
  let importedSnapshots = 0;

  if (Array.isArray(payload?.memories)) {
    const tx = db.transaction((items: any[]) => {
      for (const m of items) {
        if (m && m.title && m.content) {
          upsertMemory(m);
          importedMemories++;
        }
      }
    });
    tx(payload.memories);
  }

  if (Array.isArray(payload?.snapshots)) {
    for (const s of payload.snapshots) {
      if (s && s.title) {
        saveSnapshot(s);
        importedSnapshots++;
      }
    }
  }

  if (Array.isArray(payload?.languageConfigs)) {
    for (const c of payload.languageConfigs) {
      if (c && c.personalityId) {
        upsertLanguageConfig(c);
      }
    }
  }

  return { importedMemories, importedSnapshots };
}

export function recordApiTelemetry(entry: {
  endpoint: string;
  operation: string;
  model: string;
  attemptCount?: number;
  fallbackUsed?: boolean;
  latencyMs: number;
  status: 'success' | 'quota_limited' | 'error';
  httpStatus: number;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  costStatus?: string;
}) {
  const id = `tel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO api_telemetry (
      id, endpoint, operation, model, attemptCount, fallbackUsed, latencyMs,
      status, httpStatus, errorMessage, promptTokens, completionTokens, totalTokens,
      estimatedCostUsd, costStatus, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entry.endpoint,
    entry.operation,
    entry.model || 'unknown',
    Math.max(1, Number(entry.attemptCount || 1)),
    entry.fallbackUsed ? 1 : 0,
    Math.max(0, Math.round(entry.latencyMs || 0)),
    entry.status,
    Number(entry.httpStatus || 200),
    entry.errorMessage ? String(entry.errorMessage).slice(0, 400) : null,
    entry.promptTokens != null ? Number(entry.promptTokens) : null,
    entry.completionTokens != null ? Number(entry.completionTokens) : null,
    entry.totalTokens != null ? Number(entry.totalTokens) : null,
    entry.estimatedCostUsd != null ? Number(entry.estimatedCostUsd) : null,
    entry.costStatus || 'pricing_unavailable',
    createdAt
  );
  return { id, createdAt };
}

export function listApiTelemetry(limit: number = 50) {
  const rows = db.prepare(`
    SELECT * FROM api_telemetry ORDER BY createdAt DESC LIMIT ?
  `).all(limit) as any[];
  return rows.map((r) => ({
    ...r,
    fallbackUsed: Boolean(r.fallbackUsed),
  }));
}

export function getApiTelemetrySummary() {
  const agg = db.prepare(`
    SELECT
      COUNT(*) as totalCalls,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCalls,
      SUM(CASE WHEN status = 'quota_limited' THEN 1 ELSE 0 END) as quotaLimitedCalls,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorCalls,
      SUM(CASE WHEN fallbackUsed = 1 THEN 1 ELSE 0 END) as fallbackCalls,
      AVG(latencyMs) as avgLatencyMs,
      SUM(COALESCE(promptTokens, 0)) as totalPromptTokens,
      SUM(COALESCE(completionTokens, 0)) as totalCompletionTokens,
      SUM(COALESCE(totalTokens, 0)) as totalTokens,
      SUM(estimatedCostUsd) as knownCostUsd,
      COUNT(estimatedCostUsd) as costEntryCount
    FROM api_telemetry
  `).get() as any;

  return {
    totalCalls: Number(agg?.totalCalls || 0),
    successCalls: Number(agg?.successCalls || 0),
    quotaLimitedCalls: Number(agg?.quotaLimitedCalls || 0),
    errorCalls: Number(agg?.errorCalls || 0),
    fallbackCalls: Number(agg?.fallbackCalls || 0),
    avgLatencyMs: Math.round(Number(agg?.avgLatencyMs || 0)),
    totalPromptTokens: Number(agg?.totalPromptTokens || 0),
    totalCompletionTokens: Number(agg?.totalCompletionTokens || 0),
    totalTokens: Number(agg?.totalTokens || 0),
    knownCostUsd: Number(agg?.costEntryCount || 0) > 0 && agg?.knownCostUsd != null ? Number(agg.knownCostUsd) : null,
  };
}

export function clearApiTelemetry() {
  db.prepare('DELETE FROM api_telemetry').run();
}

// ============================================================
// LIVE NEWS INTELLIGENCE ENGINE DB HELPERS
// ============================================================

export function upsertNewsArticle(article: {
  headline: string;
  category: string;
  summary: string;
  whyItMatters?: string;
  publishedAt: string;
  eventTime?: string;
  sourceLinks?: { title: string; url: string; publisher: string }[];
  confidenceStatus?: 'CONFIRMED' | 'DEVELOPING' | 'UNVERIFIED';
  crossCheckCount?: number;
}): 'added' | 'updated' | 'duplicate' {
  const cleanHeadline = article.headline.trim();
  const normalizedKey = `${cleanHeadline.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 110)}`;
  const contentHash = crypto.createHash('sha256').update(normalizedKey).digest('hex');
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM news_articles WHERE contentHash = ?').get(contentHash) as any;

  if (existing) {
    const existingSources = parseJsonSafe<{ title: string; url: string; publisher: string }[]>(existing.sourceLinks, []);
    const incomingSources = Array.isArray(article.sourceLinks) ? article.sourceLinks : [];
    const mergedMap = new Map<string, { title: string; url: string; publisher: string }>();
    for (const s of [...existingSources, ...incomingSources]) {
      if (s?.url) mergedMap.set(s.url, s);
    }
    const mergedSources = Array.from(mergedMap.values());
    const nextCrossCount = Math.max(Number(existing.crossCheckCount || 1), mergedSources.length, Number(article.crossCheckCount || 1));
    const nextConfidence =
      article.confidenceStatus === 'CONFIRMED' || nextCrossCount >= 2
        ? 'CONFIRMED'
        : existing.confidenceStatus;

    if (
      mergedSources.length === existingSources.length &&
      nextConfidence === existing.confidenceStatus &&
      article.summary === existing.summary
    ) {
      return 'duplicate';
    }

    db.prepare(`
      UPDATE news_articles
      SET summary = ?, whyItMatters = ?, sourceLinks = ?, confidenceStatus = ?, crossCheckCount = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      article.summary || existing.summary,
      article.whyItMatters || existing.whyItMatters,
      JSON.stringify(mergedSources),
      nextConfidence,
      nextCrossCount,
      now,
      existing.id
    );
    return 'updated';
  }

  const id = `news-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const sources = Array.isArray(article.sourceLinks) ? article.sourceLinks : [];
  db.prepare(`
    INSERT INTO news_articles (
      id, headline, category, summary, whyItMatters, publishedAt, eventTime,
      sourceLinks, confidenceStatus, crossCheckCount, contentHash, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    cleanHeadline.slice(0, 240),
    article.category || 'Major Breaking News',
    String(article.summary || '').slice(0, 1200),
    String(article.whyItMatters || '').slice(0, 600),
    article.publishedAt || now,
    article.eventTime || article.publishedAt || now,
    JSON.stringify(sources),
    article.confidenceStatus || (sources.length >= 2 ? 'CONFIRMED' : 'DEVELOPING'),
    Math.max(1, Number(article.crossCheckCount || sources.length || 1)),
    contentHash,
    now,
    now
  );
  return 'added';
}

export function listNewsArticles(filters?: { category?: string; query?: string; limit?: number }) {
  let sql = 'SELECT * FROM news_articles WHERE 1=1';
  const params: any[] = [];
  if (filters?.category && filters.category !== 'All') {
    sql += ' AND category = ?';
    params.push(filters.category);
  }
  if (filters?.query && filters.query.trim()) {
    sql += ' AND (LOWER(headline) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(category) LIKE ?)';
    const q = `%${filters.query.trim().toLowerCase()}%`;
    params.push(q, q, q);
  }
  sql += ' ORDER BY publishedAt DESC, updatedAt DESC LIMIT ?';
  params.push(Math.min(100, Math.max(1, Number(filters?.limit || 40))));
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map((r) => ({
    id: r.id,
    headline: r.headline,
    category: r.category,
    summary: r.summary,
    whyItMatters: r.whyItMatters,
    publishedAt: r.publishedAt,
    eventTime: r.eventTime,
    sourceLinks: parseJsonSafe<{ title: string; url: string; publisher: string }[]>(r.sourceLinks, []),
    confidenceStatus: r.confidenceStatus,
    crossCheckCount: Number(r.crossCheckCount || 1),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

// ============================================================
// CAPABILITY GAPS & SELF-IMPROVEMENT BACKLOG DB HELPERS
// ============================================================

export function recordCapabilityGap(gap: {
  commandText: string;
  intent?: string;
  reason: string;
  category?: string;
}) {
  const cleanCmd = gap.commandText.trim().slice(0, 280);
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT * FROM capability_gaps WHERE LOWER(commandText) = LOWER(?) AND status = 'logged' LIMIT 1")
    .get(cleanCmd) as any;

  if (existing) {
    db.prepare('UPDATE capability_gaps SET occurrenceCount = occurrenceCount + 1, lastOccurredAt = ?, reason = ? WHERE id = ?')
      .run(now, gap.reason.slice(0, 300), existing.id);
    return { ...existing, occurrenceCount: Number(existing.occurrenceCount) + 1, lastOccurredAt: now };
  }

  const id = `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(`
    INSERT INTO capability_gaps (id, commandText, intent, reason, category, status, occurrenceCount, lastOccurredAt, createdAt)
    VALUES (?, ?, ?, ?, ?, 'logged', 1, ?, ?)
  `).run(
    id,
    cleanCmd,
    (gap.intent || '').slice(0, 160),
    gap.reason.slice(0, 300),
    gap.category || 'general',
    now,
    now
  );
  return { id, commandText: cleanCmd, intent: gap.intent || '', reason: gap.reason, category: gap.category || 'general', status: 'logged', occurrenceCount: 1, lastOccurredAt: now, createdAt: now };
}

export function listCapabilityGaps(limit: number = 40) {
  return db.prepare('SELECT * FROM capability_gaps ORDER BY occurrenceCount DESC, lastOccurredAt DESC LIMIT ?').all(limit);
}

export function listImprovementBacklog() {
  const rows = db.prepare('SELECT * FROM improvement_backlog ORDER BY updatedAt DESC').all() as any[];
  return rows.map((r) => ({
    ...r,
    dependencies: parseJsonSafe<string[]>(r.dependencies, []),
    requiresApproval: Boolean(r.requiresApproval),
  }));
}

export function upsertImprovementItem(item: {
  id?: string;
  proposedFeature: string;
  whyNeeded: string;
  expectedBenefit: string;
  difficulty: 'Low' | 'Medium' | 'High';
  dependencies?: string[];
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status?: 'Proposed' | 'Approved' | 'In Progress' | 'Completed' | 'Rejected';
  sourceType?: 'telemetry' | 'gap' | 'user_request' | 'system_audit';
  requiresApproval?: boolean;
}) {
  const now = new Date().toISOString();
  const cleanTitle = item.proposedFeature.trim();
  const existingByTitle = !item.id
    ? (db.prepare('SELECT id FROM improvement_backlog WHERE LOWER(proposedFeature) = LOWER(?) LIMIT 1').get(cleanTitle) as any)
    : null;
  const targetId = item.id || existingByTitle?.id || `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  db.prepare(`
    INSERT INTO improvement_backlog (
      id, proposedFeature, whyNeeded, expectedBenefit, difficulty, dependencies,
      priority, status, sourceType, requiresApproval, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      whyNeeded = excluded.whyNeeded,
      expectedBenefit = excluded.expectedBenefit,
      difficulty = excluded.difficulty,
      dependencies = excluded.dependencies,
      priority = excluded.priority,
      status = excluded.status,
      updatedAt = excluded.updatedAt
  `).run(
    targetId,
    cleanTitle.slice(0, 200),
    String(item.whyNeeded || '').slice(0, 600),
    String(item.expectedBenefit || '').slice(0, 500),
    item.difficulty || 'Medium',
    JSON.stringify(Array.isArray(item.dependencies) ? item.dependencies : []),
    item.priority || 'Medium',
    item.status || 'Proposed',
    item.sourceType || 'system_audit',
    item.requiresApproval === false ? 0 : 1,
    now,
    now
  );

  return { id: targetId, updatedAt: now };
}

export function updateImprovementStatus(id: string, status: 'Proposed' | 'Approved' | 'In Progress' | 'Completed' | 'Rejected') {
  const now = new Date().toISOString();
  const res = db.prepare('UPDATE improvement_backlog SET status = ?, updatedAt = ? WHERE id = ?').run(status, now, id);
  return res.changes > 0;
}

export default db;

