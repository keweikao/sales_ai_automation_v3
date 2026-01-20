/**
 * Google OAuth 2.0 Setup Script
 * 用於取得 Google Drive 和 Calendar 的 Refresh Token
 */

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"; // 桌面應用程式

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/calendar",
];

async function main() {
  console.log("🔐 Google OAuth 2.0 設定工具\n");

  // Step 1: 檢查環境變數
  if (!(CLIENT_ID && CLIENT_SECRET)) {
    console.error("❌ 缺少環境變數!");
    console.log("\n請先設定以下環境變數:");
    console.log("  GOOGLE_CLIENT_ID=your-client-id");
    console.log("  GOOGLE_CLIENT_SECRET=your-client-secret");
    console.log("\n如何取得這些憑證:");
    console.log("  1. 前往 https://console.cloud.google.com/");
    console.log("  2. 建立專案或選擇現有專案");
    console.log("  3. 啟用 Google Drive API 和 Google Calendar API");
    console.log("  4. 建立 OAuth 2.0 憑證 (應用程式類型: 桌面應用程式)");
    console.log("  5. 下載憑證並設定環境變數\n");
    process.exit(1);
  }

  // Step 2: 取得授權碼
  const authCode = process.argv[2];

  if (!authCode) {
    // 顯示授權 URL
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(
      {
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent",
      }
    )}`;

    console.log("📋 步驟 1: 授權應用程式\n");
    console.log("請在瀏覽器中開啟以下 URL 並授權:");
    console.log("\n" + "=".repeat(80));
    console.log(authUrl);
    console.log("=".repeat(80) + "\n");

    console.log("📋 步驟 2: 複製授權碼\n");
    console.log("授權後,您會看到一個授權碼,請複製它\n");

    console.log("📋 步驟 3: 執行以下命令取得 Refresh Token:\n");
    console.log("  bun run scripts/setup-google-oauth.ts <YOUR_AUTH_CODE>\n");

    console.log("範例:");
    console.log(
      "  bun run scripts/setup-google-oauth.ts 4/0AY0e-g7xxxxxxxxxxxxxxxxxxxxx\n"
    );

    return;
  }

  // Step 3: 使用授權碼換取 Refresh Token
  console.log("🔄 正在交換 Refresh Token...\n");

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: authCode,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ 取得 Token 失敗:");
      console.error(error);
      console.log("\n請確認:");
      console.log("  1. 授權碼是否正確 (未過期)");
      console.log("  2. CLIENT_ID 和 CLIENT_SECRET 是否正確");
      console.log("  3. 授權碼只能使用一次,請重新取得\n");
      process.exit(1);
    }

    const tokens = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
      token_type: string;
    };

    console.log("✅ 成功取得 Refresh Token!\n");
    console.log("=" + "=".repeat(79));
    console.log("GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("=" + "=".repeat(79) + "\n");

    console.log("📝 下一步:\n");
    console.log("1. 將上述 GOOGLE_REFRESH_TOKEN 加入到 .env 檔案:");
    console.log("\n   .env:");
    console.log(`   GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`   GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`   GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    console.log("2. 測試連線:");
    console.log("   bun run scripts/test-google-integration.ts\n");

    // 測試 Access Token
    console.log("🧪 測試 Access Token...\n");

    const testResponse = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=user",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    if (testResponse.ok) {
      const userInfo = (await testResponse.json()) as {
        user: { displayName: string; emailAddress: string };
      };
      console.log("✅ Drive API 連線成功!");
      console.log(`   使用者: ${userInfo.user.displayName}`);
      console.log(`   Email: ${userInfo.user.emailAddress}\n`);
    } else {
      console.log("⚠️  Drive API 測試失敗,但 Refresh Token 已取得\n");
    }

    console.log("🎉 Google OAuth 設定完成!");
  } catch (error) {
    console.error("❌ 錯誤:", error);
    process.exit(1);
  }
}

main();
