/**
 * Opportunity 編輯頁面
 * 編輯機會的基本資訊
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Building2, Mail, Phone, Save, User } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/opportunities/$id/edit")({
  component: OpportunityEditPage,
});

function OpportunityEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch opportunity data
  const opportunityQuery = useQuery({
    queryKey: ["opportunities", "get", { opportunityId: id }],
    queryFn: async () => {
      const result = await client.opportunities.get({ opportunityId: id });
      return result;
    },
  });

  const opportunity = opportunityQuery.data;
  const isLoading = opportunityQuery.isLoading;

  // Populate form when data loads
  useEffect(() => {
    if (opportunity) {
      setCompanyName(opportunity.companyName || "");
      setContactName(opportunity.contactName || "");
      setContactPhone(opportunity.contactPhone || "");
      setContactEmail(opportunity.contactEmail || "");
      setNotes(opportunity.notes || "");
    }
  }, [opportunity]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: {
      opportunityId: string;
      companyName?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      notes?: string;
    }) => {
      return await client.opportunities.update(data);
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({
        queryKey: ["opportunities", "get", { opportunityId: id }],
      });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      // Navigate back to detail page
      navigate({ to: "/opportunities/$id", params: { id } });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      opportunityId: id,
      companyName: companyName || undefined,
      contactName: contactName || undefined,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      notes: notes || undefined,
    });
  };

  if (isLoading) {
    return (
      <main className="ds-page">
        <div className="ds-page-content">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </main>
    );
  }

  if (!opportunity) {
    return (
      <main className="ds-page">
        <div className="ds-page-content">
          <Card className="ds-card">
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">找不到此機會</p>
              <Link
                className="mt-4 inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 font-data text-sm transition-all duration-300 hover:bg-muted"
                to="/opportunities"
              >
                返回機會列表
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="ds-page">
      <div className="ds-page-content">
        {/* Page Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-4">
            <Button
              className="h-10 w-10 shrink-0 border-border transition-all duration-300 hover:border-[var(--ds-accent)] hover:text-[var(--ds-accent)]"
              onClick={() =>
                navigate({ to: "/opportunities/$id", params: { id } })
              }
              size="icon"
              variant="outline"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold font-display text-2xl tracking-tight sm:text-3xl">
                編輯機會
              </h1>
              <p className="mt-1 font-data text-muted-foreground text-sm">
                {opportunity.customerNumber} - {opportunity.companyName}
              </p>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <Card className="ds-card stagger-1 animate-fade-in-up">
          <div className="border-border border-b p-6">
            <h2 className="font-bold font-display text-xl">基本資訊</h2>
          </div>
          <CardContent className="p-6">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Company Name */}
                <div className="space-y-2">
                  <Label
                    className="flex items-center gap-2"
                    htmlFor="companyName"
                  >
                    <Building2 className="h-4 w-4 text-[var(--ds-accent)]" />
                    公司名稱
                  </Label>
                  <Input
                    id="companyName"
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="輸入公司名稱"
                    value={companyName}
                  />
                </div>

                {/* Contact Name */}
                <div className="space-y-2">
                  <Label
                    className="flex items-center gap-2"
                    htmlFor="contactName"
                  >
                    <User className="h-4 w-4 text-[var(--ds-accent)]" />
                    聯絡人
                  </Label>
                  <Input
                    id="contactName"
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="輸入聯絡人姓名"
                    value={contactName}
                  />
                </div>

                {/* Contact Phone */}
                <div className="space-y-2">
                  <Label
                    className="flex items-center gap-2"
                    htmlFor="contactPhone"
                  >
                    <Phone className="h-4 w-4 text-[var(--ds-accent)]" />
                    聯絡電話
                  </Label>
                  <Input
                    id="contactPhone"
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="輸入聯絡電話"
                    value={contactPhone}
                  />
                </div>

                {/* Contact Email */}
                <div className="space-y-2">
                  <Label
                    className="flex items-center gap-2"
                    htmlFor="contactEmail"
                  >
                    <Mail className="h-4 w-4 text-[var(--ds-accent)]" />
                    聯絡信箱
                  </Label>
                  <Input
                    id="contactEmail"
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="輸入聯絡信箱"
                    type="email"
                    value={contactEmail}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">備註</Label>
                <Textarea
                  id="notes"
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="輸入備註..."
                  rows={4}
                  value={notes}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-border border-t pt-6">
                <Button
                  onClick={() =>
                    navigate({ to: "/opportunities/$id", params: { id } })
                  }
                  type="button"
                  variant="outline"
                >
                  取消
                </Button>
                <Button
                  className="bg-[var(--ds-accent)] hover:bg-[var(--ds-accent-dark)]"
                  disabled={updateMutation.isPending}
                  type="submit"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateMutation.isPending ? "儲存中..." : "儲存變更"}
                </Button>
              </div>

              {updateMutation.isError && (
                <p className="text-center font-data text-red-500 text-sm">
                  儲存失敗：
                  {updateMutation.error instanceof Error
                    ? updateMutation.error.message
                    : "未知錯誤"}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
