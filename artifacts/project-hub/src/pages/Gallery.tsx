import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Film, Image as ImageIcon, Images, Loader2, Plus, Upload, UserRound } from "lucide-react"

import {
  getGetGalleryAlbumQueryKey,
  getListGalleryAlbumsQueryKey,
  useCreateGalleryAlbum,
  useGetGalleryAlbum,
  useListGalleryAlbums,
  useListProjects,
} from "@workspace/api-client-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { formatDate, formatDateTime } from "@/lib/utils"

type UploadState = { current: number; total: number; name: string } | null

async function getApiError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? `Upload failed (${response.status}).`
}

export default function GalleryPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: projects, isLoading: projectsLoading } = useListProjects()
  const { data: albums, isLoading: albumsLoading } = useListGalleryAlbums()
  const [selectedAlbumId, setSelectedAlbumId] = React.useState<number | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [projectName, setProjectName] = React.useState("")
  const [albumName, setAlbumName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [files, setFiles] = React.useState<File[]>([])
  const [uploadState, setUploadState] = React.useState<UploadState>(null)
  const createAlbum = useCreateGalleryAlbum()
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
        toast({ title: "Album created", description: `${album.name} is ready for photos and videos.` })
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
    void queryClient.invalidateQueries({ queryKey: getGetGalleryAlbumQueryKey(selectedAlbumId) })
    toast({ title: "Gallery media uploaded", description: `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} added to ${selectedAlbum?.name ?? "the album"}.` })
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex-none border-b bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Images className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Project Gallery</h1>
              <p className="mt-1 text-sm text-muted-foreground">Capture site photos and videos in project albums, organized automatically in Google Drive.</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />New album</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-fit rounded-sm border-border/60">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base">Albums</CardTitle>
              <CardDescription>{albums?.length ?? 0} project albums</CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              {albumsLoading ? (
                <div className="space-y-2 p-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
              ) : albums?.length ? (
                <div className="space-y-1">
                  {albums.map((album) => (
                    <button
                      key={album.id}
                      type="button"
                      onClick={() => setSelectedAlbumId(album.id)}
                      className={`w-full rounded-sm px-3 py-3 text-left transition-colors ${selectedAlbumId === album.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{album.name}</span>
                        <span className={`shrink-0 font-mono text-xs ${selectedAlbumId === album.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{album.mediaCount}</span>
                      </div>
                      <p className={`mt-1 truncate text-xs ${selectedAlbumId === album.id ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{album.projectName}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">No albums yet. Create one to start collecting project media.</div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-sm border-border/60">
            {!selectedAlbum ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                <Images className="mb-4 h-12 w-12 text-primary/40" />
                <h2 className="text-lg font-semibold">Build your project gallery</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">Create an album, choose its project, and upload multiple site photos or videos together.</p>
                <Button className="mt-5" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Create first album</Button>
              </div>
            ) : (
              <>
                <CardHeader className="border-b border-border/50">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-xl">{selectedAlbum.name}</CardTitle>
                      <CardDescription className="mt-1">{selectedAlbum.projectName}{selectedAlbum.description ? ` · ${selectedAlbum.description}` : ""}</CardDescription>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{selectedAlbum.uploaderName}</span>
                        <span>Created {formatDateTime(selectedAlbum.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      <input
                        id="gallery-upload"
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="sr-only"
                        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                      />
                      <Button asChild disabled={Boolean(uploadState)}>
                        <label htmlFor="gallery-upload" className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Choose photos/videos</label>
                      </Button>
                      {files.length > 0 && (
                        <Button type="button" size="sm" onClick={() => void handleUpload()} disabled={Boolean(uploadState)}>
                          {uploadState ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading {uploadState.current}/{uploadState.total}</> : `Upload ${files.length} selected`}
                        </Button>
                      )}
                    </div>
                  </div>
                  {files.length > 0 && !uploadState && <p className="mt-3 text-xs text-muted-foreground">{files.map((file) => file.name).join(" · ")}</p>}
                  {uploadState && <p className="mt-3 text-xs text-muted-foreground">Uploading {uploadState.name} ({uploadState.current} of {uploadState.total}) to Google Drive…</p>}
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {albumQuery.isLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="aspect-video w-full" />)}</div>
                  ) : albumQuery.data?.media.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {albumQuery.data.media.map((media) => (
                        <div key={media.id} className="overflow-hidden rounded-sm border border-border/70 bg-muted/20">
                          <div className="aspect-video bg-muted">
                            {media.contentType.startsWith("video/") ? (
                              <video className="h-full w-full object-cover" src={`/api/gallery/media/${media.id}`} controls preload="metadata" />
                            ) : (
                              <a href={`/api/gallery/media/${media.id}`} target="_blank" rel="noreferrer" className="block h-full">
                                <img className="h-full w-full object-cover transition-transform hover:scale-[1.02]" src={`/api/gallery/media/${media.id}`} alt={media.fileName} loading="lazy" />
                              </a>
                            )}
                          </div>
                          <div className="space-y-1 p-3">
                            <p className="truncate text-sm font-medium" title={media.fileName}>{media.fileName}</p>
                            <p className="text-[11px] text-muted-foreground">{media.uploaderName} · {formatDate(media.uploadedAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[280px] flex-col items-center justify-center text-center text-muted-foreground">
                      <Upload className="mb-3 h-9 w-9 opacity-35" />
                      <p className="text-sm font-medium">This album is empty</p>
                      <p className="mt-1 text-xs">Choose multiple photos or videos to upload them to the project album.</p>
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>Create gallery album</DialogTitle>
            <DialogDescription>Album metadata is recorded automatically with your name and the creation date. Media will be stored under the selected project and album in Google Drive.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Project *</Label>
              <Select value={projectName} onValueChange={setProjectName} disabled={projectsLoading}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose a project" /></SelectTrigger>
                <SelectContent>{(projects ?? []).map((project) => <SelectItem key={`${project.id}-${project.name}`} value={project.name}>{project.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="gallery-album-name">Album name *</Label>
              <Input id="gallery-album-name" className="mt-1.5" value={albumName} onChange={(event) => setAlbumName(event.target.value)} placeholder="e.g. Site visit — ground floor" required />
            </div>
            <div>
              <Label htmlFor="gallery-album-description">Description</Label>
              <Textarea id="gallery-album-description" className="mt-1.5 min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does this album document?" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetCreate}>Cancel</Button>
              <Button type="submit" disabled={!projectName || !albumName.trim() || createAlbum.isPending}>{createAlbum.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create album"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}