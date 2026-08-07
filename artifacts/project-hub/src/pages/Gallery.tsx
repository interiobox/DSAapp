import * as React from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  Cloud,
  ExternalLink,
  FileImage,
  FolderOpen,
  Grid2X2,
  Images,
  Info,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react"

import {
  getGetGalleryAlbumQueryKey,
  getListGalleryAlbumsQueryKey,
  getGalleryAlbum,
  useAdminGetGoogleDriveStatus,
  useCreateGalleryAlbum,
  useDeleteGalleryMedia,
  useGetGalleryAlbum,
  useListGalleryAlbums,
  useListProjects,
} from "@workspace/api-client-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToast } from "@/hooks/use-toast"
import { formatDate, formatDateTime } from "@/lib/utils"

type UploadState = { current: number; total: number; name: string } | null
type Density = "grid" | "list"
type SortMode = "newest" | "oldest" | "name"

async function getApiError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? `Upload failed (${response.status}).`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isVideo(contentType: string) {
  return contentType.startsWith("video/")
}

export default function GalleryPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: projects, isLoading: projectsLoading } = useListProjects()
  const [projectFilter, setProjectFilter] = React.useState("all")
  const albumParams = React.useMemo(() => projectFilter === "all" ? undefined : { projectName: projectFilter }, [projectFilter])
  const albumsQuery = useListGalleryAlbums(albumParams)
  const driveQuery = useAdminGetGoogleDriveStatus()
  const albums = albumsQuery.data
  const [selectedAlbumId, setSelectedAlbumId] = React.useState<number | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [projectName, setProjectName] = React.useState("")
  const [albumName, setAlbumName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [files, setFiles] = React.useState<File[]>([])
  const [uploadState, setUploadState] = React.useState<UploadState>(null)
  const [albumSearch, setAlbumSearch] = React.useState("")
  const [mediaSearch, setMediaSearch] = React.useState("")
  const [density, setDensity] = React.useState<Density>("grid")
  const [sortMode, setSortMode] = React.useState<SortMode>("newest")
  const [selectedMediaIds, setSelectedMediaIds] = React.useState<number[]>([])
  const [previewId, setPreviewId] = React.useState<number | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const createAlbum = useCreateGalleryAlbum()
  const deleteMedia = useDeleteGalleryMedia()
  const selectedAlbum = albums?.find((album) => album.id === selectedAlbumId)
  const albumQuery = useGetGalleryAlbum(selectedAlbumId ?? 0, {
    query: {
      enabled: selectedAlbumId !== null,
      queryKey: getGetGalleryAlbumQueryKey(selectedAlbumId ?? 0),
    },
  })

  React.useEffect(() => {
    if (selectedAlbumId === null && albums?.[0]) setSelectedAlbumId(albums[0].id)
    if (selectedAlbumId !== null && albums && !albums.some((album) => album.id === selectedAlbumId)) {
      setSelectedAlbumId(albums[0]?.id ?? null)
    }
  }, [albums, selectedAlbumId])

  React.useEffect(() => {
    setSelectedMediaIds([])
    setPreviewId(null)
  }, [selectedAlbumId])

  const filteredAlbums = React.useMemo(() => {
    const query = albumSearch.trim().toLowerCase()
    return (albums ?? []).filter((album) => !query || `${album.name} ${album.projectName}`.toLowerCase().includes(query))
  }, [albums, albumSearch])
  const albumDetailQueries = useQueries({
    queries: filteredAlbums.map((album) => ({
      queryKey: getGetGalleryAlbumQueryKey(album.id),
      queryFn: () => getGalleryAlbum(album.id),
      staleTime: 60_000,
    })),
  })
  const albumMediaById = React.useMemo(() => new Map(
    filteredAlbums.map((album, index) => [album.id, albumDetailQueries[index]?.data?.media ?? []]),
  ), [albumDetailQueries, filteredAlbums])

  const media = albumQuery.data?.media ?? []
  const visibleMedia = React.useMemo(() => {
    const query = mediaSearch.trim().toLowerCase()
    return media
      .filter((item) => !query || `${item.fileName} ${item.uploaderName}`.toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortMode === "name") return a.fileName.localeCompare(b.fileName)
        const delta = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
        return sortMode === "newest" ? -delta : delta
      })
  }, [media, mediaSearch, sortMode])
  const previewMedia = media.find((item) => item.id === previewId) ?? null
  const previewIndex = previewMedia ? visibleMedia.findIndex((item) => item.id === previewMedia.id) : -1
  const allVisibleSelected = visibleMedia.length > 0 && visibleMedia.every((item) => selectedMediaIds.includes(item.id))

  function resetCreate() {
    setCreateOpen(false)
    setProjectName("")
    setAlbumName("")
    setDescription("")
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!projectName || !albumName.trim()) return
    createAlbum.mutate({
      data: {
        projectName,
        name: albumName.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      },
    }, {
      onSuccess: (album) => {
        void queryClient.invalidateQueries({ queryKey: getListGalleryAlbumsQueryKey() })
        setSelectedAlbumId(album.id)
        resetCreate()
        toast({ title: "Album created", description: `${album.name} is ready for site media.` })
      },
      onError: (error) => toast({
        title: "Album could not be created",
        description: error instanceof Error ? error.message : "Please try again.",
      }),
    })
  }

  async function handleUpload() {
    if (!selectedAlbumId || files.length === 0) return
    const selectedFiles = [...files]
    setFiles([])
    for (const [index, file] of selectedFiles.entries()) {
      setUploadState({ current: index + 1, total: selectedFiles.length, name: file.name })
      try {
        const response = await fetch(`/api/gallery/albums/${selectedAlbumId}/media`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name),
            "X-File-Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        })
        if (!response.ok) throw new Error(await getApiError(response))
      } catch (error) {
        setUploadState(null)
        toast({
          title: `${file.name} could not be uploaded`,
          description: error instanceof Error ? error.message : "Please try again.",
        })
        return
      }
    }
    setUploadState(null)
    void queryClient.invalidateQueries({ queryKey: getListGalleryAlbumsQueryKey() })
    void queryClient.invalidateQueries({ queryKey: getListGalleryAlbumsQueryKey(albumParams) })
    void queryClient.invalidateQueries({ queryKey: getGetGalleryAlbumQueryKey(selectedAlbumId) })
    toast({ title: "Gallery media uploaded", description: `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} added to ${selectedAlbum?.name ?? "the album"}.` })
  }

  function toggleMedia(id: number) {
    setSelectedMediaIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function toggleAllVisible() {
    setSelectedMediaIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleMedia.some((item) => item.id === id))
      : Array.from(new Set([...current, ...visibleMedia.map((item) => item.id)])))
  }

  function confirmDelete() {
    if (selectedMediaIds.length === 0) return
    setDeleteOpen(true)
  }

  function handleDelete() {
    const ids = [...selectedMediaIds]
    Promise.all(ids.map((id) => new Promise<void>((resolve, reject) => {
      deleteMedia.mutate({ id }, {
        onSuccess: () => resolve(),
        onError: (error) => reject(error),
      })
    }))).then(() => {
      void queryClient.invalidateQueries({ queryKey: getGetGalleryAlbumQueryKey(selectedAlbumId ?? 0) })
      void queryClient.invalidateQueries({ queryKey: getListGalleryAlbumsQueryKey() })
      setSelectedMediaIds([])
      setPreviewId(null)
      setDeleteOpen(false)
      toast({ title: "Media removed", description: `${ids.length} item${ids.length === 1 ? "" : "s"} removed from the album.` })
    }).catch((error) => {
      setDeleteOpen(false)
      toast({ title: "Some media could not be removed", description: error instanceof Error ? error.message : "Please try again." })
    })
  }

  function movePreview(direction: -1 | 1) {
    if (previewIndex < 0 || visibleMedia.length < 2) return
    const next = visibleMedia[(previewIndex + direction + visibleMedia.length) % visibleMedia.length]
    setPreviewId(next.id)
  }

  const driveConnected = driveQuery.data?.connected

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col overflow-hidden" data-testid="gallery-page">
      <header className="flex-none border-b border-border/70 bg-card/95 px-4 py-5 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-sm border border-primary/25 bg-primary/10 p-2 text-primary"><Images className="h-5 w-5" /></div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Visual archive</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl" data-testid="text-gallery-title">Gallery</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Browse project moments by album, then open the full-resolution record when you need it.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-xs ${driveConnected ? "border-emerald-300/60 bg-emerald-50 text-emerald-800" : "border-amber-300/60 bg-amber-50 text-amber-900"}`} data-testid="status-google-drive">
                <span className={`h-2 w-2 rounded-full ${driveConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
                <Cloud className="h-3.5 w-3.5" />
                <span>{driveQuery.isLoading ? "Checking Drive" : driveConnected ? "Google Drive connected" : "Drive not connected"}</span>
                {driveQuery.data?.accountEmail && <span className="hidden border-l border-current/20 pl-2 font-mono text-[10px] sm:inline">{driveQuery.data.accountEmail}</span>}
              </div>
              <Button data-testid="button-new-album" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />New album</Button>
            </div>
          </div>
          {!selectedAlbum && <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input data-testid="input-album-search" value={albumSearch} onChange={(event) => setAlbumSearch(event.target.value)} className="h-11 bg-background pl-9" placeholder="Search albums or projects" />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger data-testid="select-project-filter" className="h-11 w-full bg-background sm:w-[220px]"><SelectValue placeholder="All projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {(projects ?? []).map((project) => <SelectItem data-testid={`option-project-${project.id}`} key={project.id} value={project.name}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-[1500px]">
          {!selectedAlbum ? (
            <section data-testid="albums-browser">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Your albums</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">Albums</h2>
                  <p className="mt-1 text-sm text-muted-foreground" data-testid="text-album-count">{filteredAlbums.length} {filteredAlbums.length === 1 ? "album" : "albums"} in this view</p>
                </div>
                <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"><FolderOpen className="h-4 w-4" />Organized by project</span>
              </div>
              {albumsQuery.isLoading ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[1, 2, 3, 4].map((item) => <div key={item} className="overflow-hidden rounded-md border border-border/70 bg-card"><Skeleton className="aspect-[1.28] w-full" /><div className="space-y-2 p-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>)}
                </div>
              ) : albumsQuery.isError ? (
                <Alert variant="destructive"><AlertTitle>Albums unavailable</AlertTitle><AlertDescription>We could not read the Drive index. Refresh to try again.</AlertDescription></Alert>
              ) : filteredAlbums.length ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredAlbums.map((album, albumIndex) => {
                    const coverMedia = albumMediaById.get(album.id) ?? []
                    const isCoverLoading = albumDetailQueries[albumIndex]?.isLoading
                    return (
                      <button data-testid={`button-album-${album.id}`} key={album.id} type="button" onClick={() => setSelectedAlbumId(album.id)} className="group overflow-hidden rounded-md border border-border/70 bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="relative aspect-[1.28] overflow-hidden bg-muted">
                          {coverMedia.length > 0 ? (
                            <div className="grid h-full grid-cols-2 grid-rows-2 gap-0.5 bg-background">
                              {coverMedia.slice(0, 4).map((item) => isVideo(item.contentType) ? <video key={item.id} className="h-full w-full object-cover" src={`/api/gallery/media/${item.id}`} preload="metadata" /> : <img key={item.id} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" src={`/api/gallery/media/${item.id}`} alt="" loading="lazy" />)}
                              {Array.from({ length: Math.max(0, 4 - coverMedia.length) }).map((_, index) => <div key={`empty-${index}`} className="bg-primary/10" />)}
                            </div>
                          ) : isCoverLoading ? <Skeleton className="h-full w-full rounded-none" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-muted text-primary/65"><Images className="h-12 w-12" /></div>}
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10 text-white"><span className="truncate text-xs font-medium">{album.projectName}</span><span className="font-mono text-[10px]">{album.mediaCount} {album.mediaCount === 1 ? "item" : "items"}</span></div>
                        </div>
                        <div className="space-y-2 p-4">
                          <div className="flex items-start justify-between gap-3"><h3 className="line-clamp-2 text-sm font-semibold leading-snug">{album.name}</h3><ChevronDown className="mt-0.5 h-4 w-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{formatDate(album.createdAt)}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <Card className="rounded-md border-border/70">
                  <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
                    <div className="mb-5 rounded-full border border-dashed border-primary/35 bg-primary/5 p-5 text-primary"><FileImage className="h-10 w-10" /></div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{albumSearch || projectFilter !== "all" ? "No matching albums" : "Your archive is ready"}</p>
                    <h2 className="mt-2 text-xl font-semibold">{albumSearch || projectFilter !== "all" ? "Try another search" : "Create your first album"}</h2>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">{albumSearch || projectFilter !== "all" ? "Clear the filters to see every project album." : "Collect site visits, progress photos, and project moments in one visual archive."}</p>
                    {!albumSearch && projectFilter === "all" && <Button data-testid="button-create-first-album" className="mt-6" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Create first album</Button>}
                  </div>
                </Card>
              )}
            </section>
          ) : (
            <section className="min-w-0">
              <Button type="button" variant="ghost" className="mb-3 -ml-2" onClick={() => setSelectedAlbumId(null)}><ChevronLeft className="mr-1 h-4 w-4" />All albums</Button>
              <Card className="min-w-0 rounded-sm border-border/70">
                <CardHeader className="border-b border-border/50 px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><CardTitle className="truncate text-xl" data-testid={`text-selected-album-${selectedAlbum.id}`}>{selectedAlbum.name}</CardTitle><Badge variant="outline">{media.length} items</Badge></div>
                      <CardDescription className="mt-1">{selectedAlbum.projectName}{selectedAlbum.description ? ` · ${selectedAlbum.description}` : ""}</CardDescription>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{selectedAlbum.uploaderName}</span><span>Created {formatDateTime(selectedAlbum.createdAt)}</span></div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <input data-testid="input-upload-media" id="gallery-upload" type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
                      <Button data-testid="button-choose-media" asChild disabled={Boolean(uploadState)}><label htmlFor="gallery-upload" className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Choose media</label></Button>
                      {files.length > 0 && <Button data-testid="button-upload-media" type="button" onClick={() => void handleUpload()} disabled={Boolean(uploadState)}>{uploadState ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading {uploadState.current}/{uploadState.total}</> : `Upload ${files.length} selected`}</Button>}
                    </div>
                  </div>
                  {files.length > 0 && !uploadState && <p className="mt-3 truncate text-xs text-muted-foreground" data-testid="text-upload-queue">{files.map((file) => file.name).join(" · ")}</p>}
                  {uploadState && <div className="mt-4 space-y-2" data-testid="status-upload-progress"><div className="flex justify-between gap-4 text-xs text-muted-foreground"><span className="truncate">Uploading {uploadState.name} to Google Drive</span><span className="font-mono">{uploadState.current}/{uploadState.total}</span></div><Progress value={(uploadState.current / uploadState.total) * 100} /></div>}
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="mb-5 flex flex-col gap-3 border-b border-border/60 pb-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="relative min-w-0 flex-1 md:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input data-testid="input-media-search" value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} className="pl-9" placeholder="Search files or uploader" /></div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}><SelectTrigger data-testid="select-media-sort" className="w-[150px]"><ChevronDown className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem><SelectItem value="name">File name</SelectItem></SelectContent></Select>
                        <ToggleGroup type="single" value={density} onValueChange={(value) => value && setDensity(value as Density)} variant="outline" size="sm" aria-label="Media density">
                          <ToggleGroupItem data-testid="toggle-grid-density" value="grid" aria-label="Grid view"><Grid2X2 className="h-4 w-4" /></ToggleGroupItem>
                          <ToggleGroupItem data-testid="toggle-list-density" value="list" aria-label="List view"><LayoutList className="h-4 w-4" /></ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                    </div>
                    {visibleMedia.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3"><label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><Checkbox data-testid="checkbox-select-all-media" checked={allVisibleSelected} onCheckedChange={toggleAllVisible} />Select all visible</label>{selectedMediaIds.length > 0 && <div className="flex items-center gap-2"><span className="font-mono text-xs text-primary">{selectedMediaIds.length} selected</span><Button data-testid="button-delete-selected-media" variant="destructive" size="sm" onClick={confirmDelete}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete selected</Button><Button data-testid="button-clear-media-selection" variant="ghost" size="sm" onClick={() => setSelectedMediaIds([])}>Clear</Button></div>}</div>}
                  </div>

                  {albumQuery.isLoading ? (
                    <div className={density === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>{[1, 2, 3].map((item) => <Skeleton data-testid={`skeleton-media-${item}`} key={item} className={density === "grid" ? "aspect-video w-full" : "h-16 w-full"} />)}</div>
                  ) : albumQuery.isError ? (
                    <Alert variant="destructive" data-testid="alert-media-error"><AlertTitle>Media unavailable</AlertTitle><AlertDescription>The album could not be read from Google Drive. Try changing albums or refresh the page.</AlertDescription></Alert>
                  ) : visibleMedia.length ? (
                    <div className={density === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"} data-testid="media-results">
                      {visibleMedia.map((item) => {
                        const selected = selectedMediaIds.includes(item.id)
                        return density === "grid" ? (
                          <article data-testid={`card-media-${item.id}`} key={item.id} className={`group overflow-hidden rounded-sm border bg-card transition-colors ${selected ? "border-primary ring-1 ring-primary" : "border-border/70 hover:border-primary/50"}`}>
                            <div className="relative aspect-video cursor-pointer bg-muted" onClick={() => setPreviewId(item.id)}>
                              {isVideo(item.contentType) ? <video className="h-full w-full object-cover" src={`/api/gallery/media/${item.id}`} preload="metadata" /> : <img data-testid={`img-media-${item.id}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]" src={`/api/gallery/media/${item.id}`} alt={item.fileName} loading="lazy" />}
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                              <Checkbox data-testid={`checkbox-media-${item.id}`} checked={selected} onCheckedChange={() => toggleMedia(item.id)} onClick={(event) => event.stopPropagation()} className="absolute left-3 top-3 border-white bg-slate-900/50 text-white" />
                              <span className="absolute bottom-2 right-2 rounded-sm bg-slate-950/70 px-1.5 py-1 font-mono text-[10px] text-white">{isVideo(item.contentType) ? "VIDEO" : "PHOTO"}</span>
                            </div>
                            <div className="space-y-1 p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium" title={item.fileName} data-testid={`text-media-name-${item.id}`}>{item.fileName}</p><button data-testid={`button-media-menu-${item.id}`} type="button" onClick={() => setPreviewId(item.id)} className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Open ${item.fileName}`}><MoreHorizontal className="h-4 w-4" /></button></div><p className="text-[11px] text-muted-foreground" data-testid={`text-media-meta-${item.id}`}>{item.uploaderName} · {formatDate(item.uploadedAt)} · {formatBytes(item.fileSize)}</p></div>
                          </article>
                        ) : (
                          <article data-testid={`row-media-${item.id}`} key={item.id} className={`flex items-center gap-3 rounded-sm border bg-card p-2 transition-colors sm:p-3 ${selected ? "border-primary bg-primary/5" : "border-border/70 hover:border-primary/50"}`}>
                            <Checkbox data-testid={`checkbox-media-${item.id}`} checked={selected} onCheckedChange={() => toggleMedia(item.id)} />
                            <div className="h-14 w-20 shrink-0 cursor-pointer overflow-hidden rounded-sm bg-muted sm:h-16 sm:w-24" onClick={() => setPreviewId(item.id)}>{isVideo(item.contentType) ? <video className="h-full w-full object-cover" src={`/api/gallery/media/${item.id}`} preload="metadata" /> : <img className="h-full w-full object-cover" src={`/api/gallery/media/${item.id}`} alt={item.fileName} loading="lazy" />}</div>
                            <button data-testid={`button-preview-media-${item.id}`} type="button" onClick={() => setPreviewId(item.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-medium">{item.fileName}</p><p className="mt-1 truncate text-xs text-muted-foreground">{item.uploaderName} · {formatDate(item.uploadedAt)} · {formatBytes(item.fileSize)}</p></button>
                            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{isVideo(item.contentType) ? "Video" : "Photo"}</Badge>
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex min-h-[300px] flex-col items-center justify-center border border-dashed border-border/80 bg-muted/15 px-6 text-center" data-testid="empty-media">
                      <Upload className="mb-4 h-8 w-8 text-primary/45" />
                      <p className="text-sm font-semibold">{mediaSearch ? "No media matches this search" : "This album is empty"}</p>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{mediaSearch ? "Try a different file name or uploader." : "Choose photos or videos to begin the visual record for this site visit."}</p>
                      {!mediaSearch && <Button data-testid="button-empty-upload" variant="outline" className="mt-5" asChild><label htmlFor="gallery-upload" className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Choose media</label></Button>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-sm sm:max-w-lg">
          <DialogHeader><DialogTitle>Create gallery album</DialogTitle><DialogDescription>Media will be filed under Drawing Library / project / album in Google Drive.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div><Label>Project *</Label><Select value={projectName} onValueChange={setProjectName} disabled={projectsLoading}><SelectTrigger data-testid="select-create-project" className="mt-1.5"><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent>{(projects ?? []).map((project) => <SelectItem key={`${project.id}-${project.name}`} value={project.name}>{project.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="gallery-album-name">Album name *</Label><Input data-testid="input-album-name" id="gallery-album-name" className="mt-1.5" value={albumName} onChange={(event) => setAlbumName(event.target.value)} placeholder="Site visit — ground floor" required /></div>
            <div><Label htmlFor="gallery-album-description">Description</Label><Textarea data-testid="input-album-description" id="gallery-album-description" className="mt-1.5 min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does this album document?" /></div>
            <DialogFooter><Button data-testid="button-cancel-create-album" type="button" variant="outline" onClick={resetCreate}>Cancel</Button><Button data-testid="button-submit-create-album" type="submit" disabled={!projectName || !albumName.trim() || createAlbum.isPending}>{createAlbum.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating</> : "Create album"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={previewId !== null} onOpenChange={(open) => !open && setPreviewId(null)}>
        <DialogContent className="max-h-[95dvh] overflow-hidden rounded-sm p-0 sm:max-w-5xl">
          {previewMedia && <div className="flex max-h-[95dvh] flex-col lg:flex-row">
            <div className="relative flex min-h-[280px] flex-1 items-center justify-center bg-slate-950 p-4 sm:min-h-[480px]">
              {isVideo(previewMedia.contentType) ? <video data-testid={`video-preview-${previewMedia.id}`} className="max-h-[70dvh] max-w-full object-contain" src={`/api/gallery/media/${previewMedia.id}`} controls autoPlay /> : <img data-testid={`img-preview-${previewMedia.id}`} className="max-h-[70dvh] max-w-full object-contain" src={`/api/gallery/media/${previewMedia.id}`} alt={previewMedia.fileName} />}
              <button data-testid="button-preview-previous" type="button" onClick={() => movePreview(-1)} className="absolute left-3 top-1/2 rounded-full bg-slate-900/70 p-2 text-white hover:bg-slate-800" aria-label="Previous media"><ArrowLeft className="h-4 w-4" /></button>
              <button data-testid="button-preview-next" type="button" onClick={() => movePreview(1)} className="absolute right-3 top-1/2 rounded-full bg-slate-900/70 p-2 text-white hover:bg-slate-800" aria-label="Next media"><ArrowRight className="h-4 w-4" /></button>
            </div>
            <div className="w-full shrink-0 bg-card p-5 lg:w-80" data-testid={`panel-preview-metadata-${previewMedia.id}`}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Media record</p><h2 className="mt-2 break-words text-lg font-semibold">{previewMedia.fileName}</h2></div><button data-testid="button-close-preview" type="button" onClick={() => setPreviewId(null)} className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close preview"><X className="h-4 w-4" /></button></div>
              <Separator className="my-5" />
              <dl className="space-y-4 text-sm"><div><dt className="text-xs text-muted-foreground">Captured / uploaded</dt><dd className="mt-1" data-testid={`text-preview-date-${previewMedia.id}`}>{formatDateTime(previewMedia.uploadedAt)}</dd></div><div><dt className="text-xs text-muted-foreground">Filed by</dt><dd className="mt-1">{previewMedia.uploaderName}</dd></div><div><dt className="text-xs text-muted-foreground">Format</dt><dd className="mt-1 font-mono text-xs uppercase">{previewMedia.contentType}</dd></div><div><dt className="text-xs text-muted-foreground">File size</dt><dd className="mt-1">{formatBytes(previewMedia.fileSize)}</dd></div><div><dt className="text-xs text-muted-foreground">Record ID</dt><dd className="mt-1 font-mono text-xs">{previewMedia.id}</dd></div></dl>
              <div className="mt-7 grid gap-2"><Button data-testid="button-download-preview" variant="outline" asChild><a href={`/api/gallery/media/${previewMedia.id}`} download={previewMedia.fileName}><ArrowDownToLine className="mr-2 h-4 w-4" />Download</a></Button><Button data-testid="button-open-preview" variant="outline" asChild><a href={`/api/gallery/media/${previewMedia.id}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open original</a></Button><Button data-testid="button-select-preview" variant={selectedMediaIds.includes(previewMedia.id) ? "secondary" : "ghost"} onClick={() => toggleMedia(previewMedia.id)}>{selectedMediaIds.includes(previewMedia.id) ? <><Check className="mr-2 h-4 w-4" />Selected</> : "Select media"}</Button></div>
              <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" />{previewIndex + 1} of {visibleMedia.length} in this view</div>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader><AlertDialogTitle>Delete selected media?</AlertDialogTitle><AlertDialogDescription>This will remove {selectedMediaIds.length} item{selectedMediaIds.length === 1 ? "" : "s"} from the album and Google Drive. This action cannot be undone from the gallery.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-delete-media">Cancel</AlertDialogCancel><AlertDialogAction data-testid="button-confirm-delete-media" onClick={(event) => { event.preventDefault(); handleDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleteMedia.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Removing</> : "Delete media"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}