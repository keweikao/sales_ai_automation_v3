/**
 * 個人待辦頁面 - Sales Pipeline
 * Precision Dashboard Design System
 * 顯示個人待辦事項，支援日曆選擇日期、完成、改期、成交、拒絕操作
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListTodo,
  Plus,
  RefreshCw,
  Trophy,
  UserX,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/todos/")({
  component: TodosPage,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }
  },
});

// ============================================================
// Types
// ============================================================

interface Todo {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  originalDueDate: string;
  status: "pending" | "completed" | "won" | "lost";
  source: string;
  postponeHistory: Array<{
    fromDate: string;
    toDate: string;
    reason?: string;
    postponedAt: string;
  }>;
  completionRecord: {
    result: string;
    completedVia: string;
    completedAt: string;
  } | null;
  wonRecord: {
    amount?: number;
    note?: string;
    wonAt: string;
    wonVia: string;
  } | null;
  lostRecord: {
    reason: string;
    competitor?: string;
    note?: string;
    lostAt: string;
    lostVia: string;
  } | null;
  nextTodoId: string | null;
  prevTodoId: string | null;
  createdAt: string;
  updatedAt: string;
  opportunity: {
    id: string;
    companyName: string;
    customerNumber: string;
  } | null;
  conversation: {
    id: string;
    title: string | null;
    caseNumber: string | null;
  } | null;
}

type StatusFilter = "all" | "pending" | "completed" | "won" | "lost";

// ============================================================
// Calendar Component
// ============================================================

interface CalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  todoCounts?: Record<string, number>;
}

function MiniCalendar({
  selectedDate,
  onSelectDate,
  todoCounts,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="ds-card p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Button
          className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={prevMonth}
          variant="ghost"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-display font-semibold text-base">
          {format(currentMonth, "yyyy年 M月", { locale: zhTW })}
        </h3>
        <Button
          className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={nextMonth}
          variant="ghost"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week day headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div
            className="py-1 text-center font-data text-muted-foreground text-xs"
            key={day}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const todoCount = todoCounts?.[dateKey] || 0;
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);

          return (
            <button
              className={cn(
                "relative flex h-9 w-full flex-col items-center justify-center rounded-lg font-data text-sm transition-all",
                "hover:bg-muted",
                !isCurrentMonth && "text-muted-foreground/40",
                isSelected &&
                  "bg-[var(--ds-accent)] text-white hover:bg-[var(--ds-accent)]",
                isTodayDate &&
                  !isSelected &&
                  "ring-1 ring-[var(--ds-accent)] ring-offset-1 ring-offset-background"
              )}
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              type="button"
            >
              <span>{format(day, "d")}</span>
              {todoCount > 0 && (
                <span
                  className={cn(
                    "absolute bottom-0.5 h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-white" : "bg-[var(--ds-accent)]"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Complete and Next Dialog Component
// ============================================================

interface CompleteAndNextDialogProps {
  todo: Todo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (
    todoId: string,
    data: {
      result: string;
      nextTodo: {
        title: string;
        description?: string;
        dueDate: string;
      };
    }
  ) => void;
  isLoading: boolean;
}

function CompleteAndNextDialog({
  todo,
  open,
  onOpenChange,
  onComplete,
  isLoading,
}: CompleteAndNextDialogProps) {
  const [result, setResult] = useState("");
  const [nextTitle, setNextTitle] = useState("");
  const [nextDays, setNextDays] = useState("3");
  const [nextDescription, setNextDescription] = useState("");

  const handleComplete = () => {
    if (!(todo && result.trim() && nextTitle.trim())) {
      return;
    }

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + Number.parseInt(nextDays, 10));

    onComplete(todo.id, {
      result: result.trim(),
      nextTodo: {
        title: nextTitle.trim(),
        description: nextDescription.trim() || undefined,
        dueDate: nextDueDate.toISOString(),
      },
    });
    setResult("");
    setNextTitle("");
    setNextDays("3");
    setNextDescription("");
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">
            完成待辦並建立下一步
          </DialogTitle>
          <DialogDescription className="font-data text-sm">
            {todo?.opportunity &&
              `[${todo.opportunity.customerNumber} ${todo.opportunity.companyName}] `}
            {todo?.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="result">
              執行結果
            </Label>
            <Textarea
              className="border-border bg-muted/50 focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="result"
              onChange={(e) => setResult(e.target.value)}
              placeholder="請描述執行結果..."
              rows={3}
              value={result}
            />
          </div>
          <div className="border-border border-t pt-4">
            <p className="mb-3 font-display font-medium text-sm">下一個待辦</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="font-display text-sm" htmlFor="nextTitle">
                  標題
                </Label>
                <Input
                  className="border-border bg-muted/50 focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
                  id="nextTitle"
                  onChange={(e) => setNextTitle(e.target.value)}
                  placeholder="下一個待辦標題..."
                  value={nextTitle}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-display text-sm" htmlFor="nextDays">
                  幾天後執行
                </Label>
                <Select onValueChange={setNextDays} value={nextDays}>
                  <SelectTrigger
                    className="border-border bg-muted/50"
                    id="nextDays"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="1">1 天後</SelectItem>
                    <SelectItem value="2">2 天後</SelectItem>
                    <SelectItem value="3">3 天後</SelectItem>
                    <SelectItem value="5">5 天後</SelectItem>
                    <SelectItem value="7">7 天後（一週）</SelectItem>
                    <SelectItem value="14">14 天後（兩週）</SelectItem>
                    <SelectItem value="30">30 天後（一個月）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label
                  className="font-display text-sm"
                  htmlFor="nextDescription"
                >
                  描述（選填）
                </Label>
                <Textarea
                  className="border-border bg-muted/50 focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
                  id="nextDescription"
                  onChange={(e) => setNextDescription(e.target.value)}
                  placeholder="待辦描述..."
                  rows={2}
                  value={nextDescription}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              variant="outline"
            >
              取消
            </Button>
          </DialogClose>
          <Button
            className="bg-[var(--ds-accent)] text-white hover:bg-[var(--ds-accent-dark)]"
            disabled={!(result.trim() && nextTitle.trim()) || isLoading}
            onClick={handleComplete}
          >
            {isLoading ? "處理中..." : "確認完成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Postpone Dialog Component
// ============================================================

interface PostponeDialogProps {
  todo: Todo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostpone: (todoId: string, newDate: string, reason?: string) => void;
  isLoading: boolean;
}

function PostponeDialog({
  todo,
  open,
  onOpenChange,
  onPostpone,
  isLoading,
}: PostponeDialogProps) {
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");

  const handlePostpone = () => {
    if (!(todo && newDate)) {
      return;
    }
    onPostpone(todo.id, newDate, reason.trim() || undefined);
    setNewDate("");
    setReason("");
  };

  // 設定最小日期為明天
  const minDate = format(addDays(new Date(), 1), "yyyy-MM-dd");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">改期待辦</DialogTitle>
          <DialogDescription className="font-data text-sm">
            {todo?.opportunity &&
              `[${todo.opportunity.customerNumber} ${todo.opportunity.companyName}] `}
            {todo?.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="newDate">
              新日期
            </Label>
            <Input
              className="border-border bg-muted/50 font-data focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="newDate"
              min={minDate}
              onChange={(e) => setNewDate(e.target.value)}
              type="date"
              value={newDate}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="reason">
              改期原因（選填）
            </Label>
            <Textarea
              className="border-border bg-muted/50 focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="reason"
              onChange={(e) => setReason(e.target.value)}
              placeholder="請說明改期原因..."
              rows={2}
              value={reason}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              variant="outline"
            >
              取消
            </Button>
          </DialogClose>
          <Button
            className="bg-[var(--ds-accent)] text-white hover:bg-[var(--ds-accent-dark)]"
            disabled={!newDate || isLoading}
            onClick={handlePostpone}
          >
            {isLoading ? "處理中..." : "確認改期"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Win Dialog Component
// ============================================================

interface WinDialogProps {
  todo: Todo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWin: (
    todoId: string,
    data: { expectedPaymentDate?: string; amount?: number; note?: string }
  ) => void;
  isLoading: boolean;
}

function WinDialog({
  todo,
  open,
  onOpenChange,
  onWin,
  isLoading,
}: WinDialogProps) {
  const [paymentDate, setPaymentDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleWin = () => {
    if (!todo) {
      return;
    }
    onWin(todo.id, {
      expectedPaymentDate: paymentDate || undefined,
      amount: amount ? Number.parseInt(amount, 10) : undefined,
      note: note.trim() || undefined,
    });
    setPaymentDate("");
    setAmount("");
    setNote("");
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Trophy className="h-5 w-5 text-amber-400" />
            恭喜成交
          </DialogTitle>
          <DialogDescription className="font-data text-sm">
            {todo?.opportunity &&
              `[${todo.opportunity.customerNumber} ${todo.opportunity.companyName}] `}
            {todo?.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="paymentDate">
              預計付款日期（選填）
            </Label>
            <Input
              className="border-border bg-muted/50 font-data focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="paymentDate"
              onChange={(e) => setPaymentDate(e.target.value)}
              type="date"
              value={paymentDate}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="amount">
              成交金額（選填）
            </Label>
            <Input
              className="border-border bg-muted/50 font-data focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="amount"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例如：50000"
              type="number"
              value={amount}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="winNote">
              備註（選填）
            </Label>
            <Textarea
              className="border-border bg-muted/50 focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="winNote"
              onChange={(e) => setNote(e.target.value)}
              placeholder="成交備註..."
              rows={2}
              value={note}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              variant="outline"
            >
              取消
            </Button>
          </DialogClose>
          <Button
            className="bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-900 hover:from-amber-600 hover:to-yellow-600"
            disabled={isLoading}
            onClick={handleWin}
          >
            {isLoading ? "處理中..." : "確認成交"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Lose Dialog Component
// ============================================================

interface LoseDialogProps {
  todo: Todo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLose: (
    todoId: string,
    data: { reason: string; competitor?: string; note?: string }
  ) => void;
  isLoading: boolean;
}

function LoseDialog({
  todo,
  open,
  onOpenChange,
  onLose,
  isLoading,
}: LoseDialogProps) {
  const [reason, setReason] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [note, setNote] = useState("");

  const handleLose = () => {
    if (!(todo && reason.trim())) {
      return;
    }
    onLose(todo.id, {
      reason: reason.trim(),
      competitor: competitor.trim() || undefined,
      note: note.trim() || undefined,
    });
    setReason("");
    setCompetitor("");
    setNote("");
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <UserX className="h-5 w-5 text-slate-400" />
            記錄拒絕
          </DialogTitle>
          <DialogDescription className="font-data text-sm">
            {todo?.opportunity &&
              `[${todo.opportunity.customerNumber} ${todo.opportunity.companyName}] `}
            {todo?.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="loseReason">
              拒絕原因
            </Label>
            <Textarea
              className="border-border bg-muted/50 focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="loseReason"
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：預算不足、選擇競品、暫無需求..."
              rows={3}
              value={reason}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="competitor">
              競品（選填）
            </Label>
            <Input
              className="border-border bg-muted/50 focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="competitor"
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="若客戶選擇競品，請填寫"
              value={competitor}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="loseNote">
              備註（選填）
            </Label>
            <Textarea
              className="border-border bg-muted/50 focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="loseNote"
              onChange={(e) => setNote(e.target.value)}
              placeholder="其他備註..."
              rows={2}
              value={note}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              variant="outline"
            >
              取消
            </Button>
          </DialogClose>
          <Button
            className="bg-slate-600 text-white hover:bg-slate-700"
            disabled={!reason.trim() || isLoading}
            onClick={handleLose}
          >
            {isLoading ? "處理中..." : "確認記錄"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Create Dialog Component
// ============================================================

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    title: string;
    description?: string;
    dueDate: string;
    opportunityId?: string;
  }) => void;
  isLoading: boolean;
  opportunities: Array<{ id: string; companyName: string }>;
}

function CreateDialog({
  open,
  onOpenChange,
  onCreate,
  isLoading,
  opportunities,
}: CreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [opportunityId, setOpportunityId] = useState<string>("");

  const handleCreate = () => {
    if (!(title.trim() && dueDate)) {
      return;
    }
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
      opportunityId: opportunityId || undefined,
    });
    // 重置表單
    setTitle("");
    setDescription("");
    setDueDate("");
    setOpportunityId("");
  };

  // 設定最小日期為今天
  const minDate = format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Plus className="h-5 w-5 text-[var(--ds-accent)]" />
            建立待辦
          </DialogTitle>
          <DialogDescription className="font-data text-sm">
            新增一個待辦事項
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="createTitle">
              標題
            </Label>
            <Input
              className="border-border bg-muted/50 focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="createTitle"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="請輸入待辦標題..."
              value={title}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="createDescription">
              描述（選填）
            </Label>
            <Textarea
              className="border-border bg-muted/50 focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="createDescription"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="請輸入詳細描述..."
              rows={3}
              value={description}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="createDueDate">
              到期日
            </Label>
            <Input
              className="border-border bg-muted/50 font-data focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              id="createDueDate"
              min={minDate}
              onChange={(e) => setDueDate(e.target.value)}
              type="date"
              value={dueDate}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-display text-sm" htmlFor="createOpportunity">
              關聯機會（選填）
            </Label>
            <Select onValueChange={setOpportunityId} value={opportunityId}>
              <SelectTrigger
                className="border-border bg-muted/50"
                id="createOpportunity"
              >
                <SelectValue placeholder="選擇機會" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                <SelectItem value="">不關聯機會</SelectItem>
                {opportunities.map((opp) => (
                  <SelectItem key={opp.id} value={opp.id}>
                    {opp.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              variant="outline"
            >
              取消
            </Button>
          </DialogClose>
          <Button
            className="bg-[var(--ds-accent)] text-white hover:bg-[var(--ds-accent-dark)]"
            disabled={!(title.trim() && dueDate) || isLoading}
            onClick={handleCreate}
          >
            {isLoading ? "處理中..." : "建立待辦"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Todo Item Component
// ============================================================

interface TodoItemProps {
  todo: Todo;
  onComplete: (todo: Todo) => void;
  onPostpone: (todo: Todo) => void;
  onWin: (todo: Todo) => void;
  onLose: (todo: Todo) => void;
  animationDelay?: number;
}

function TodoItem({
  todo,
  onComplete,
  onPostpone,
  onWin,
  onLose,
  animationDelay = 0,
}: TodoItemProps) {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const dueDate = new Date(todo.dueDate);
  const isOverdue = todo.status === "pending" && dueDate < todayStart;
  const isTodayDue =
    todo.status === "pending" &&
    dueDate.toDateString() === todayStart.toDateString();
  const postponeCount = todo.postponeHistory?.length || 0;
  const isPending = todo.status === "pending";
  const isCompleted = todo.status === "completed";
  const isWon = todo.status === "won";
  const isLost = todo.status === "lost";

  // 狀態色彩條 class
  const getAccentClass = () => {
    if (isOverdue) {
      return "before:bg-rose-500 dark:before:bg-rose-400 before:shadow-[0_0_8px_var(--ds-danger-glow)]";
    }
    if (isTodayDue) {
      return "before:bg-amber-500 dark:before:bg-amber-400 before:shadow-[0_0_8px_var(--ds-warning-glow)]";
    }
    if (isPending) {
      return "before:bg-sky-500 dark:before:bg-sky-400 before:shadow-[0_0_8px_var(--ds-info-glow)]";
    }
    if (isCompleted) {
      return "before:bg-emerald-500 dark:before:bg-emerald-400 before:shadow-[0_0_8px_var(--ds-success-glow)]";
    }
    if (isWon) {
      return "before:bg-gradient-to-b before:from-amber-400 before:to-yellow-500";
    }
    if (isLost) {
      return "before:bg-slate-500 dark:before:bg-slate-400";
    }
    return "";
  };

  // 狀態標籤
  const getStatusBadge = () => {
    if (isOverdue) {
      return (
        <Badge className="shrink-0 rounded-full border-rose-500/40 bg-rose-500/20 font-data text-rose-500 dark:text-rose-400">
          <AlertCircle className="mr-1 h-3 w-3" />
          逾期
        </Badge>
      );
    }
    if (isTodayDue) {
      return (
        <Badge className="shrink-0 rounded-full border-amber-500/40 bg-amber-500/20 font-data text-amber-600 dark:text-amber-400">
          <Clock className="mr-1 h-3 w-3" />
          今日
        </Badge>
      );
    }
    if (isPending) {
      return (
        <Badge className="shrink-0 rounded-full border-sky-500/40 bg-sky-500/20 font-data text-sky-600 dark:text-sky-400">
          <Clock className="mr-1 h-3 w-3" />
          待辦
        </Badge>
      );
    }
    if (isCompleted) {
      return (
        <Badge className="shrink-0 rounded-full border-emerald-500/40 bg-emerald-500/20 font-data text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="mr-1 h-3 w-3" />
          已完成
        </Badge>
      );
    }
    if (isWon) {
      return (
        <Badge className="shrink-0 rounded-full border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 font-data text-amber-600 dark:text-amber-400">
          <Trophy className="mr-1 h-3 w-3" />
          已成交
        </Badge>
      );
    }
    if (isLost) {
      return (
        <Badge className="shrink-0 rounded-full border-slate-500/40 bg-slate-500/20 font-data text-slate-500 dark:text-slate-400">
          <UserX className="mr-1 h-3 w-3" />
          已拒絕
        </Badge>
      );
    }
    return null;
  };

  return (
    <div
      className={cn(
        "ds-card relative pl-4 transition-all duration-300 hover:translate-x-1",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-l-lg",
        "animate-fade-in-up opacity-0",
        getAccentClass(),
        isLost && "opacity-70"
      )}
      style={{
        animationDelay: `${animationDelay}ms`,
        animationFillMode: "forwards",
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            {/* Title and Status */}
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <h3
                className={cn(
                  "truncate font-display font-medium",
                  isLost && "text-muted-foreground"
                )}
              >
                {todo.title}
              </h3>
            </div>

            {/* 關聯資訊 - 客戶編號和公司名稱 */}
            <div className="font-data text-muted-foreground text-sm">
              {todo.opportunity && (
                <Link
                  className="transition-colors hover:text-[var(--ds-accent)] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  params={{ id: todo.opportunity.id }}
                  to="/opportunities/$id"
                >
                  [{todo.opportunity.customerNumber}{" "}
                  {todo.opportunity.companyName}]
                </Link>
              )}
              {todo.conversation?.caseNumber && (
                <span className="ml-2">| {todo.conversation.caseNumber}</span>
              )}
            </div>

            {/* 描述 */}
            {todo.description && (
              <p className="line-clamp-2 text-muted-foreground text-sm">
                {todo.description}
              </p>
            )}

            {/* 完成記錄 */}
            {isCompleted && todo.completionRecord && (
              <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-700 text-sm dark:text-emerald-300">
                <strong className="font-display">結果：</strong>
                <span className="font-data">
                  {todo.completionRecord.result}
                </span>
                {todo.nextTodoId && (
                  <span className="ml-2 text-emerald-500">
                    已建立下一個待辦
                  </span>
                )}
              </div>
            )}

            {/* 成交記錄 */}
            {isWon && todo.wonRecord && (
              <div className="mt-2 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 p-2 text-amber-700 text-sm dark:text-amber-300">
                <strong className="font-display">成交</strong>
                {todo.wonRecord.amount && (
                  <span className="ml-2 font-data">
                    金額：${todo.wonRecord.amount.toLocaleString()}
                  </span>
                )}
                {todo.wonRecord.note && (
                  <span className="ml-2">| {todo.wonRecord.note}</span>
                )}
              </div>
            )}

            {/* 拒絕記錄 */}
            {isLost && todo.lostRecord && (
              <div className="mt-2 rounded-lg border border-slate-500/30 bg-slate-500/10 p-2 text-slate-600 text-sm dark:text-slate-400">
                <strong className="font-display">拒絕原因：</strong>
                <span className="font-data">{todo.lostRecord.reason}</span>
                {todo.lostRecord.competitor && (
                  <span className="ml-2">
                    | 競品：{todo.lostRecord.competitor}
                  </span>
                )}
                {todo.lostRecord.note && (
                  <span className="ml-2">| {todo.lostRecord.note}</span>
                )}
              </div>
            )}

            {/* 改期記錄 */}
            {postponeCount > 0 && (
              <div className="flex items-center gap-1 font-data text-muted-foreground text-xs">
                <RefreshCw className="h-3 w-3" />
                <span>已改期 {postponeCount} 次</span>
              </div>
            )}
          </div>

          {/* 操作按鈕 - 僅待辦中狀態顯示 */}
          {isPending && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                className="bg-[var(--ds-accent)] text-white hover:bg-[var(--ds-accent-dark)]"
                onClick={() => onComplete(todo)}
                size="sm"
              >
                <Check className="mr-1 h-4 w-4" />
                完成
              </Button>
              <Button
                className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onPostpone(todo)}
                size="sm"
                variant="outline"
              >
                <Clock className="mr-1 h-4 w-4" />
                改期
              </Button>
              <Button
                className="bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-900 hover:from-amber-600 hover:to-yellow-600"
                onClick={() => onWin(todo)}
                size="sm"
              >
                <Trophy className="mr-1 h-4 w-4" />
                成交
              </Button>
              <Button
                className="bg-slate-600 text-white hover:bg-slate-700"
                onClick={() => onLose(todo)}
                size="sm"
              >
                <UserX className="mr-1 h-4 w-4" />
                拒絕
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================

