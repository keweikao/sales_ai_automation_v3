import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { type Lead, leadStatusOptions } from "@/lib/mock-data";

// Top-level regex for email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSubmitButtonText(isLoading: boolean, isEdit: boolean): string {
  if (isLoading) {
    return "處理中...";
  }
  if (isEdit) {
    return "更新";
  }
  return "建立";
}

interface LeadFormProps {
  lead?: Lead;
  onSubmit: (data: LeadFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export interface LeadFormData {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
  source: string;
  industry: string;
  companySize: string;
  notes: string;
}

const sourceOptions = [
  { value: "manual", label: "手動建立" },
  { value: "import", label: "匯入" },
  { value: "api", label: "API" },
  { value: "referral", label: "轉介" },
];

const companySizeOptions = [
  { value: "1-10", label: "1-10 人" },
  { value: "10-50", label: "10-50 人" },
  { value: "50-100", label: "50-100 人" },
  { value: "100-500", label: "100-500 人" },
  { value: "500+", label: "500 人以上" },
];

const industryOptions = [
  { value: "餐飲業", label: "餐飲業" },
  { value: "零售業", label: "零售業" },
  { value: "服務業", label: "服務業" },
  { value: "製造業", label: "製造業" },
  { value: "科技業", label: "科技業" },
  { value: "其他", label: "其他" },
];

export function LeadForm({
  lead,
  onSubmit,
  onCancel,
  isLoading,
}: LeadFormProps) {
  const [formData, setFormData] = useState<LeadFormData>({
    companyName: lead?.companyName || "",
    contactName: lead?.contactName || "",
    contactEmail: lead?.contactEmail || "",
    contactPhone: lead?.contactPhone || "",
    status: lead?.status || "new",
    source: lead?.source || "manual",
    industry: lead?.industry || "",
    companySize: lead?.companySize || "",
    notes: lead?.notes || "",
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof LeadFormData, string>>
  >({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof LeadFormData, string>> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = "公司名稱為必填";
    }

    if (formData.contactEmail && !EMAIL_REGEX.test(formData.contactEmail)) {
      newErrors.contactEmail = "請輸入有效的電子郵件";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const updateField = <K extends keyof LeadFormData>(
    field: K,
    value: LeadFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lead ? "編輯潛在客戶" : "新增潛在客戶"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Company Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">
                公司名稱 <span className="text-red-500">*</span>
              </Label>
              <Input
                aria-describedby={
                  errors.companyName ? "companyName-error" : undefined
                }
                aria-invalid={!!errors.companyName}
                id="companyName"
                onChange={(e) => updateField("companyName", e.target.value)}
                placeholder="輸入公司名稱"
                value={formData.companyName}
              />
              {errors.companyName && (
                <p className="text-red-500 text-sm" id="companyName-error">
                  {errors.companyName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">產業</Label>
              <Select
                onValueChange={(value) => {
                  if (value) {
                    updateField("industry", String(value));
                  }
                }}
                value={formData.industry || undefined}
              >
                <SelectTrigger id="industry">
                  <SelectValue>
                    {formData.industry
                      ? industryOptions.find(
                          (o) => o.value === formData.industry
                        )?.label
                      : "選擇產業"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {industryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactName">聯絡人姓名</Label>
              <Input
                id="contactName"
                onChange={(e) => updateField("contactName", e.target.value)}
                placeholder="輸入聯絡人姓名"
                value={formData.contactName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">電子郵件</Label>
              <Input
                aria-describedby={
                  errors.contactEmail ? "contactEmail-error" : undefined
                }
                aria-invalid={!!errors.contactEmail}
                id="contactEmail"
                onChange={(e) => updateField("contactEmail", e.target.value)}
                placeholder="example@company.com"
                type="email"
                value={formData.contactEmail}
              />
              {errors.contactEmail && (
                <p className="text-red-500 text-sm" id="contactEmail-error">
                  {errors.contactEmail}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactPhone">電話</Label>
              <Input
                id="contactPhone"
                onChange={(e) => updateField("contactPhone", e.target.value)}
                placeholder="0912-345-678"
                type="tel"
                value={formData.contactPhone}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companySize">公司規模</Label>
              <Select
                onValueChange={(value) => {
                  if (value) {
                    updateField("companySize", String(value));
                  }
                }}
                value={formData.companySize || undefined}
              >
                <SelectTrigger id="companySize">
                  <SelectValue>
                    {formData.companySize
                      ? companySizeOptions.find(
                          (o) => o.value === formData.companySize
                        )?.label
                      : "選擇公司規模"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companySizeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status & Source */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">狀態</Label>
              <Select
                onValueChange={(value) => {
                  if (value) {
                    updateField("status", String(value));
                  }
                }}
                value={formData.status || undefined}
              >
                <SelectTrigger id="status">
                  <SelectValue>
                    {formData.status
                      ? leadStatusOptions.find(
                          (o) => o.value === formData.status
                        )?.label
                      : "選擇狀態"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {leadStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">來源</Label>
              <Select
                onValueChange={(value) => {
                  if (value) {
                    updateField("source", String(value));
                  }
                }}
                value={formData.source || undefined}
              >
                <SelectTrigger id="source">
                  <SelectValue>
                    {formData.source
                      ? sourceOptions.find((o) => o.value === formData.source)
                          ?.label
                      : "選擇來源"}
                  </SelectValue>
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">備註</Label>
            <Textarea
              id="notes"
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="輸入備註..."
              rows={4}
              value={formData.notes}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            {onCancel && (
              <Button onClick={onCancel} type="button" variant="outline">
                取消
              </Button>
            )}
            <Button disabled={isLoading} type="submit">
              {getSubmitButtonText(isLoading ?? false, !!lead)}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
