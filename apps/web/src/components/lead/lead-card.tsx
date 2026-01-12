import {
  Building2,
  Calendar,
  Mail,
  Phone,
  TrendingUp,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { LeadStatusBadge } from "./lead-status-badge";

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  className?: string;
}

function getMeddicScoreColor(score: number): string {
  if (score >= 70) {
    return "bg-green-500";
  }
  if (score >= 40) {
    return "bg-yellow-500";
  }
  return "bg-red-500";
}

export function LeadCard({ lead, onClick, className }: LeadCardProps) {
  const formatDate = (date: Date | null) => {
    if (!date) {
      return "-";
    }
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  return (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{lead.companyName}</CardTitle>
          </div>
          <LeadStatusBadge status={lead.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Contact Info */}
        <div className="space-y-2">
          {lead.contactName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{lead.contactName}</span>
            </div>
          )}
          {lead.contactEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a
                className="text-blue-600 hover:underline dark:text-blue-400"
                href={`mailto:${lead.contactEmail}`}
                onClick={(e) => e.stopPropagation()}
              >
                {lead.contactEmail}
              </a>
            </div>
          )}
          {lead.contactPhone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a
                className="text-blue-600 hover:underline dark:text-blue-400"
                href={`tel:${lead.contactPhone}`}
                onClick={(e) => e.stopPropagation()}
              >
                {lead.contactPhone}
              </a>
            </div>
          )}
        </div>

        {/* Scores */}
        <div className="flex items-center gap-4 border-t pt-3">
          {lead.leadScore !== null && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                Lead Score: {lead.leadScore}
              </span>
            </div>
          )}
          {lead.meddicScore && (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full font-bold text-white text-xs",
                  getMeddicScoreColor(lead.meddicScore.overall)
                )}
              >
                M
              </span>
              <span className="font-medium text-sm">
                {lead.meddicScore.overall}
              </span>
            </div>
          )}
        </div>

        {/* Last Contact */}
        {lead.lastContactedAt && (
          <div className="flex items-center gap-2 border-t pt-3 text-muted-foreground text-sm">
            <Calendar className="h-4 w-4" />
            <span>上次聯繫: {formatDate(lead.lastContactedAt)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
