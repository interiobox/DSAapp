import * as React from "react"
import { Download, ExternalLink, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"

type PreviewKind = "pdf" | "image" | "source"

type SheetPreviewProps = {
  filePath: string | null | undefined
  fileName: string | null | undefined
  contentType?: string | null
  className?: string
}

function getFileExtension(fileName: string | null | undefined) {
  return fileName?.split(".").pop()?.toLowerCase() ?? ""
}

function getPreviewKind(fileName: string | null | undefined, contentType: string | null | undefined): PreviewKind {
  const type = contentType?.toLowerCase() ?? ""
  const extension = getFileExtension(fileName)
  if (type === "application/pdf" || extension === "pdf") return "pdf"
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(extension)) return "image"
  return "source"
}

export function getStorageObjectUrl(filePath: string | null | undefined) {
  if (!filePath) return null
  if (filePath.startsWith("/api/storage/")) return filePath
  if (filePath.startsWith("/objects/")) return `/api/storage${filePath}`
  if (filePath.startsWith("/drive/files/")) return `/api/storage/drive-files/${encodeURIComponent(filePath.slice("/drive/files/".length))}`
  return filePath
}

export function SheetPreview({ filePath, fileName, contentType, className = "" }: SheetPreviewProps) {
  const [hasError, setHasError] = React.useState(false)
  const fileUrl = getStorageObjectUrl(filePath)
  const kind = getPreviewKind(fileName, contentType)

  React.useEffect(() => {
    setHasError(false)
  }, [filePath, fileName, contentType])

  if (!fileUrl) {
    return (
      <div className={`flex aspect-[4/3] items-center justify-center rounded-md border border-dashed bg-muted/20 ${className}`}>
        <div className="text-center text-muted-foreground">
          <FileText className="mx-auto mb-2 h-10 w-10 opacity-20" />
          <p className="text-xs font-mono font-medium uppercase tracking-widest opacity-60">No sheet attached</p>
          <p className="mt-1 text-xs opacity-70">Upload a PDF or image to preview this sheet.</p>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className={`flex aspect-[4/3] items-center justify-center rounded-md border border-dashed bg-muted/20 p-6 ${className}`}>
        <div className="max-w-xs text-center">
          <FileText className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">Preview unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">The stored file could not be rendered here. Open the source file instead.</p>
          <Button asChild size="sm" variant="outline" className="mt-4">
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />Open file
            </a>
          </Button>
        </div>
      </div>
    )
  }

  if (kind === "pdf") {
    return (
      <div className={`relative aspect-[4/3] overflow-hidden rounded-md border bg-muted/20 ${className}`}>
        <iframe
          title={fileName ? `Preview of ${fileName}` : "Sheet preview"}
          src={fileUrl}
          className="h-full w-full"
          onError={() => setHasError(true)}
        />
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-sm border bg-background/90 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground shadow-sm">
          PDF preview
        </div>
      </div>
    )
  }

  if (kind === "image") {
    return (
      <div className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border bg-muted/20 ${className}`}>
        <img
          src={fileUrl}
          alt={fileName ? `Preview of ${fileName}` : "Sheet preview"}
          className="h-full w-full object-contain"
          onError={() => setHasError(true)}
        />
      </div>
    )
  }

  return (
    <div className={`flex aspect-[4/3] items-center justify-center rounded-md border border-dashed bg-muted/20 p-6 ${className}`}>
      <div className="max-w-xs text-center">
        <FileText className="mx-auto mb-2 h-10 w-10 text-primary/50" />
        <p className="text-sm font-medium">Source file attached</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {fileName || "This file"} is available to open, but this format cannot be rendered in the browser.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild size="sm">
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />Open file
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={fileUrl} download={fileName || undefined}>
              <Download className="mr-2 h-4 w-4" />Download
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}