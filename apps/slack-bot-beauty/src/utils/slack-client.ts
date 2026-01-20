/**
 * Slack Web API 客戶端
 * 用於發送訊息和互動
 */

interface PostMessageOptions {
  channel: string;
  text?: string;
  blocks?: object[];
  thread_ts?: string;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

interface UpdateMessageOptions {
  channel: string;
  ts: string;
  text?: string;
  blocks?: object[];
}

interface ResponseUrlPayload {
  response_type?: "in_channel" | "ephemeral";
  replace_original?: boolean;
  delete_original?: boolean;
  text?: string;
  blocks?: object[];
}

interface FileInfoResponse {
  ok: boolean;
  file?: {
    id: string;
    name: string;
    mimetype: string;
    url_private_download: string;
    size: number;
  };
  error?: string;
}

export class SlackClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * 發送訊息到頻道
   */
  async postMessage(
    options: PostMessageOptions
  ): Promise<{ ok: boolean; ts?: string; error?: string }> {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
    });

    return response.json();
  }

  /**
   * 更新現有訊息
   */
  async updateMessage(
    options: UpdateMessageOptions
  ): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch("https://slack.com/api/chat.update", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
    });

    return response.json();
  }

  /**
   * 透過 response_url 回應（用於指令和互動）
   */
  async respondToUrl(
    responseUrl: string,
    payload: ResponseUrlPayload
  ): Promise<{ ok: boolean }> {
    const response = await fetch(responseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Failed to respond to URL:", await response.text());
      return { ok: false };
    }

    return { ok: true };
  }

  /**
   * 取得檔案資訊
   */
  async getFileInfo(fileId: string): Promise<FileInfoResponse> {
    const response = await fetch(
      `https://slack.com/api/files.info?file=${fileId}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    return response.json();
  }

  /**
   * 下載檔案
   */
  async downloadFile(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  /**
   * 開啟 Modal
   */
  async openView(
    triggerId: string,
    view: object
  ): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch("https://slack.com/api/views.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trigger_id: triggerId,
        view,
      }),
    });

    return response.json();
  }

  /**
   * 取得使用者資訊
   */
  async getUserInfo(userId: string): Promise<{
    ok: boolean;
    user?: { id: string; name: string; real_name?: string };
    error?: string;
  }> {
    const response = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    return response.json();
  }
}
