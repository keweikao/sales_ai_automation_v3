/**
 * Talk Tracks Seed Data
 * 15 組預設話術模板（5 情境 × 3 客戶類型）
 */

import type { NewTalkTrack } from "../schema/talk-tracks";

function generateId(situation: string, customerType: string): string {
  const situationMap: Record<string, string> = {
    價格異議: "price",
    需要老闆決定: "boss",
    擔心轉換麻煩: "switch",
    已有其他系統: "competitor",
    要再考慮: "think",
  };
  const customerMap: Record<string, string> = {
    衝動型: "impulsive",
    精算型: "analytical",
    保守觀望型: "conservative",
  };
  return `tt_${situationMap[situation]}_${customerMap[customerType]}`;
}

export const talkTracksSeedData: NewTalkTrack[] = [
  // ========================================
  // 價格異議
  // ========================================
  {
    id: generateId("價格異議", "衝動型"),
    situation: "價格異議",
    customerType: "衝動型",
    storeType: null,
    talkTrack: `老闆，我理解您的考量。不過很多老闆一開始也這樣想，結果用了之後發現省下的時間和人力成本，其實很快就回本了。

現在加入的話，我們有限時優惠方案，而且可以先試用看看效果。
反正不滿意隨時可以停，但如果等到旺季才來導入，到時候會更忙、更沒時間處理。

不如趁現在比較有空的時候先上線，讓員工熟悉操作？`,
    context:
      "客戶說「太貴了」、「月費太高」時使用。衝動型客戶需要強調「現在行動」的好處。",
    expectedOutcome: "創造緊迫感，讓客戶願意先試用",
    sourceType: "expert",
    successRate: 65,
    usageCount: 0,
    tags: ["價格", "限時優惠", "試用"],
  },
  {
    id: generateId("價格異議", "精算型"),
    situation: "價格異議",
    customerType: "精算型",
    storeType: null,
    talkTrack: `王老闆，我完全理解您對成本的重視。讓我們一起算一筆帳：

假設每天省下 30 分鐘手寫單據和對帳時間，一個月就是 15 小時。
以您店內時薪 180 元計算，每月節省 2,700 元人力成本。
系統月費才 1,500 元，等於第一個月就開始淨賺 1,200 元。

而且這還沒算到：減少算錯帳、漏單的損失，以及庫存管理省下的食材浪費。
很多精打細算的老闆跟我說，這是他們回本最快的投資之一。

您覺得這樣的投報率如何？`,
    context:
      "客戶說「月費太貴」、「成本考量」、「要算一下」時使用。精算型客戶需要具體數字和 ROI 計算。",
    expectedOutcome: "將「費用」轉換為「投資回報」的討論，用數字說服",
    sourceType: "expert",
    successRate: 75,
    usageCount: 0,
    tags: ["價格", "ROI", "數字", "成本計算"],
  },
  {
    id: generateId("價格異議", "保守觀望型"),
    situation: "價格異議",
    customerType: "保守觀望型",
    storeType: null,
    talkTrack: `老闆，您的謹慎我很理解，畢竟開店的錢都是辛苦賺來的。

很多跟您一樣規模的店家，一開始也覺得月費是額外支出。
但實際使用後發現，光是減少人工出錯和加快結帳速度，每個月省下的遠超過月費。

這樣好了，我們有 14 天免費試用，您可以先體驗看看實際效果。
試用期間我會協助您做完整設定，讓您真正感受到效益再決定。
這樣您覺得如何？`,
    context:
      "客戶說「再看看」、「要考慮一下費用」時使用。保守型客戶需要降低風險感、提供社會證明。",
    expectedOutcome: "用「免費試用」降低風險，用「同類店家」建立信任",
    sourceType: "expert",
    successRate: 60,
    usageCount: 0,
    tags: ["價格", "試用", "風險降低", "社會證明"],
  },

  // ========================================
  // 需要老闆決定
  // ========================================
  {
    id: generateId("需要老闆決定", "衝動型"),
    situation: "需要老闆決定",
    customerType: "衝動型",
    storeType: null,
    talkTrack: `沒問題！老闆什麼時候會來店裡呢？

我可以直接跟老闆說明，這樣比較快。
而且我們現在有優惠方案，這週決定的話可以享有特別折扣。

或者這樣，您先幫我跟老闆說一聲，我明天打電話給老闆直接說明，您看這樣方便嗎？`,
    context: "店員說「要問老闆」時使用。衝動型場景要快速推進到決策者。",
    expectedOutcome: "快速接觸到真正決策者，避免訊息在中間流失",
    sourceType: "expert",
    successRate: 55,
    usageCount: 0,
    tags: ["決策者", "老闆", "約訪"],
  },
  {
    id: generateId("需要老闆決定", "精算型"),
    situation: "需要老闆決定",
    customerType: "精算型",
    storeType: null,
    talkTrack: `完全理解，這種決定確實需要老闆來評估。

請問老闆平常最關心店裡哪些數字？是營業額、人事成本、還是食材損耗？

[等客戶回答後]

這樣好了，我幫您準備一份簡報，針對老闆最在意的這幾點，用實際數據說明系統能帶來什麼改善。
包括同類型店家的實際案例和數據，這樣您跟老闆報告的時候也比較有底。

我可以把資料寄給您，還是約個時間我直接跟老闆說明？`,
    context:
      "員工或店長說「我做不了主」、「要問老闆」時使用。精算型要準備數據支持的說帖。",
    expectedOutcome: "協助對方準備說服素材，創造接觸決策者的機會",
    sourceType: "expert",
    successRate: 70,
    usageCount: 0,
    tags: ["決策者", "老闆", "簡報", "數據"],
  },
  {
    id: generateId("需要老闆決定", "保守觀望型"),
    situation: "需要老闆決定",
    customerType: "保守觀望型",
    storeType: null,
    talkTrack: `沒問題，重大決定當然要跟老闆討論，這很正常。

不過我想請教一下，您覺得老闆最可能擔心什麼？是費用、還是怕麻煩、或是擔心員工不會用？

[等客戶回答後]

了解了。其實這些擔心很多老闆都有，我可以分享一些其他店家的經驗給您參考。

這樣好了，我準備一份「老闆最常問的問題」整理給您，裡面有完整解答。
您跟老闆討論的時候如果有任何問題，也可以隨時 LINE 我，我來幫您解答。`,
    context:
      "員工謹慎地說「要問老闆意見」時使用。保守型要預先處理可能的反對意見。",
    expectedOutcome: "預判老闆的顧慮，提供對應的解答材料",
    sourceType: "expert",
    successRate: 58,
    usageCount: 0,
    tags: ["決策者", "老闆", "FAQ", "支援"],
  },

  // ========================================
  // 擔心轉換麻煩
  // ========================================
  {
    id: generateId("擔心轉換麻煩", "衝動型"),
    situation: "擔心轉換麻煩",
    customerType: "衝動型",
    storeType: null,
    talkTrack: `老闆您放心，我們的系統是出了名的好上手！

很多老闆跟我說，員工大概半天就學會了，比他們想像中簡單很多。
而且我們有專人協助設定，菜單、價格這些我都幫您弄好。

您只要告訴我菜單內容，其他交給我就好。
最快的話，今天談完、明天就可以開始用了！`,
    context:
      "客戶說「換系統很麻煩」、「員工要重新學」時使用。衝動型要強調簡單和快速。",
    expectedOutcome: "消除「麻煩」的印象，強調簡單易用",
    sourceType: "expert",
    successRate: 62,
    usageCount: 0,
    tags: ["轉換", "簡單", "設定", "培訓"],
  },
  {
    id: generateId("擔心轉換麻煩", "精算型"),
    situation: "擔心轉換麻煩",
    customerType: "精算型",
    storeType: null,
    talkTrack: `老闆，您的擔心我完全理解。讓我說明一下我們的導入流程：

第一步：我會先到店裡了解您目前的作業方式，大約 30 分鐘
第二步：我幫您把菜單、價格都設定好，這個您不用操心
第三步：安排 1-2 小時的員工培訓，通常一次就學會
第四步：上線第一週我會每天關心使用狀況，有問題隨時處理

整個過程大約 3-5 天，不會影響您正常營業。
而且根據我們的統計，95% 的店家在第一週就能順利上手。

您看這樣的安排可以嗎？`,
    context:
      "客戶擔心導入過程複雜、影響營業時使用。精算型需要清楚的步驟和時程。",
    expectedOutcome: "用具體步驟和數據消除「不確定」的焦慮",
    sourceType: "expert",
    successRate: 72,
    usageCount: 0,
    tags: ["轉換", "流程", "時程", "培訓"],
  },
  {
    id: generateId("擔心轉換麻煩", "保守觀望型"),
    situation: "擔心轉換麻煩",
    customerType: "保守觀望型",
    storeType: null,
    talkTrack: `老闆，您的擔心很正常，畢竟換系統確實需要適應期。

我跟您分享一個案例：附近那家 XX 咖啡廳，老闆一開始也很擔心員工不會用。
結果我們到店培訓完，當天下午員工就上手了。
老闆後來跟我說，早知道這麼簡單，應該更早換。

我們這樣好了：
1. 先讓您試用看看介面，感受一下操作方式
2. 我可以先用您的菜單做一個 Demo，讓您看看實際畫面
3. 確定要用再正式導入，中間有任何問題我都在

這樣您比較放心，好嗎？`,
    context:
      "客戶說「怕員工不適應」、「現在這樣也還好」時使用。保守型需要案例和漸進式承諾。",
    expectedOutcome: "用實際案例消除疑慮，提供漸進式的體驗方式",
    sourceType: "expert",
    successRate: 65,
    usageCount: 0,
    tags: ["轉換", "案例", "Demo", "漸進"],
  },

  // ========================================
  // 已有其他系統
  // ========================================
  {
    id: generateId("已有其他系統", "衝動型"),
    situation: "已有其他系統",
    customerType: "衝動型",
    storeType: null,
    talkTrack: `原來老闆已經有在用系統了！請問是用哪一家呢？

[等客戶回答後]

了解！那個系統確實也不錯。不過很多從 XX 轉過來的老闆跟我說，
我們在 [報表功能/操作速度/客服支援] 這塊做得更好。

這樣好了，反正比較一下也不吃虧，我 Demo 給您看，您覺得沒有比較好就算了。
說不定您會發現有些功能是您現在缺少的呢？`,
    context: "客戶說「我們已經用 XX 了」時使用。衝動型可以直接挑戰比較。",
    expectedOutcome: "創造比較的機會，突顯差異化優勢",
    sourceType: "expert",
    successRate: 50,
    usageCount: 0,
    tags: ["競品", "比較", "Demo"],
  },
  {
    id: generateId("已有其他系統", "精算型"),
    situation: "已有其他系統",
    customerType: "精算型",
    storeType: null,
    talkTrack: `了解，請問您目前用的是哪一家呢？用了大概多久了？

[等客戶回答後]

那您目前使用上有沒有覺得哪些功能不太夠用，或是希望可以改善的地方？

[等客戶回答後]

您提到的這幾點，其實正好是我們的強項。讓我具體說明一下差異：

1. [針對客戶提到的痛點說明優勢]
2. [提供具體的功能比較]
3. [如果可以，提供轉換成本和效益分析]

您要不要我做一份詳細的比較表給您參考？`,
    context: "客戶已有系統時使用。精算型需要具體的功能比較和效益分析。",
    expectedOutcome: "找出現有系統的痛點，用數據呈現差異",
    sourceType: "expert",
    successRate: 68,
    usageCount: 0,
    tags: ["競品", "比較", "痛點", "分析"],
  },
  {
    id: generateId("已有其他系統", "保守觀望型"),
    situation: "已有其他系統",
    customerType: "保守觀望型",
    storeType: null,
    talkTrack: `了解，您已經有在用系統了，那確實要換需要考慮比較多。

我可以請教一下，當初為什麼選擇現在這套系統呢？用到現在覺得如何？

[等客戶回答後]

嗯，聽起來 [正面回饋]。不過我想跟您分享一些其他老闆轉過來的原因：

[分享 1-2 個從競品轉換的成功案例]

我不是說您現在的系統不好，只是想讓您知道還有其他選擇。
如果您哪天覺得想比較看看，隨時可以找我，我很樂意 Demo 給您看。
先加個 LINE 保持聯繫？`,
    context:
      "客戶說「現在這套還能用」、「沒想過要換」時使用。保守型需要時間和案例鋪墊。",
    expectedOutcome: "不強推，但保持聯繫，種下轉換的種子",
    sourceType: "expert",
    successRate: 45,
    usageCount: 0,
    tags: ["競品", "案例", "長期經營", "聯繫"],
  },

  // ========================================
  // 要再考慮
  // ========================================
  {
    id: generateId("要再考慮", "衝動型"),
    situation: "要再考慮",
    customerType: "衝動型",
    storeType: null,
    talkTrack: `好的老闆，考慮是應該的。不過我想請教一下，您主要是在考慮哪方面呢？

是價格、功能、還是時機的問題？

[等客戶回答後]

了解了！關於這點，[針對性回應]

老闆，我跟您說實話，很多老闆說要考慮，後來就忘了這件事。
然後等到旺季來、或是遇到問題的時候才想起來，那時候就更沒時間處理。

不如這樣，我們現在有優惠，您今天先把握，有問題隨時可以找我處理。
您覺得呢？`,
    context:
      "客戶說「讓我想想」、「考慮一下」時使用。衝動型要找出真正猶豫的原因並即時解決。",
    expectedOutcome: "挖出真正的顧慮，創造行動的急迫性",
    sourceType: "expert",
    successRate: 55,
    usageCount: 0,
    tags: ["考慮", "猶豫", "急迫性", "優惠"],
  },
  {
    id: generateId("要再考慮", "精算型"),
    situation: "要再考慮",
    customerType: "精算型",
    storeType: null,
    talkTrack: `沒問題，仔細考慮是對的。我可以請教一下，您打算怎麼評估呢？

會跟其他系統比較嗎？還是要算一下預算？或是要問問其他同行的意見？

[等客戶回答後]

了解。那我提供一些資料給您參考：

1. 這是我們跟市面上主要競品的功能比較表
2. 這是投資回報計算的試算表，您可以填入您店裡的數字
3. 這是幾位同類型店家老闆的使用心得

這些資料應該可以幫助您做評估。
您大概什麼時候會做決定呢？我 [X天後] 再跟您聯繫，看看有沒有問題需要解答？`,
    context:
      "客戶說「要研究一下」、「比較看看」時使用。精算型需要評估資料和明確的跟進時間。",
    expectedOutcome: "提供評估工具，約定具體的跟進時間點",
    sourceType: "expert",
    successRate: 70,
    usageCount: 0,
    tags: ["考慮", "比較", "資料", "跟進"],
  },
  {
    id: generateId("要再考慮", "保守觀望型"),
    situation: "要再考慮",
    customerType: "保守觀望型",
    storeType: null,
    talkTrack: `好的老闆，慢慢考慮沒關係，這種決定確實不用急。

方便問一下，您主要在考慮什麼嗎？我看看有沒有資料可以幫到您。

[等客戶回答後]

了解了。這樣好了，我不會一直打擾您，但我想留個聯繫方式。

之後如果您有任何問題，或是看到什麼想了解的功能，隨時可以問我。
我也會不定期分享一些店家經營的小技巧給您。

先加個 LINE 好嗎？這樣您想到什麼隨時可以問，不用特別打電話。`,
    context:
      "客戶說「再說」、「現在沒有急」時使用。保守型需要長期培養，不宜強推。",
    expectedOutcome: "不造成壓力，但保持聯繫管道，建立長期關係",
    sourceType: "expert",
    successRate: 50,
    usageCount: 0,
    tags: ["考慮", "長期", "聯繫", "培養"],
  },
];

/**
 * Seed talk tracks to database
 */
export async function seedTalkTracks(
  db: Parameters<typeof import("drizzle-orm")["sql"]>[0]
): Promise<void> {
  const { talkTracks } = await import("../schema/talk-tracks");

  for (const data of talkTracksSeedData) {
    await db.insert(talkTracks).values(data).onConflictDoNothing();
  }

  console.log(`Seeded ${talkTracksSeedData.length} talk tracks`);
}
