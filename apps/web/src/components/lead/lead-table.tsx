import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  Mail,
  MoreHorizontal,
  Phone,
  Search,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Lead, leadStatusOptions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { LeadStatusBadge } from "./lead-status-badge";

function getScoreBarColor(score: number): string {
  if (score >= 70) {
    return "bg-green-500";
  }
  if (score >= 40) {
    return "bg-yellow-500";
  }
  return "bg-red-500";
}

interface LeadTableProps {
  leads: Lead[];
  onView?: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  className?: string;
}

export function LeadTable({
  leads,
  onView,
  onEdit,
  onDelete,
  className,
}: LeadTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns: ColumnDef<Lead>[] = [
    {
      accessorKey: "companyName",
      header: ({ column }) => (
        <Button
          className="-ml-4"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          variant="ghost"
        >
          <Building2 className="mr-2 h-4 w-4" />
          公司名稱
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("companyName")}</div>
      ),
    },
    {
      accessorKey: "contactName",
      header: "聯絡人",
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <div className="space-y-1">
            <div>{lead.contactName || "-"}</div>
            {lead.contactEmail && (
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <Mail className="h-3 w-3" />
                {lead.contactEmail}
              </div>
            )}
            {lead.contactPhone && (
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <Phone className="h-3 w-3" />
                {lead.contactPhone}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "狀態",
      cell: ({ row }) => <LeadStatusBadge status={row.getValue("status")} />,
      filterFn: (row, id, value) => {
        return value === "all" || row.getValue(id) === value;
      },
    },
    {
      accessorKey: "leadScore",
      header: ({ column }) => (
        <Button
          className="-ml-4"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          variant="ghost"
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Lead 分數
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const score = row.getValue("leadScore") as number | null;
        if (score === null) {
          return "-";
        }
        return (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-16 rounded-full bg-gray-200 dark:bg-gray-700"
              )}
            >
              <div
                className={cn("h-full rounded-full", getScoreBarColor(score))}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="font-medium text-sm">{score}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "meddicScore",
      header: "MEDDIC",
      cell: ({ row }) => {
        const meddic = row.original.meddicScore;
        if (!meddic) {
          return "-";
        }
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full font-bold text-white text-xs",
                getScoreBarColor(meddic.overall)
              )}
            >
              M
            </span>
            <span className="font-medium">{meddic.overall}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "lastContactedAt",
      header: ({ column }) => (
        <Button
          className="-ml-4"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          variant="ghost"
        >
          上次聯繫
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = row.getValue("lastContactedAt") as Date | null;
        if (!date) {
          return "-";
        }
        return new Intl.DateTimeFormat("zh-TW", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(date);
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-none p-0 hover:bg-muted">
              <span className="sr-only">開啟選單</span>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>操作</DropdownMenuLabel>
              {onView && (
                <DropdownMenuItem onClick={() => onView(lead)}>
                  查看詳情
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(lead)}>
                  編輯
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => onDelete(lead)}
                  >
                    刪除
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="搜尋公司、聯絡人..."
            value={globalFilter ?? ""}
          />
        </div>
        <Select
          onValueChange={(value) => {
            const stringValue = String(value);
            table
              .getColumn("status")
              ?.setFilterValue(stringValue === "all" ? "" : stringValue);
          }}
          value={
            (table.getColumn("status")?.getFilterValue() as string) || "all"
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue>
              {(() => {
                const currentValue = table
                  .getColumn("status")
                  ?.getFilterValue() as string;
                if (!currentValue) {
                  return "全部狀態";
                }
                return (
                  leadStatusOptions.find((o) => o.value === currentValue)
                    ?.label || "全部狀態"
                );
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {leadStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className="cursor-pointer"
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                  onClick={() => onView?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center"
                  colSpan={columns.length}
                >
                  沒有找到資料
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          共 {table.getFilteredRowModel().rows.length} 筆資料
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
            上一頁
          </Button>
          <div className="text-sm">
            第 {table.getState().pagination.pageIndex + 1} /{" "}
            {table.getPageCount()} 頁
          </div>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="sm"
            variant="outline"
          >
            下一頁
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
