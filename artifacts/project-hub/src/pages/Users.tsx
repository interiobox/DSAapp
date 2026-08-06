import * as React from "react"
import { Users } from "lucide-react"

import {
  useListUsers,
} from "@workspace/api-client-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"
}

export default function UsersPage() {
  const { data: users, isLoading } = useListUsers()

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-none border-b bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">People available for drawing assignments. Portal accounts are managed in Admin.</p>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                All users
                <Badge variant="outline">{users?.length ?? 0}</Badge>
              </CardTitle>
              <CardDescription>Everyone listed here can receive drawing assignments.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
                </div>
              ) : users?.length ? (
                <div className="divide-y">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 px-6 py-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {initials(user.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">Available for assignment</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground">
                  <Users className="mb-3 h-9 w-9 opacity-50" />
                  <p className="font-medium text-foreground">No users yet</p>
                  <p className="mt-1 text-sm">Add the first user to start assigning drawings.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}