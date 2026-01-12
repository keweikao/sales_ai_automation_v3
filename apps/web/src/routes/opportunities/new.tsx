/**
 * 新增商機頁面
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/opportunities/new")({
  component: NewOpportunityPage,
});

const statusOptions = [
  { value: "new", label: "新建立" },
  { value: "contacted", label: "已聯繫" },
  { value: "qualified", label: "已合格" },
  { value: "proposal", label: "報價中" },
  { value: "negotiation", label: "議價中" },
  { value: "won", label: "成交" },
  { value: "lost", label: "流失" },
] as const;

const sourceOptions = [
  { value: "manual", label: "手動建立" },
  { value: "import", label: "匯入" },
  { value: "api", label: "API" },
  { value: "referral", label: "轉介" },
] as const;

function NewOpportunityPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    customerNumber: "",
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    source: "manual" as "manual" | "import" | "api" | "referral",
    status: "new" as
      | "new"
      | "contacted"
      | "qualified"
      | "proposal"
      | "negotiation"
      | "won"
      | "lost",
    industry: "",
    companySize: "",
    notes: "",
  });

  const createMutation = useMutation({
    mutationFn: () => client.opportunities.create(formData),
    onSuccess: (data) => {
      toast.success("商機已建立");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      navigate({ to: "/opportunities/$id", params: { id: data.id } });
    },
    onError: (error) => {
      toast.error(`建立失敗: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerNumber || !formData.companyName) {
      toast.error("請填寫客戶編號和公司名稱");
      return;
    }
    createMutation.mutate();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <main className="container mx-auto max-w-2xl space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          onClick={() => navigate({ to: "/opportunities" })}
          size="icon"
          variant="ghost"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-bold text-3xl tracking-tight">新增商機</h1>
          <p className="text-muted-foreground">建立新的銷售商機</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              商機資訊
            </CardTitle>
            <CardDescription>填寫商機的基本資訊</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Required Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerNumber">
                  客戶編號 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerNumber"
                  name="customerNumber"
                  onChange={handleChange}
                  placeholder="例如: 202601-000001"
                  required
                  value={formData.customerNumber}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  公司名稱 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="companyName"
                  name="companyName"
                  onChange={handleChange}
                  placeholder="輸入公司名稱"
                  required
                  value={formData.companyName}
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactName">聯絡人</Label>
                <Input
                  id="contactName"
                  name="contactName"
                  onChange={handleChange}
                  placeholder="輸入聯絡人姓名"
                  value={formData.contactName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  onChange={handleChange}
                  placeholder="example@company.com"
                  type="email"
                  value={formData.contactEmail}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">電話</Label>
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  onChange={handleChange}
                  placeholder="0912-345-678"
                  value={formData.contactPhone}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">產業</Label>
                <Input
                  id="industry"
                  name="industry"
                  onChange={handleChange}
                  placeholder="例如: 餐飲業"
                  value={formData.industry}
                />
              </div>
            </div>

            {/* Status and Source */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>狀態</Label>
                <Select
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: value as typeof formData.status,
                    }))
                  }
                  value={formData.status}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>來源</Label>
                <Select
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      source: value as typeof formData.source,
                    }))
                  }
                  value={formData.source}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companySize">公司規模</Label>
              <Input
                id="companySize"
                name="companySize"
                onChange={handleChange}
                placeholder="例如: 50-100 人"
                value={formData.companySize}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">備註</Label>
              <Textarea
                id="notes"
                name="notes"
                onChange={handleChange}
                placeholder="輸入備註..."
                rows={4}
                value={formData.notes}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4">
              <Button asChild variant="outline">
                <Link to="/opportunities">取消</Link>
              </Button>
              <Button disabled={createMutation.isPending} type="submit">
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                建立商機
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
