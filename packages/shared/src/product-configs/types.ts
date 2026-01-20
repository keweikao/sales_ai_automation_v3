/**
 * 產品線類型定義
 * 用於多產品線支援 (iCHEF + 美業)
 */

export type ProductLine = "ichef" | "beauty";

// 表單選項
export interface FormFieldOption {
  value: string;
  label: string;
  emoji?: string;
}

// 表單欄位配置
export interface FormFieldConfig {
  label: string;
  options: FormFieldOption[];
  required?: boolean;
}

// 表單欄位集合
export interface FormFieldsConfig {
  storeType: FormFieldConfig;
  serviceType?: FormFieldConfig; // iCHEF only
  staffCount?: FormFieldConfig; // Beauty only
  currentSystem: FormFieldConfig;
}

// 承諾事件 (Commitment Events)
export interface CommitmentEvent {
  id: "CE1" | "CE2" | "CE3";
  name: string;
  definition: string;
}

// 提示詞配置
export interface PromptsConfig {
  globalContext: string;
  productContext: string;
  commitmentEvents: CommitmentEvent[];
  demoMetaFields: string[];
}

// 話術情境
export interface TalkTrackSituation {
  id: string;
  name: string;
  description: string;
}

// 話術配置
export interface TalkTracksConfig {
  situations: TalkTrackSituation[];
}

// 完整產品線配置
export interface ProductLineConfig {
  id: ProductLine;
  name: string;
  displayName: string;
  formFields: FormFieldsConfig;
  prompts: PromptsConfig;
  talkTracks: TalkTracksConfig;
}