function TodosPage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [postponeDialogOpen, setPostponeDialogOpen] = useState(false);
  const [winDialogOpen, setWinDialogOpen] = useState(false);
  const [loseDialogOpen, setLoseDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  // 狀態篩選
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // 日期範圍選擇
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateRange, setDateRange] = useState({
    from: today,
    to: today,
  });

  // 快捷日期設定函式
  const setToday = () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    setDateRange({ from: todayStr, to: todayStr });
  };

  const setThisWeek = () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    setDateRange({
      from: format(weekStart, "yyyy-MM-dd"),
      to: format(weekEnd, "yyyy-MM-dd"),
    });
  };

  const setThisMonth = () => {
    const now = new Date();
    const monthStartDate = startOfMonth(now);
    setDateRange({
      from: format(monthStartDate, "yyyy-MM-dd"),
      to: format(now, "yyyy-MM-dd"),
    });
  };

  // 取得當月的待辦統計（用於日曆顯示）
  const monthStart = format(startOfMonth(selectedDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedDate), "yyyy-MM-dd");

  const monthTodosQuery = useQuery({
    queryKey: [
      "salesTodo",
      "list",
      { dateFrom: monthStart, dateTo: monthEnd, status: "pending" },
    ],
    queryFn: async () => {
      const result = await client.salesTodo.list({
        status: "pending",
        dateFrom: monthStart,
        dateTo: `${monthEnd}T23:59:59`,
        limit: 100,
        offset: 0,
      });
      return result;
    },
  });

  // 計算每日待辦數量
  const todoCounts =
    monthTodosQuery.data?.todos.reduce(
      (acc, todo) => {
        const dateKey = format(new Date(todo.dueDate), "yyyy-MM-dd");
        acc[dateKey] = (acc[dateKey] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ) || {};

  // 取得篩選範圍內的待辦
  const todosQuery = useQuery({
    queryKey: [
      "salesTodo",
      "list",
      {
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        status: statusFilter === "all" ? undefined : statusFilter,
      },
    ],
    queryFn: async () => {
      const result = await client.salesTodo.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        dateFrom: dateRange.from,
        dateTo: `${dateRange.to}T23:59:59`,
        limit: 100,
        offset: 0,
      });
      return result;
    },
  });

  // 取得各狀態數量（用於顯示 Badge）
  const countsQuery = useQuery({
    queryKey: [
      "salesTodo",
      "counts",
      { dateFrom: dateRange.from, dateTo: dateRange.to },
    ],
    queryFn: async () => {
      const [pending, completed, won, lost] = await Promise.all([
        client.salesTodo.list({
          status: "pending",
          dateFrom: dateRange.from,
          dateTo: `${dateRange.to}T23:59:59`,
          limit: 1,
          offset: 0,
        }),
        client.salesTodo.list({
          status: "completed",
          dateFrom: dateRange.from,
          dateTo: `${dateRange.to}T23:59:59`,
          limit: 1,
          offset: 0,
        }),
        client.salesTodo.list({
          status: "won",
          dateFrom: dateRange.from,
          dateTo: `${dateRange.to}T23:59:59`,
          limit: 1,
          offset: 0,
        }),
        client.salesTodo.list({
          status: "lost",
          dateFrom: dateRange.from,
          dateTo: `${dateRange.to}T23:59:59`,
          limit: 1,
          offset: 0,
        }),
      ]);
      return {
        pending: pending.total,
        completed: completed.total,
        won: won.total,
        lost: lost.total,
        all: pending.total + completed.total + won.total + lost.total,
      };
    },
  });

  // 取得逾期待辦
  const yesterday = format(addDays(new Date(), -1), "yyyy-MM-dd'T'23:59:59");
  const overdueTodosQuery = useQuery({
    queryKey: ["salesTodo", "list", { dateTo: yesterday, status: "pending" }],
    queryFn: async () => {
      const result = await client.salesTodo.list({
        status: "pending",
        dateTo: yesterday,
        limit: 100,
        offset: 0,
      });
      return result;
    },
  });

  // 完成待辦 mutation（支援 nextTodo）
  const completeMutation = useMutation({
    mutationFn: async ({
      todoId,
      result,
      nextTodo,
    }: {
      todoId: string;
      result: string;
      nextTodo: {
        title: string;
        description?: string;
        dueDate: string;
      };
    }) => {
      return await client.salesTodo.complete({
        todoId,
        result,
        completedVia: "web",
        nextTodo,
      });
    },
    onSuccess: () => {
      toast.success("待辦已完成，已建立下一個待辦");
      setCompleteDialogOpen(false);
      setSelectedTodo(null);
      queryClient.invalidateQueries({ queryKey: ["salesTodo"] });
    },
    onError: () => {
      toast.error("完成待辦失敗");
    },
  });

  // 改期待辦 mutation
  const postponeMutation = useMutation({
    mutationFn: async ({
      todoId,
      newDate,
      reason,
    }: {
      todoId: string;
      newDate: string;
      reason?: string;
    }) => {
      return await client.salesTodo.postpone({
        todoId,
        newDate,
        reason,
        postponedVia: "web",
      });
    },
    onSuccess: () => {
      toast.success("待辦已改期");
      setPostponeDialogOpen(false);
      setSelectedTodo(null);
      queryClient.invalidateQueries({ queryKey: ["salesTodo"] });
    },
    onError: () => {
      toast.error("改期待辦失敗");
    },
  });

  // 成交 mutation
  const winMutation = useMutation({
    mutationFn: async ({
      todoId,
      data,
    }: {
      todoId: string;
      data: { expectedPaymentDate?: string; amount?: number; note?: string };
    }) => {
      return await client.salesTodo.win({
        todoId,
        expectedPaymentDate: data.expectedPaymentDate,
        amount: data.amount,
        note: data.note,
        wonVia: "web",
      });
    },
    onSuccess: () => {
      toast.success("已標記為成交");
      setWinDialogOpen(false);
      setSelectedTodo(null);
      queryClient.invalidateQueries({ queryKey: ["salesTodo"] });
    },
    onError: () => {
      toast.error("操作失敗");
    },
  });

  // 拒絕 mutation
  const loseMutation = useMutation({
    mutationFn: async ({
      todoId,
      data,
    }: {
      todoId: string;
      data: { reason: string; competitor?: string; note?: string };
    }) => {
      return await client.salesTodo.lose({
        todoId,
        reason: data.reason,
        competitor: data.competitor,
        note: data.note,
        lostVia: "web",
      });
    },
    onSuccess: () => {
      toast.success("已標記為拒絕");
      setLoseDialogOpen(false);
      setSelectedTodo(null);
      queryClient.invalidateQueries({ queryKey: ["salesTodo"] });
    },
    onError: () => {
      toast.error("操作失敗");
    },
  });

  // 建立待辦 mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      dueDate: string;
      opportunityId?: string;
    }) => {
      return await client.salesTodo.create({
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        opportunityId: data.opportunityId,
        source: "web",
      });
    },
    onSuccess: () => {
      toast.success("待辦已建立");
      setCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["salesTodo"] });
    },
    onError: () => {
      toast.error("建立待辦失敗");
    },
  });

  // 取得機會列表（用於建立待辦的下拉選單）
  const opportunitiesQuery = useQuery({
    queryKey: ["opportunity", "list"],
    queryFn: async () => {
      const result = await client.opportunity.list({
        limit: 100,
        offset: 0,
      });
      return result;
    },
  });

  const handleOpenComplete = (todo: Todo) => {
    setSelectedTodo(todo);
    setCompleteDialogOpen(true);
  };

  const handleOpenPostpone = (todo: Todo) => {
    setSelectedTodo(todo);
    setPostponeDialogOpen(true);
  };

  const handleOpenWin = (todo: Todo) => {
    setSelectedTodo(todo);
    setWinDialogOpen(true);
  };

  const handleOpenLose = (todo: Todo) => {
    setSelectedTodo(todo);
    setLoseDialogOpen(true);
  };

  const handleComplete = (
    todoId: string,
    data: {
      result: string;
      nextTodo: {
        title: string;
        description?: string;
        dueDate: string;
      };
    }
  ) => {
    completeMutation.mutate({
      todoId,
      result: data.result,
      nextTodo: data.nextTodo,
    });
  };

  const handlePostpone = (todoId: string, newDate: string, reason?: string) => {
    postponeMutation.mutate({ todoId, newDate, reason });
  };

  const handleWin = (
    todoId: string,
    data: { expectedPaymentDate?: string; amount?: number; note?: string }
  ) => {
    winMutation.mutate({ todoId, data });
  };

  const handleLose = (
    todoId: string,
    data: { reason: string; competitor?: string; note?: string }
  ) => {
    loseMutation.mutate({ todoId, data });
  };

  const handleCreate = (data: {
    title: string;
    description?: string;
    dueDate: string;
    opportunityId?: string;
  }) => {
    createMutation.mutate(data);
  };

  // 待辦列表（根據 statusFilter API 已過濾）
  const filteredTodos = todosQuery.data?.todos || [];
  const overdueTodos = overdueTodosQuery.data?.todos || [];
  const isLoading = todosQuery.isLoading;
  const counts = countsQuery.data;

  // 狀態篩選按鈕配置
  const statusButtons: Array<{
    key: StatusFilter;
    label: string;
    icon: typeof ListTodo;
    count?: number;
  }> = [
    { key: "all", label: "全部", icon: ListTodo, count: counts?.all },
    { key: "pending", label: "待辦中", icon: Clock, count: counts?.pending },
    {
      key: "completed",
      label: "已完成",
      icon: CheckCircle,
      count: counts?.completed,
    },
    { key: "won", label: "已成交", icon: Trophy, count: counts?.won },
    { key: "lost", label: "已拒絕", icon: UserX, count: counts?.lost },
  ];

  return (
    <main className="ds-page">
      <div className="ds-page-content animate-fade-in-up opacity-0">
        {/* Page Header */}
        <PageHeader
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
          subtitle="管理您的銷售待辦事項"
          title="Sales Pipeline"
        >
          <Button
            className="bg-[var(--ds-accent)] text-white shadow-lg shadow-teal-500/20 transition-all hover:bg-[var(--ds-accent-dark)] hover:shadow-teal-500/30"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            建立待辦
          </Button>
        </PageHeader>

        {/* 篩選區域 */}
        <div
          className="flex animate-fade-in-up flex-wrap items-center gap-4 opacity-0"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          {/* 狀態篩選 - 藥丸形狀 */}
          <div className="flex flex-wrap gap-2">
            {statusButtons.map((btn) => {
              const Icon = btn.icon;
              const isActive = statusFilter === btn.key;
              return (
                <button
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-data text-sm transition-all",
                    isActive
                      ? "bg-[var(--ds-accent)] text-white shadow-lg shadow-teal-500/20"
                      : "border border-border bg-transparent text-muted-foreground hover:border-[var(--ds-accent)] hover:text-foreground"
                  )}
                  key={btn.key}
                  onClick={() => setStatusFilter(btn.key)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {btn.label}
                  {btn.count !== undefined && (
                    <span
                      className={cn(
                        "ml-1 rounded-full px-1.5 py-0.5 text-xs",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {btn.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 日期範圍 */}
          <div className="flex items-center gap-2">
            <Input
              className="w-[140px] border-border bg-muted/50 font-data focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, from: e.target.value }))
              }
              type="date"
              value={dateRange.from}
            />
            <span className="font-data text-muted-foreground text-sm">至</span>
            <Input
              className="w-[140px] border-border bg-muted/50 font-data focus:border-[var(--ds-accent)] focus:ring-[var(--ds-accent-glow)]"
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, to: e.target.value }))
              }
              type="date"
              value={dateRange.to}
            />
          </div>

          {/* 快捷按鈕 */}
          <div className="flex gap-1">
            <Button
              className="font-data text-muted-foreground hover:text-foreground"
              onClick={setToday}
              size="sm"
              variant="ghost"
            >
              今天
            </Button>
            <Button
              className="font-data text-muted-foreground hover:text-foreground"
              onClick={setThisWeek}
              size="sm"
              variant="ghost"
            >
              本週
            </Button>
            <Button
              className="font-data text-muted-foreground hover:text-foreground"
              onClick={setThisMonth}
              size="sm"
              variant="ghost"
            >
              本月
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* 左側日曆 */}
          <div
            className="animate-fade-in-up space-y-4 opacity-0"
            style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
          >
            <MiniCalendar
              onSelectDate={(date) => {
                setSelectedDate(date);
                const dateStr = format(date, "yyyy-MM-dd");
                setDateRange({ from: dateStr, to: dateStr });
              }}
              selectedDate={selectedDate}
              todoCounts={todoCounts}
            />

            {/* 逾期待辦提醒 */}
            {overdueTodos.length > 0 && (
              <div className="ds-card ds-card-accent-danger p-4">
                <div className="mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-[var(--ds-danger)]" />
                  <h4 className="font-display font-semibold text-[var(--ds-danger)] text-sm">
                    逾期待辦 ({overdueTodos.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {overdueTodos.slice(0, 3).map((todo) => (
                    <div className="text-sm" key={todo.id}>
                      <p className="truncate font-medium">{todo.title}</p>
                      <p className="font-data text-muted-foreground text-xs">
                        {format(new Date(todo.dueDate), "M/d", {
                          locale: zhTW,
                        })}
                      </p>
                    </div>
                  ))}
                  {overdueTodos.length > 3 && (
                    <p className="font-data text-muted-foreground text-xs">
                      還有 {overdueTodos.length - 3} 項...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 右側待辦列表 */}
          <div
            className="animate-fade-in-up space-y-4 opacity-0"
            style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-[var(--ds-accent)]" />
              <h2 className="font-display font-semibold text-xl">
                {dateRange.from === dateRange.to
                  ? format(new Date(dateRange.from), "M月d日", { locale: zhTW })
                  : `${format(new Date(dateRange.from), "M/d", { locale: zhTW })} - ${format(new Date(dateRange.to), "M/d", { locale: zhTW })}`}{" "}
                的待辦
              </h2>
              <Badge className="rounded-full border-[var(--ds-accent)]/40 bg-[var(--ds-accent)]/20 font-data text-[var(--ds-accent)]">
                {filteredTodos.length} 項
              </Badge>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div className="ds-card p-4" key={i}>
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTodos.length > 0 ? (
              <div className="space-y-3">
                {filteredTodos.map((todo, index) => (
                  <TodoItem
                    animationDelay={400 + index * 50}
                    key={todo.id}
                    onComplete={handleOpenComplete}
                    onLose={handleOpenLose}
                    onPostpone={handleOpenPostpone}
                    onWin={handleOpenWin}
                    todo={todo as Todo}
                  />
                ))}
              </div>
            ) : (
              <div className="ds-card py-12 text-center">
                <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="font-display text-muted-foreground">
                  此範圍內沒有待辦事項
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dialogs */}
        <CompleteAndNextDialog
          isLoading={completeMutation.isPending}
          onComplete={handleComplete}
          onOpenChange={setCompleteDialogOpen}
          open={completeDialogOpen}
          todo={selectedTodo}
        />
        <PostponeDialog
          isLoading={postponeMutation.isPending}
          onOpenChange={setPostponeDialogOpen}
          onPostpone={handlePostpone}
          open={postponeDialogOpen}
          todo={selectedTodo}
        />
        <WinDialog
          isLoading={winMutation.isPending}
          onOpenChange={setWinDialogOpen}
          onWin={handleWin}
          open={winDialogOpen}
          todo={selectedTodo}
        />
        <LoseDialog
          isLoading={loseMutation.isPending}
          onLose={handleLose}
          onOpenChange={setLoseDialogOpen}
          open={loseDialogOpen}
          todo={selectedTodo}
        />
        <CreateDialog
          isLoading={createMutation.isPending}
          onCreate={handleCreate}
          onOpenChange={setCreateDialogOpen}
          open={createDialogOpen}
          opportunities={
            opportunitiesQuery.data?.opportunities.map((opp) => ({
              id: opp.id,
              companyName: opp.companyName,
            })) || []
          }
        />
      </div>
    </main>
  );
}
