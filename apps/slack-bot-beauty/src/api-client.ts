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

    // oRPC 需要將 body 包裝在 {"json": ...} 中
    let body = options.body;
    if (body && typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        body = JSON.stringify({ json: parsed });
      } catch {
        // 如果解析失敗，保持原樣
      }
    }

    const response = await fetch(url, {
      ...options,
      method: options.method || "POST", // oRPC 所有端點都使用 POST
      headers,
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    // oRPC 響應格式為 {"json": data, "meta": [...]}
    const result = (await response.json()) as { json?: T };
    return (result.json ?? result) as T;
  }

  // Opportunity 相關 API
  async getOpportunities(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ opportunities: OpportunityResponse[]; total: number }> {
    return this.request("/rpc/opportunities/list", {
      body: JSON.stringify(params || {}),
    });
  }

  async getOpportunityById(id: string): Promise<OpportunityResponse | null> {
    try {
      const result = await this.request<{ opportunity: OpportunityResponse }>(
        "/rpc/opportunities/get",
        {
          body: JSON.stringify({ opportunityId: id }),
        }
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
    return this.request<OpportunityResponse>("/rpc/opportunities/create", {
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
    return this.request("/rpc/conversations/list", {
      body: JSON.stringify(params || {}),
    });
  }

  async getConversationById(id: string): Promise<ConversationResponse | null> {
    try {
      const result = await this.request<{ conversation: ConversationResponse }>(
        "/rpc/conversations/get",
        {
          body: JSON.stringify({ conversationId: id }),
        }
      );
      return result.conversation;
    } catch {
      return null;
    }
  }

  async uploadConversation(data: {
    opportunityId: string;
    audioBase64?: string;
    slackFileUrl?: string;
    slackBotToken?: string;
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
      "/rpc/conversations/upload",
      {
        body: JSON.stringify(data),
      }
    );
  }

  async analyzeConversation(id: string): Promise<MeddicAnalysisResponse> {
    return this.request<MeddicAnalysisResponse>("/rpc/conversations/analyze", {
      body: JSON.stringify({ conversationId: id }),
    });
  }

  async updateConversationSummary(
    conversationId: string,
    summary: string
  ): Promise<void> {
    await this.request("/rpc/conversations/updateSummary", {
      body: JSON.stringify({ conversationId, summary }),
    });
  }

  // Analytics 相關 API
  async getDashboard(): Promise<DashboardStatsResponse> {
    return this.request<DashboardStatsResponse>("/rpc/analytics/dashboard");
  }

  async getOpportunityStats(): Promise<OpportunityStatsResponse> {
    return this.request<OpportunityStatsResponse>(
      "/rpc/analytics/opportunityStats"
    );
  }

  async getMeddicTrends(): Promise<MeddicTrendsResponse> {
    return this.request<MeddicTrendsResponse>("/rpc/analytics/meddicTrends");
  }

  // Alert 相關 API
  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.request("/rpc/alert/acknowledge", {
      body: JSON.stringify({ alertId }),
    });
  }

  async dismissAlert(alertId: string): Promise<void> {
    await this.request("/rpc/alert/dismiss", {
      body: JSON.stringify({ alertId }),
    });
  }

  async resolveAlert(alertId: string, resolution: string): Promise<void> {
    await this.request("/rpc/alert/resolve", {
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
    return this.request("/rpc/alert/list", {
      body: JSON.stringify(params || {}),
    });
  }

  async getAlertStats(): Promise<AlertStatsResponse> {
    return this.request<AlertStatsResponse>("/rpc/alert/stats");
  }

  // Talk Track 相關 API
  async getTalkTracksBySituation(
    situation: string,
    customerType?: string
  ): Promise<TalkTrackResponse[]> {
    return this.request<TalkTrackResponse[]>("/rpc/talkTracks/getBySituation", {
      body: JSON.stringify({ situation, customerType }),
    });
  }

  async searchTalkTracks(
    keyword: string,
    limit = 5
  ): Promise<TalkTrackResponse[]> {
    return this.request<TalkTrackResponse[]>("/rpc/talkTracks/search", {
      body: JSON.stringify({ keyword, limit }),
    });
  }

  async recordTalkTrackUsage(talkTrackId: string): Promise<void> {
    await this.request("/rpc/talkTracks/recordUsage", {
      body: JSON.stringify({ talkTrackId }),
    });
  }
}
