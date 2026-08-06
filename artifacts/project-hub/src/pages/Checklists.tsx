import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { 
  CheckCircle2, 
  Circle, 
  ClipboardList, 
  FileCheck2,
  FileText,
  GripVertical,
  ListChecks,
  Loader2, 
  Plus, 
  Save, 
  Trash2,
  X
} from "lucide-react"

import {
  getListChecklistTemplatesQueryKey,
  getListProjectChecklistsQueryKey,
  useApplyChecklistTemplate,
  useCreateChecklistTemplate,
  useDeleteChecklistTemplate,
  useDeleteProjectChecklist,
  useListChecklistTemplates,
  useListProjectChecklists,
  useListProjects,
  useToggleProjectChecklistItem,
  useUpdateChecklistTemplate,
} from "@workspace/api-client-react"
import type { ChecklistTemplate, ProjectChecklist } from "@workspace/api-client-react"
import { usePortalAuth } from "@/App"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"

export default function ChecklistsPage() {
  const [activeTab, setActiveTab] = React.useState("active")

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-none border-b bg-card px-4 py-4 sm:px-6 sm:py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <ListChecks className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Checklists</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage templates and track project handover and site-readiness checks.</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto max-w-6xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="active" data-testid="tab-active-checklists">Project Checklists</TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-6 m-0">
              <ActiveChecklistsView />
            </TabsContent>
            
            <TabsContent value="templates" className="space-y-6 m-0">
              <TemplatesView />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

function ActiveChecklistsView() {
  const { data: projects } = useListProjects()
  const { data: templates } = useListChecklistTemplates()
  const [projectFilter, setProjectFilter] = React.useState<string>("all")
  
  const { data: checklists, isLoading } = useListProjectChecklists(
    projectFilter !== "all" ? { projectName: projectFilter } : undefined
  )
  
  const projectOptions = React.useMemo(() => projects?.map(p => p.name).sort((a, b) => a.localeCompare(b)) || [], [projects])
  
  const [isApplyOpen, setIsApplyOpen] = React.useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 w-full sm:max-w-xs">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger data-testid="select-project-filter">
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projectOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          {projectFilter !== "all" && (
            <Button variant="ghost" size="icon" onClick={() => setProjectFilter("all")} title="Clear project filter">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <Button onClick={() => setIsApplyOpen(true)} data-testid="button-apply-template">
          <Plus className="mr-2 h-4 w-4" /> Apply Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : checklists?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground">
            <ClipboardList className="mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm font-medium text-foreground">No active checklists</p>
            <p className="mt-1 text-sm">Apply a template to a project to get started.</p>
            <Button className="mt-4" variant="outline" onClick={() => setIsApplyOpen(true)}>
              Apply Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {checklists?.map(checklist => (
            <ChecklistCard key={checklist.id} checklist={checklist} />
          ))}
        </div>
      )}

      {isApplyOpen && (
        <ApplyTemplateDialog 
          open={isApplyOpen} 
          onOpenChange={setIsApplyOpen} 
          projects={projectOptions} 
          templates={templates || []}
          initialProject={projectFilter !== "all" ? projectFilter : undefined}
        />
      )}
    </div>
  )
}

