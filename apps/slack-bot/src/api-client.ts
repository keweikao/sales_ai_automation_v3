import type {
  AlertResponse,
  AlertStatsResponse,
  ConversationResponse,
  ConversationType,
  DashboardStatsResponse,
  MeddicAnalysisResponse,
  MeddicTrendsResponse,
  OpportunityResponse,
  OpportunityStatsResponse,
  TalkTrackResponse,
  UploadConversationResponse,
} from "./types";

/**
 * 內部 API 客戶端
 * 用於從 Slack Bot 呼叫主要的 oRPC API
 */
export class ApiClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // 移除尾部斜線
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  // Opportunity 相關 API
  async getOpportunities(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ opportunities: OpportunityResponse[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.status) {
      searchParams.set("status", params.status);
    }
    if (params?.limit) {
      searchParams.set("limit", String(params.limit));
    }
    if (params?.offset) {
      searchParams.set("offset", String(params.offset));
    }

    const query = searchParams.toString();
    return this.request(`/api/opportunities.list${query ? `?${query}` : ""}`);
  }

  async getOpportunityById(id: string): Promise<OpportunityResponse | null> {
    try {
      const result = await this.request<{ opportunity: OpportunityResponse }>(
        `/api/opportunities.get?opportunityId=${encodeURIComponent(id)}`
      );
      return result.opportunity;
    } catch {
      return null;
    }
  }

  async createOpportunity(data: {
    customerNumber: string;
    companyName: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    source?: string;
    status?: string;
    industry?: string;
    companySize?: string;
    notes?: string;
  }): Promise<OpportunityResponse> {
    return this.request<OpportunityResponse>("/api/opportunities.create", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Conversation 相關 API
  async getConversations(params?: {
    opportunityId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ conversations: ConversationResponse[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.opportunityId) {
      searchParams.set("opportunityId", params.opportunityId);
    }
    if (params?.status) {
      searchParams.set("status", params.status);
    }
    if (params?.limit) {
      searchParams.set("limit", String(params.limit));
    }
    if (params?.offset) {
      searchParams.set("offset", String(params.offset));
    }

    const query = searchParams.toString();
    return this.request(`/api/conversations.list${query ? `?${query}` : ""}`);
  }

  async getConversationById(id: string): Promise<ConversationResponse | null> {
    try {
      const result = await this.request<{ conversation: ConversationResponse }>(
        `/api/conversations.get?conversationId=${encodeURIComponent(id)}`
      );
      return result.conversation;
    } catch {
      return null;
    }
  }

  async uploadConversation(data: {
    opportunityId: string;
    audioBase64: string;
    title?: string;
    type: ConversationType;
    metadata?: {
      format?: string;
      conversationDate?: string;
    };
    slackUser?: {
      id: string;
      username: string;
    };
  }): Promise<UploadConversationResponse> {
    return this.request<UploadConversationResponse>(
      "/api/conversations.upload",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }

  async analyzeConversation(id: string): Promise<MeddicAnalysisResponse> {
    return this.request<MeddicAnalysisResponse>("/api/conversations.analyze", {
      method: "POST",
      body: JSON.stringify({ conversationId: id }),
    });
  }

  async updateConversationSummary(
    conversationId: string,
    summary: string
  ): Promise<void> {
    await this.request("/api/conversations.updateSummary", {
      method: "POST",
      body: JSON.stringify({ conversationId, summary }),
    });
  }

  // Analytics 相關 API
  async getDashboard(): Promise<DashboardStatsResponse> {
    return this.request<DashboardStatsResponse>("/api/analytics.dashboard");
  }

  async getOpportunityStats(): Promise<OpportunityStatsResponse> {
    return this.request<OpportunityStatsResponse>(
      "/api/analytics.opportunityStats"
    );
  }

  async getMeddicTrends(): Promise<MeddicTrendsResponse> {
    return this.request<MeddicTrendsResponse>("/api/analytics.meddicTrends");
  }

  // Alert 相關 API
  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.request("/api/alert.acknowledge", {
      method: "POST",
      body: JSON.stringify({ alertId }),
    });
  }

  async dismissAlert(alertId: string): Promise<void> {
    await this.request("/api/alert.dismiss", {
      method: "POST",
      body: JSON.stringify({ alertId }),
    });
  }

  async resolveAlert(alertId: string, resolution: string): Promise<void> {
    await this.request("/api/alert.resolve", {
      method: "POST",
      body: JSON.stringify({ alertId, resolution }),
    });
  }

  async getAlerts(params?: {
    status?: string;
    type?: string;
    opportunityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: AlertResponse[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.type) searchParams.set("type", params.type);
    if (params?.opportunityId)
      searchParams.set("opportunityId", params.opportunityId);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));

    const query = searchParams.toString();
    return this.request(`/api/alert.list${query ? `?${query}` : ""}`);
  }

  async getAlertStats(): Promise<AlertStatsResponse> {
    return this.request<AlertStatsResponse>("/api/alert.stats");
  }

  // Talk Track 相關 API
  async getTalkTracksBySituation(
    situation: string,
    customerType?: string
  ): Promise<TalkTrackResponse[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("situation", situation);
    if (customerType) {
      searchParams.set("customerType", customerType);
    }
    return this.request<TalkTrackResponse[]>(
      `/api/talkTracks.getBySituation?${searchParams.toString()}`
    );
  }

  async searchTalkTracks(
    keyword: string,
    limit = 5
  ): Promise<TalkTrackResponse[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("keyword", keyword);
    searchParams.set("limit", String(limit));
    return this.request<TalkTrackResponse[]>(
      `/api/talkTracks.search?${searchParams.toString()}`
    );
  }

  async recordTalkTrackUsage(talkTrackId: string): Promise<void> {
    await this.request("/api/talkTracks.recordUsage", {
      method: "POST",
      body: JSON.stringify({ talkTrackId }),
    });
  }
}
