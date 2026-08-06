import * as React from "react"
import { BellRing, Plus, Save, Settings as SettingsIcon, SunMoon, Tags, Trash2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  getListCategoriesQueryKey,
  getGetDashboardSummaryQueryKey,
  getListActivityQueryKey,
  getListDrawingsQueryKey,
  useCreateCategory,
  useDeleteCategory,
  useListCategories,
  useUpdateCategory,
} from "@workspace/api-client-react"

import { usePortalAuth } from "@/App"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

const STORAGE_KEY = "drawing-library-settings"
type SettingsState = { emailUpdates: boolean; deadlineAlerts: boolean; compactMode: boolean }
const defaults: SettingsState = { emailUpdates: true, deadlineAlerts: true, compactMode: false }

export default function Settings() {
  const { user } = usePortalAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: categories, isLoading: categoriesLoading } = useListCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const [newCategory, setNewCategory] = React.useState("")
  const [categoryDrafts, setCategoryDrafts] = React.useState<Record<number, string>>({})
  const [settings, setSettings] = React.useState<SettingsState>(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") } } catch { return defaults }
  })
  const [displayName, setDisplayName] = React.useState(user?.name ?? "")
  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    toast({ title: "Preference saved" })
  }
  function categoryError(error: unknown) {
    toast({ title: "Category change failed", description: error instanceof Error ? error.message : "The category could not be saved." })
  }

  function invalidateCategories() {
    void queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() })
    void queryClient.invalidateQueries({ queryKey: getListDrawingsQueryKey() })
    void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })
    void queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() })
  }

  function handleCreateCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newCategory.trim()
    if (!name) return
    createCategory.mutate({ data: { name } }, {
      onSuccess: () => {
        setNewCategory("")
        invalidateCategories()
        toast({ title: "Category added" })
      },
      onError: categoryError,
    })
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex-none border-b bg-card px-4 py-4 sm:px-6 sm:py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Personal preferences and shared drawing categories.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>Your portal account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div>
                <Label htmlFor="settings-name">Display name</Label>
                <Input id="settings-name" className="mt-2 max-w-md" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{user?.role ?? "user"}</Badge>
                <span className="text-sm text-muted-foreground">{user?.username ?? "Local account"}</span>
              </div>
              <Button variant="outline" onClick={() => toast({ title: "Profile changes are managed by an administrator" })}>Save profile</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base"><Tags className="h-4 w-4 text-primary" />Drawing categories</CardTitle>
              <CardDescription>Anyone on the team can add, rename, or move categories to the recycle bin.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleCreateCategory} className="mb-4 flex gap-2">
                <Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="e.g. Fire protection" />
                <Button type="submit" size="icon" disabled={createCategory.isPending || !newCategory.trim()} aria-label="Add category"><Plus className="h-4 w-4" /></Button>
              </form>
              {categoriesLoading ? (
                <p className="text-sm text-muted-foreground">Loading categories...</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {(categories ?? []).map((category) => {
                    const name = categoryDrafts[category.id] ?? category.name
                    return (
                      <div key={category.id} className="flex items-center gap-2 p-3">
                        <Input value={name} onChange={(event) => setCategoryDrafts((current) => ({ ...current, [category.id]: event.target.value }))} className="h-9" />
                        <Button size="icon" variant="ghost" disabled={updateCategory.isPending || !name.trim()} onClick={() => updateCategory.mutate({ id: category.id, data: { name: name.trim() } }, { onSuccess: () => { invalidateCategories(); setCategoryDrafts((current) => ({ ...current, [category.id]: name.trim() })); toast({ title: "Category renamed" }) }, onError: categoryError })} aria-label={`Save ${category.name}`}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive" onClick={() => { if (window.confirm(`Move category “${category.name}” to the recycle bin?`)) deleteCategory.mutate({ id: category.id }, { onSuccess: () => { invalidateCategories(); toast({ title: "Category moved to recycle bin" }) }, onError: categoryError }) }} aria-label={`Move ${category.name} to recycle bin`} data-testid={`button-recycle-category-${category.id}`}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />Recycle
                        </Button>
                      </div>
                    )
                  })}
                  {!categories?.length && <p className="p-4 text-sm text-muted-foreground">No categories yet. Add the first one above.</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b"><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-primary" />Notifications</CardTitle><CardDescription>Choose which reminders appear in your workspace.</CardDescription></CardHeader>
            <CardContent className="space-y-5 pt-5">{[["emailUpdates", "Activity updates", "Show recent drawing activity in Notifications."], ["deadlineAlerts", "Deadline alerts", "Highlight upcoming and overdue assigned drawings."]].map(([key, label, description]) => <div className="flex items-center justify-between gap-4" key={key}><div><p className="font-medium">{label}</p><p className="text-sm text-muted-foreground">{description}</p></div><Switch checked={settings[key as keyof SettingsState] as boolean} onCheckedChange={(value) => update(key as keyof SettingsState, value)} /></div>)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b"><CardTitle className="flex items-center gap-2 text-base"><SunMoon className="h-4 w-4 text-primary" />Display</CardTitle></CardHeader>
            <CardContent className="pt-5"><div className="flex items-center justify-between gap-4"><div><p className="font-medium">Compact mode</p><p className="text-sm text-muted-foreground">Use tighter spacing on list-heavy pages.</p></div><Switch checked={settings.compactMode} onCheckedChange={(value) => update("compactMode", value)} /></div></CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}