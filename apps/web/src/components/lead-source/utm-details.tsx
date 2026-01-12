/**
 * UTM Details Card Component
 * 顯示 UTM 參數詳情
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Megaphone,
  Target,
  Search,
  FileText,
  ExternalLink,
} from "lucide-react";

interface UTMParams {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
}

interface UTMDetailsProps {
  utm: UTMParams;
  landingPage?: string | null;
  referrer?: string | null;
  firstTouchAt?: Date | string | null;
  compact?: boolean;
}

const UTM_ITEMS = [
  { key: "utmSource", label: "來源", icon: Globe, color: "blue" },
  { key: "utmMedium", label: "媒介", icon: Megaphone, color: "green" },
  { key: "utmCampaign", label: "活動", icon: Target, color: "purple" },
  { key: "utmTerm", label: "關鍵字", icon: Search, color: "orange" },
  { key: "utmContent", label: "內容", icon: FileText, color: "gray" },
] as const;

export function UTMDetails({
  utm,
  landingPage,
  referrer,
  firstTouchAt,
  compact = false,
}: UTMDetailsProps) {
  const hasAnyUTM = Object.values(utm).some((v) => v);

  if (!hasAnyUTM && !landingPage && !referrer) {
    return (
      <div className="text-muted-foreground text-sm">
        無 UTM 追蹤資料
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {utm.utmSource && (
          <Badge variant="outline" className="text-xs">
            <Globe className="mr-1 h-3 w-3" />
            {utm.utmSource}
          </Badge>
        )}
        {utm.utmMedium && (
          <Badge variant="outline" className="text-xs">
            <Megaphone className="mr-1 h-3 w-3" />
            {utm.utmMedium}
          </Badge>
        )}
        {utm.utmCampaign && (
          <Badge variant="outline" className="text-xs">
            <Target className="mr-1 h-3 w-3" />
            {utm.utmCampaign}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">UTM 追蹤資訊</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* UTM 參數 */}
        <div className="grid gap-3">
          {UTM_ITEMS.map(({ key, label, icon: Icon, color }) => {
            const value = utm[key];
            if (!value) return null;

            return (
              <div key={key} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-md bg-${color}-500/10`}
                >
                  <Icon className={`h-4 w-4 text-${color}-600`} />
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">{label}</div>
                  <div className="text-sm font-medium">{value}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Landing Page */}
        {landingPage && (
          <div className="border-t pt-3">
            <div className="text-muted-foreground text-xs mb-1">著陸頁面</div>
            <div className="flex items-center gap-1 text-sm">
              <span className="truncate max-w-[200px]">{landingPage}</span>
              <a
                href={landingPage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Referrer */}
        {referrer && (
          <div className="border-t pt-3">
            <div className="text-muted-foreground text-xs mb-1">來源網站</div>
            <div className="text-sm truncate">{referrer}</div>
          </div>
        )}

        {/* First Touch */}
        {firstTouchAt && (
          <div className="border-t pt-3">
            <div className="text-muted-foreground text-xs mb-1">首次接觸</div>
            <div className="text-sm">
              {typeof firstTouchAt === "string"
                ? new Date(firstTouchAt).toLocaleString("zh-TW")
                : firstTouchAt.toLocaleString("zh-TW")}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UTMDetails;