function ApplyTemplateDialog({ 
  open, 
  onOpenChange, 
  projects, 
  templates,
  initialProject 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  projects: string[];
  templates: ChecklistTemplate[];
  initialProject?: string;
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const applyMutation = useApplyChecklistTemplate()
  
  const [selectedProject, setSelectedProject] = React.useState<string>(initialProject || "")
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>("")

  function handleApply(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProject || !selectedTemplate) return
    
    applyMutation.mutate({
      data: {
        projectName: selectedProject,
        templateId: parseInt(selectedTemplate, 10)
      }
    }, {
      onSuccess: () => {
        toast({ title: "Template applied", description: `Added checklist to ${selectedProject}.` })
        queryClient.invalidateQueries({ queryKey: getListProjectChecklistsQueryKey() })
        onOpenChange(false)
      },
        onError: (err) => {
          toast({ title: "Could not apply template", description: err instanceof Error ? err.message : "An error occurred" })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleApply}>
          <DialogHeader>
            <DialogTitle>Apply Template</DialogTitle>
            <DialogDescription>Start a new checklist for a project from an existing template.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger id="project" data-testid="select-apply-project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template" data-testid="select-apply-template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name} ({t.items.length} items)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!selectedProject || !selectedTemplate || applyMutation.isPending} data-testid="button-confirm-apply">
              {applyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ChecklistCard({ checklist }: { checklist: ProjectChecklist }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const toggleMutation = useToggleProjectChecklistItem()
  const deleteMutation = useDeleteProjectChecklist()
  
  const completedCount = checklist.items.filter(i => i.completed).length
  const totalCount = checklist.items.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const isComplete = progress === 100 && totalCount > 0

  function handleToggle(itemId: number, completed: boolean) {
    // Optimistic update locally
    queryClient.setQueryData<ProjectChecklist[]>(getListProjectChecklistsQueryKey(), (old) => {
      if (!old) return old
      return old.map(cl => {
        if (cl.id !== checklist.id) return cl
        return {
          ...cl,
          items: cl.items.map(item => item.id === itemId ? { ...item, completed } : item)
        }
      })
    })

    toggleMutation.mutate({
      id: checklist.id,
      itemId,
      data: { completed }
    }, {
      onSuccess: () => {
        // Refetch to get real completedBy/completedAt info
        queryClient.invalidateQueries({ queryKey: getListProjectChecklistsQueryKey() })
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err instanceof Error ? err.message : "Could not save progress" })
        queryClient.invalidateQueries({ queryKey: getListProjectChecklistsQueryKey() }) // Revert
      }
    })
  }

  function handleDelete() {
    if (!window.confirm(`Move the "${checklist.name}" checklist for ${checklist.projectName} to the recycle bin?`)) return
    
    deleteMutation.mutate({ id: checklist.id }, {
      onSuccess: () => {
        toast({ title: "Checklist moved to recycle bin" })
        queryClient.invalidateQueries({ queryKey: getListProjectChecklistsQueryKey() })
      },
      onError: (err) => {
        toast({ title: "Could not move checklist to recycle bin", description: err instanceof Error ? err.message : "Could not recycle checklist" })
      }
    })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
              <FileCheck2 className="h-4 w-4" />
              <span className="truncate">{checklist.projectName}</span>
            </div>
            <CardTitle className="text-xl font-semibold leading-tight flex items-center gap-2">
              <span className="truncate" title={checklist.name}>{checklist.name}</span>
              {isComplete && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 shrink-0">Complete</Badge>}
            </CardTitle>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-sm font-medium text-muted-foreground w-12 text-right">{progress}%</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <div className="divide-y">
          {checklist.items.map(item => (
            <label key={item.id} className="flex items-start gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors group">
              <Checkbox 
                checked={item.completed} 
                onCheckedChange={(checked) => handleToggle(item.id, checked as boolean)}
                className="mt-0.5"
                data-testid={`checkbox-item-${item.id}`}
              />
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium leading-none ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.title}
                </span>
                {item.completed && item.completedAt && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Completed {formatDate(item.completedAt)}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TemplatesView() {
  const { data: templates, isLoading } = useListChecklistTemplates()
  const [editingTemplate, setEditingTemplate] = React.useState<ChecklistTemplate | null | "new">(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Reusable Templates</h2>
          <p className="text-sm text-muted-foreground">Standardize your handover processes.</p>
        </div>
        <Button onClick={() => setEditingTemplate("new")} data-testid="button-create-template">
          <Plus className="mr-2 h-4 w-4" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : templates?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground">
            <ClipboardList className="mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm font-medium text-foreground">No templates yet</p>
            <p className="mt-1 text-sm">Create standard checklists that can be applied to projects.</p>
            <Button className="mt-4" variant="outline" onClick={() => setEditingTemplate("new")}>
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates?.map(template => (
            <TemplateCard key={template.id} template={template} onEdit={() => setEditingTemplate(template)} />
          ))}
        </div>
      )}

      {editingTemplate && (
        <TemplateFormDialog 
          open={!!editingTemplate} 
          onOpenChange={(open) => { if (!open) setEditingTemplate(null) }}
          template={editingTemplate === "new" ? undefined : editingTemplate}
        />
      )}
    </div>
  )
}

function TemplateCard({ template, onEdit }: { template: ChecklistTemplate, onEdit: () => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const deleteMutation = useDeleteChecklistTemplate()

  function handleDelete() {
    if (!window.confirm(`Move the "${template.name}" template to the recycle bin? Existing checklists will be preserved.`)) return
    
    deleteMutation.mutate({ id: template.id }, {
      onSuccess: () => {
        toast({ title: "Template moved to recycle bin" })
        queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() })
      },
      onError: (err) => {
        toast({ title: "Could not move template to recycle bin", description: err instanceof Error ? err.message : "Could not recycle template" })
      }
    })
  }

  return (
    <Card className="flex flex-col hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight truncate" title={template.name}>{template.name}</CardTitle>
          <Badge variant="outline" className="shrink-0">{template.items.length} items</Badge>
        </div>
        {template.description && (
          <CardDescription className="line-clamp-2 mt-1.5">{template.description}</CardDescription>
        )}
      </CardHeader>
      <div className="flex-1" />
      <CardFooter className="border-t p-3 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={onEdit} data-testid={`button-edit-template-${template.id}`}>
          Edit
        </Button>
        <Button variant="outline" size="sm" className="shrink-0 text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive px-2" onClick={handleDelete} title="Move template to recycle bin" data-testid={`button-delete-template-${template.id}`}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />Recycle
        </Button>
      </CardFooter>
    </Card>
  )
}

function TemplateFormDialog({ 
  open, 
  onOpenChange,
  template 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  template?: ChecklistTemplate;
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const createMutation = useCreateChecklistTemplate()
  const updateMutation = useUpdateChecklistTemplate()
  
  const [name, setName] = React.useState(template?.name || "")
  const [description, setDescription] = React.useState(template?.description || "")
  const [items, setItems] = React.useState<{id: string, title: string}[]>(
    template?.items.map(i => ({ id: i.id.toString(), title: i.title })) || [{ id: "temp-0", title: "" }]
  )

  const isSaving = createMutation.isPending || updateMutation.isPending

  function addItem() {
    setItems([...items, { id: `temp-${Date.now()}`, title: "" }])
  }

  function removeItem(index: number) {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItem(index: number, title: string) {
    const newItems = [...items]
    newItems[index].title = title
    setItems(newItems)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const validItems = items.map(i => i.title.trim()).filter(Boolean)
    if (!name.trim()) {
      toast({ title: "Name is required" })
      return
    }
    if (validItems.length === 0) {
      toast({ title: "At least one item is required" })
      return
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      items: validItems
    }

    if (template) {
      updateMutation.mutate({ id: template.id, data: payload }, {
        onSuccess: () => {
          toast({ title: "Template updated" })
          queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() })
          onOpenChange(false)
        },
        onError: (err) => toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unknown error" })
      })
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          toast({ title: "Template created" })
          queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() })
          onOpenChange(false)
        },
        onError: (err) => toast({ title: "Create failed", description: err instanceof Error ? err.message : "Unknown error" })
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>{template ? "Edit Template" : "New Checklist Template"}</DialogTitle>
            <DialogDescription>Define standard items for field verification or handover.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Pre-pour Inspection" 
                  autoFocus
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea 
                  id="description" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="What is this checklist used for?"
                  rows={2}
                  className="resize-none"
                  data-testid="input-template-desc"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Checklist Items *</Label>
                <span className="text-xs text-muted-foreground">{items.length} items</span>
              </div>
              
              <div className="space-y-2 bg-muted/30 p-3 rounded-lg border">
                {items.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-2 group">
                    <div className="mt-2.5 text-muted-foreground/40 shrink-0">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <Input 
                      value={item.title} 
                      onChange={(e) => updateItem(index, e.target.value)} 
                      placeholder={`Item ${index + 1}`}
                      className="bg-background"
                      data-testid={`input-template-item-${index}`}
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      title="Remove item"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))}
                
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={addItem} 
                  className="mt-2 text-primary"
                  data-testid="button-add-item"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Add Item
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-muted/10">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !name.trim() || !items.some(i => i.title.trim())} data-testid="button-save-template">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {template ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}