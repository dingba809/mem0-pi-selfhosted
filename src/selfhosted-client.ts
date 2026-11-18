export interface SelfHostedClientOptions {
  apiKey: string;
  baseUrl: string;
}

export interface SearchOptions {
  filters?: Record<string, string>;
  threshold?: number;
  topK?: number;
  rerank?: boolean;
  source?: string;
}

export interface AddOptions {
  userId?: string;
  appId?: string;
  agentId?: string;
  runId?: string;
  infer?: boolean;
  customCategories?: unknown;
  source?: string;
}

export interface MemoryItem {
  id: string;
  memory?: string;
  user_id?: string | null;
  agent_id?: string | null;
  run_id?: string | null;
  categories?: string[];
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  score?: number;
  metadata?: Record<string, unknown>;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const WRITE_TIMEOUT_MS = 60_000;

function mapFilters(filters?: Record<string, string>): Record<string, string> {
  if (!filters) return {};
  const mapped: Record<string, string> = {};
  if (filters.user_id) mapped.user_id = filters.user_id;
  if (filters.agent_id || filters.app_id) mapped.agent_id = filters.agent_id ?? filters.app_id;
  if (filters.run_id) mapped.run_id = filters.run_id;
  return mapped;
}

function mapEntityParams(params: Record<string, string | undefined>): Record<string, string> {
  const mapped: Record<string, string> = {};
  const userId = params.userId ?? params.user_id;
  const agentId = params.agentId ?? params.agent_id ?? params.appId ?? params.app_id;
  const runId = params.runId ?? params.run_id;
  if (userId) mapped.user_id = userId;
  if (agentId) mapped.agent_id = agentId;
  if (runId) mapped.run_id = runId;
  return mapped;
}

function normalizeMemory(item: MemoryItem): MemoryItem {
  const metaCats = Array.isArray(item.metadata?.categories)
    ? (item.metadata.categories as string[])
    : undefined;
  return {
    ...item,
    createdAt: item.createdAt ?? item.created_at ?? undefined,
    categories: item.categories ?? metaCats,
  };
}

export class SelfHostedMem0Client {
  readonly apiKey: string;
  readonly baseUrl: string;

  constructor(options: SelfHostedClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new Error("Mem0 API key is required");
    }
    if (!options.baseUrl?.trim()) {
      throw new Error("Mem0 baseUrl is required");
    }
    this.apiKey = options.apiKey.trim();
    this.baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Mem0 API ${response.status}: ${detail || response.statusText}`);
    }
    return (await response.json()) as T;
  }

  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<{ results: MemoryItem[] }> {
    const body: Record<string, unknown> = {
      query,
      filters: mapFilters(options.filters),
    };
    if (options.topK != null) body.top_k = options.topK;
    if (options.threshold != null) body.threshold = options.threshold;

    const data = await this.request<{ results?: MemoryItem[] }>("/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      results: (data.results ?? []).map(normalizeMemory),
    };
  }

  async add(
    messages: Array<{ role: string; content: string }>,
    options: AddOptions = {},
  ): Promise<{ results: MemoryItem[]; message: string }> {
    const entities = mapEntityParams(options as Record<string, string | undefined>);
    const body: Record<string, unknown> = {
      messages,
      ...entities,
    };
    if (options.infer !== undefined) body.infer = options.infer;

    const data = await this.request<{ results?: MemoryItem[] }>("/memories", {
      method: "POST",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });
    const results = (data.results ?? []).map(normalizeMemory);
    return {
      results,
      message: results.length > 0 ? `Stored ${results.length} memory item(s).` : "Memory stored.",
    };
  }

  async getAll(options: { filters?: Record<string, string> } = {}): Promise<{
    results: MemoryItem[];
    count: number;
  }> {
    const qs = new URLSearchParams(mapFilters(options.filters)).toString();
    const path = qs ? `/memories?${qs}` : "/memories";
    const data = await this.request<{ results?: MemoryItem[] }>(path, {
      method: "GET",
    });
    const results = (data.results ?? []).map(normalizeMemory);
    return { results, count: results.length };
  }

  async update(memoryId: string, body: { text: string }): Promise<{ status: string }> {
    await this.request(`/memories/${encodeURIComponent(memoryId)}`, {
      method: "PUT",
      body: JSON.stringify({ text: body.text }),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });
    return { status: "Memory updated." };
  }

  async delete(memoryId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/memories/${encodeURIComponent(memoryId)}`,
      { method: "DELETE" },
    );
  }

  async deleteAll(params: Record<string, string | undefined>): Promise<{ message: string }> {
    const qs = new URLSearchParams(mapEntityParams(params)).toString();
    if (!qs) {
      throw new Error("At least one scope identifier is required for deleteAll");
    }
    return this.request<{ message: string }>(`/memories?${qs}`, {
      method: "DELETE",
    });
  }
}
