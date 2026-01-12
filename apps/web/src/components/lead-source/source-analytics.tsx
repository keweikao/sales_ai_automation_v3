/**
 * Source Analytics Component
 * 來源分析圖表與統計
 */

import {
  BarChart3,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface SourceData {
  source: string;
  leads: number;
  conversions: number;
}

interface CampaignData {
  campaign: string;
  leads: number;
  conversionRate: number;
}

interface SourceAnalyticsProps {
  totalLeads: number;
  bySource: SourceData[];
  byMedium: SourceData[];
  topCampaigns: CampaignData[];
  loading?: boolean;
}

export function SourceAnalytics({
  totalLeads,
  bySource,
  byMedium,
  topCampaigns,
  loading = false,
}: SourceAnalyticsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card className="animate-pulse" key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-32 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const maxSourceLeads = Math.max(...bySource.map((s) => s.leads), 1);
  const maxMediumLeads = Math.max(...byMedium.map((m) => m.leads), 1);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* 總覽卡片 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-medium text-sm">
            <Users className="h-4 w-4" />
            總潛客數
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-bold text-3xl">{totalLeads}</div>
          <div className="mt-2 flex items-center gap-1 text-muted-foreground text-sm">
            <span>來自 {bySource.length} 個來源</span>
          </div>
        </CardContent>
      </Card>

      {/* 依來源分布 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-medium text-sm">
            <BarChart3 className="h-4 w-4" />
            依來源
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bySource.slice(0, 5).map((item) => (
              <div key={item.source}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="capitalize">{item.source}</span>
                  <span className="font-medium">{item.leads}</span>
                </div>
                <Progress
                  className="h-2"
                  value={(item.leads / maxSourceLeads) * 100}
                />
              </div>
            ))}
            {bySource.length === 0 && (
              <div className="text-muted-foreground text-sm">尚無資料</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 依媒介分布 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-medium text-sm">
            <Target className="h-4 w-4" />
            依媒介
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {byMedium.slice(0, 5).map((item) => (
              <div key={item.medium}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="capitalize">
                    {item.medium === "none" ? "直接" : item.medium}
                  </span>
                  <span className="font-medium">{item.leads}</span>
                </div>
                <Progress
                  className="h-2"
                  value={(item.leads / maxMediumLeads) * 100}
                />
              </div>
            ))}
            {byMedium.length === 0 && (
              <div className="text-muted-foreground text-sm">尚無資料</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Campaigns */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="font-medium text-sm">熱門行銷活動</CardTitle>
        </CardHeader>
        <CardContent>
          {topCampaigns.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {topCampaigns.map((campaign) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={campaign.campaign}
                >
                  <div>
                    <div className="font-medium text-sm">
                      {campaign.campaign.replace(/_/g, " ")}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {campaign.leads} 潛客
                    </div>
                  </div>
                  <Badge
                    variant={
                      campaign.conversionRate >= 10
                        ? "default"
                        : campaign.conversionRate >= 5
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {campaign.conversionRate.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-muted-foreground text-sm">
              尚無活動資料
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 簡易來源統計卡片
 */
interface SourceStatsCardProps {
  title: string;
  value: number;
  change?: number;
  icon?: typeof Users;
}

export function SourceStatsCard({
  title,
  value,
  change,
  icon: Icon = Users,
}: SourceStatsCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-muted-foreground text-sm">{title}</div>
            <div className="font-bold text-2xl">{value}</div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
        {change !== undefined && (
          <div
            className={`mt-2 flex items-center gap-1 text-sm ${
              isPositive
                ? "text-green-600"
                : isNegative
                  ? "text-red-600"
                  : "text-muted-foreground"
            }`}
          >
            {isPositive && <TrendingUp className="h-4 w-4" />}
            {isNegative && <TrendingDown className="h-4 w-4" />}
            <span>
              {isPositive ? "+" : ""}
              {change}% 較上月
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SourceAnalytics;
