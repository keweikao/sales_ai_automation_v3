/**
 * 團隊管理頁面 (Admin 或 Manager)
 * - Admin: 完整管理功能
 * - Manager: 唯讀模式，只能查看同部門業務
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AlertCircle, Loader2, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/admin/team")({
  component: TeamManagementPage,
  beforeLoad: async () => {
    // 檢查是否已登入
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }
    return { session };
  },
});

function TeamManagementPage() {
  const queryClient = useQueryClient();

  // 查詢所有用戶
  const usersQuery = useQuery({
    queryKey: ["team", "users"],
    queryFn: async () => {
      return await client.team.listUsers();
    },
  });

  // 更新角色和標籤 mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
      department,
    }: {
      userId: string;
      role?: "admin" | "manager" | "sales_rep";
      department?: string;
    }) => {
      return await client.team.updateUserRole({ userId, role, department });
    },
    onSuccess: () => {
      toast.success("用戶資料已更新");
      queryClient.invalidateQueries({ queryKey: ["team", "users"] });
    },
    onError: (error: Error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  // 刪除用戶 mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await client.team.deleteUser({ userId });
    },
    onSuccess: () => {
      toast.success("用戶已刪除");
      queryClient.invalidateQueries({ queryKey: ["team", "users"] });
    },
    onError: (error: Error) => {
      toast.error(`刪除失敗: ${error.message}`);
    },
  });

  const users = usersQuery.data?.users || [];
  const currentUserRole = usersQuery.data?.currentUserRole;
  const isAdmin = currentUserRole === "admin";
  const isLoading = usersQuery.isLoading;

  // 處理無權限錯誤
  if (usersQuery.isError) {
    return (
      <main className="container mx-auto p-6">
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-4 pt-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h2 className="font-semibold text-lg">無權限訪問</h2>
              <p className="text-muted-foreground">
                只有管理員或經理可以查看團隊管理頁面
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-bold text-3xl">
          <Shield className="h-8 w-8" />
          團隊管理
          {!isAdmin && (
            <Badge className="ml-2 font-normal text-sm" variant="secondary">
              唯讀模式
            </Badge>
          )}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin
            ? "設定用戶角色和團隊標籤。Manager 可以看到相同標籤的業務資料。設定為「全部」可查看所有團隊。"
            : "查看您團隊內的業務成員列表。"}
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">總用戶數</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">經理數</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {users.filter((u) => u.role === "manager").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">業務數</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {users.filter((u) => u.role === "sales_rep").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 用戶列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            用戶列表
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "設定角色 (Admin/Manager/業務) 和團隊標籤 (全部/餐飲/美業)。相同標籤的成員可以互相查看資料。"
              : "查看您團隊內的業務成員。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用戶</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>角色</TableHead>
                <TableHead className="hidden lg:table-cell">團隊標籤</TableHead>
                {isAdmin && <TableHead className="w-[100px]">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select
                        defaultValue={user.role}
                        disabled={updateUserMutation.isPending}
                        onValueChange={(
                          value: "admin" | "manager" | "sales_rep"
                        ) =>
                          updateUserMutation.mutate({
                            userId: user.id,
                            role: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">Admin</Badge>
                            </div>
                          </SelectItem>
                          <SelectItem value="manager">
                            <div className="flex items-center gap-2">
                              <Badge variant="default">Manager</Badge>
                            </div>
                          </SelectItem>
                          <SelectItem value="sales_rep">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">業務</Badge>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant={
                          user.role === "admin"
                            ? "destructive"
                            : user.role === "manager"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {user.role === "admin"
                          ? "Admin"
                          : user.role === "manager"
                            ? "Manager"
                            : "業務"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {isAdmin ? (
                      <Select
                        defaultValue={user.department || "none"}
                        disabled={updateUserMutation.isPending}
                        onValueChange={(value) =>
                          updateUserMutation.mutate({
                            userId: user.id,
                            department: value === "none" ? undefined : value,
                          })
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="選擇標籤" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">
                              無標籤
                            </span>
                          </SelectItem>
                          <SelectItem value="all">
                            <Badge variant="outline">全部</Badge>
                          </SelectItem>
                          <SelectItem value="ichef">
                            <Badge variant="default">餐飲</Badge>
                          </SelectItem>
                          <SelectItem value="beauty">
                            <Badge variant="secondary">美業</Badge>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">
                        {user.department === "all"
                          ? "全部"
                          : user.department === "ichef"
                            ? "餐飲"
                            : user.department === "beauty"
                              ? "美業"
                              : "無標籤"}
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        disabled={deleteUserMutation.isPending}
                        onClick={() => {
                          if (
                            confirm(
                              `確定要刪除用戶 ${user.name} (${user.email}) 嗎？此操作無法復原。`
                            )
                          ) {
                            deleteUserMutation.mutate(user.id);
                          }
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {users.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-4 h-12 w-12" />
              <p>尚無用戶資料</p>
              <p className="text-sm">用戶需要先透過 Google OAuth 登入</p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
