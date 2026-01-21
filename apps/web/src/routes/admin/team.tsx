/**
 * 團隊管理頁面 (僅 Admin)
 * 管理用戶角色和團隊關係
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Shield, Trash2, Users } from "lucide-react";
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
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/admin/team")({
  component: TeamManagementPage,
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
  const isLoading = usersQuery.isLoading;

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
        </h1>
        <p className="text-muted-foreground">
          設定用戶角色和團隊標籤。Manager
          可以看到相同標籤的業務資料。設定為「全部」可查看所有團隊。
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
            設定角色 (Admin/Manager/業務) 和團隊標籤
            (全部/餐飲/美業)。相同標籤的成員可以互相查看資料。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用戶</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>團隊標籤</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.email}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
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
                          <span className="text-muted-foreground">無標籤</span>
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
                  </TableCell>
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
