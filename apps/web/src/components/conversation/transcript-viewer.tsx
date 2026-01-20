import { Copy, Download, Search, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime?: number;
  onSegmentClick?: (segment: TranscriptSegment) => void;
  className?: string;
}

const speakerColors: Record<string, string> = {
  銷售: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  客戶: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  業務: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  經理: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

function getSpeakerColor(speaker: string): string {
  // Check for exact match first
  if (speakerColors[speaker]) {
    return speakerColors[speaker];
  }

  // Check if speaker contains known keywords
  for (const [key, color] of Object.entries(speakerColors)) {
    if (speaker.includes(key)) {
      return color;
    }
  }

  // Default color
  return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
}

export function TranscriptViewer({
  segments,
  currentTime,
  onSegmentClick,
  className,
}: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Filter segments based on search
  const filteredSegments = segments.filter(
    (segment) =>
      segment.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      segment.speaker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Auto-scroll to current segment based on currentTime
  useEffect(() => {
    if (currentTime === undefined) {
      return;
    }

    const currentIndex = segments.findIndex(
      (s) => currentTime >= s.start && currentTime < s.end
    );

    if (currentIndex !== -1 && currentIndex !== highlightedIndex) {
      setHighlightedIndex(currentIndex);

      const segmentEl = segmentRefs.current.get(currentIndex);
      if (segmentEl && containerRef.current) {
        segmentEl.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentTime, segments, highlightedIndex]);

  const handleCopyAll = async () => {
    const fullText = segments
      .map(
        (s) =>
          `[${formatDuration(Math.floor(s.start))}] ${s.speaker}: ${s.text}`
      )
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(fullText);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    const fullText = segments
      .map(
        (s) =>
          `[${formatDuration(Math.floor(s.start))}] ${s.speaker}: ${s.text}`
      )
      .join("\n\n");

    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const highlightSearchMatch = (text: string, query: string) => {
    if (!query) {
      return text;
    }

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, partIndex) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return (
          <mark
            className="bg-yellow-200 dark:bg-yellow-800"
            key={`${part}-${partIndex}`}
          >
            {part}
          </mark>
        );
      }
      return <span key={`${part}-${partIndex}`}>{part}</span>;
    });
  };

  if (segments.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">沒有可用的轉錄內容</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">對話轉錄</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              aria-label="複製全部"
              onClick={handleCopyAll}
              size="sm"
              variant="outline"
            >
              <Copy className="mr-1 h-4 w-4" />
              複製
            </Button>
            <Button
              aria-label="下載"
              onClick={handleDownload}
              size="sm"
              variant="outline"
            >
              <Download className="mr-1 h-4 w-4" />
              下載
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋對話內容..."
            value={searchQuery}
          />
        </div>

        {searchQuery && (
          <p className="mt-2 text-muted-foreground text-sm">
            找到 {filteredSegments.length} 筆結果
          </p>
        )}
      </CardHeader>

      <CardContent>
        <div
          className="max-h-[500px] space-y-4 overflow-y-auto pr-2"
          ref={containerRef}
        >
          {filteredSegments.map((segment) => {
            const originalIndex = segments.indexOf(segment);
            const isHighlighted = originalIndex === highlightedIndex;

            return (
              <div
                className={cn(
                  "rounded-lg p-3 transition-all",
                  isHighlighted
                    ? "bg-primary/10 ring-2 ring-primary"
                    : "hover:bg-muted/50",
                  onSegmentClick && "cursor-pointer"
                )}
                key={originalIndex}
                onClick={() => onSegmentClick?.(segment)}
                onKeyDown={
                  onSegmentClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSegmentClick(segment);
                        }
                      }
                    : undefined
                }
                ref={(el) => {
                  if (el) {
                    segmentRefs.current.set(originalIndex, el);
                  }
                }}
                role={onSegmentClick ? "button" : undefined}
                tabIndex={onSegmentClick ? 0 : undefined}
              >
                <div className="flex items-start gap-3">
                  {/* Speaker Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs",
                        getSpeakerColor(segment.speaker)
                      )}
                    >
                      <User className="h-3 w-3" />
                      {segment.speaker}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed">
                      {highlightSearchMatch(segment.text, searchQuery)}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="flex-shrink-0">
                    <span className="font-mono text-muted-foreground text-xs">
                      {formatDuration(Math.floor(segment.start))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
