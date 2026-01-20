/**
 * 新增對話頁面
 * 上傳音檔並建立對話記錄
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MessageSquare, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { client, orpc } from "@/utils/orpc";

const searchSchema = z.object({
  opportunityId: z.string().optional(),
});

export const Route = createFileRoute("/conversations/new")({
  validateSearch: searchSchema,
  component: NewConversationPage,
});

const typeOptions = [
  { value: "discovery_call", label: "需求訪談" },
  { value: "demo", label: "產品展示" },
  { value: "follow_up", label: "跟進電話" },
  { value: "negotiation", label: "議價討論" },
  { value: "closing", label: "成交會議" },
  { value: "support", label: "客服支援" },
] as const;

function NewConversationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { opportunityId: defaultOpportunityId } = Route.useSearch();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    opportunityId: defaultOpportunityId || "",
    title: "",
    type: "discovery_call" as
      | "discovery_call"
      | "demo"
      | "follow_up"
      | "negotiation"
      | "closing"
      | "support",
    conversationDate: new Date().toISOString().split("T")[0],
  });

  // Fetch opportunities for dropdown
  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities", "list", { limit: 100 }],
    queryFn: async () => {
      return await client.opportunities.list({ limit: 100 });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("請選擇音檔");
      if (!formData.opportunityId) throw new Error("請選擇商機");

      // Convert file to base64
      const arrayBuffer = await selectedFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      return client.conversations.upload({
        opportunityId: formData.opportunityId,
        audioBase64: base64,
        title: formData.title || undefined,
        type: formData.type,
        metadata: {
          format: selectedFile.type.split("/")[1] || "mp3",
          conversationDate: formData.conversationDate,
        },
      });
    },
    onSuccess: (data) => {
      toast.success("對話已上傳，轉錄完成！");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate({
        to: "/conversations/$id",
        params: { id: data.conversationId },
      });
    },
    onError: (error) => {
      toast.error(`上傳失敗: ${error.message}`);
    },
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Validate file type
        const validTypes = [
          "audio/mp3",
          "audio/mpeg",
          "audio/wav",
          "audio/m4a",
          "audio/ogg",
          "audio/webm",
        ];
        if (
          !(
            validTypes.includes(file.type) ||
            file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)
          )
        ) {
          toast.error("不支援的檔案格式，請上傳 MP3、WAV、M4A 等音檔");
          return;
        }

        // Validate file size (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
          toast.error("檔案過大，請上傳小於 100MB 的音檔");
          return;
        }

        setSelectedFile(file);
      }
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("請選擇音檔");
      return;
    }
    if (!formData.opportunityId) {
      toast.error("請選擇商機");
      return;
    }
    uploadMutation.mutate();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <main className="container mx-auto max-w-2xl space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          onClick={() => navigate({ to: "/conversations" })}
          size="icon"
          variant="ghost"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-bold text-3xl tracking-tight">上傳對話</h1>
          <p className="text-muted-foreground">
            上傳銷售對話音檔進行 MEDDIC 分析
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              對話資訊
            </CardTitle>
            <CardDescription>上傳音檔並填寫對話資訊</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <Label>
                音檔 <span className="text-red-500">*</span>
              </Label>
              <div
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                  selectedFile
                    ? "border-green-500 bg-green-50 dark:bg-green-950"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
              >
                {selectedFile ? (
                  <div className="text-center">
                    <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                      <Upload className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {formatFileSize(selectedFile.size)}
                    </p>
                    <Button
                      className="mt-2"
                      onClick={() => setSelectedFile(null)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      重新選擇
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer text-center">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 font-medium">點擊或拖曳上傳音檔</p>
                    <p className="text-muted-foreground text-sm">
                      支援 MP3、WAV、M4A 等格式，最大 100MB
                    </p>
                    <input
                      accept="audio/*"
                      className="hidden"
                      onChange={handleFileChange}
                      type="file"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Opportunity Selection */}
            <div className="space-y-2">
              <Label>
                關聯商機 <span className="text-red-500">*</span>
              </Label>
              <Select
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, opportunityId: value }))
                }
                value={formData.opportunityId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇商機..." />
                </SelectTrigger>
                <SelectContent>
                  {opportunitiesQuery.data?.opportunities.map((opp) => (
                    <SelectItem key={opp.id} value={opp.id}>
                      {opp.companyName} ({opp.customerNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">對話標題</Label>
              <Input
                id="title"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="例如: ABC 餐廳 - 需求訪談"
                value={formData.title}
              />
            </div>

            {/* Type */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>對話類型</Label>
                <Select
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: value as typeof formData.type,
                    }))
                  }
                  value={formData.type}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conversation Date */}
              <div className="space-y-2">
                <Label htmlFor="conversationDate">對話日期</Label>
                <Input
                  id="conversationDate"
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      conversationDate: e.target.value,
                    }))
                  }
                  type="date"
                  value={formData.conversationDate}
                />
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p className="font-medium">上傳流程：</p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
                <li>上傳音檔至雲端儲存</li>
                <li>使用 Groq Whisper 進行語音轉錄</li>
                <li>建立對話記錄</li>
                <li>可選擇執行 MEDDIC 分析</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4">
              <Button asChild variant="outline">
                <Link to="/conversations">取消</Link>
              </Button>
              <Button
                disabled={uploadMutation.isPending || !selectedFile}
                type="submit"
              >
                {uploadMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                上傳對話
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
