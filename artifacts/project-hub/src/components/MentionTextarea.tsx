import * as React from "react"
import { AtSign } from "lucide-react"

import { useListUsers } from "@workspace/api-client-react"
import { Textarea, type TextareaProps } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type MentionTextareaProps = TextareaProps

function getMentionQuery(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor)
  const match = beforeCursor.match(/(?:^|\s)@([a-z0-9._-]*)$/i)
  if (!match) return null
  return {
    query: match[1].toLowerCase(),
    start: beforeCursor.length - match[1].length - 1,
  }
}

export const MentionTextarea = React.forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  ({ value, onChange, onKeyDown, className, ...props }, forwardedRef) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null)
    const { data: users } = useListUsers()
    const [activeIndex, setActiveIndex] = React.useState(0)
    const [mention, setMention] = React.useState<{ query: string; start: number; cursor: number } | null>(null)

    const suggestions = React.useMemo(
      () => (users ?? [])
        .filter((user) => user.active && user.username)
        .filter((user) => user.username!.toLowerCase().startsWith(mention?.query ?? ""))
        .slice(0, 6),
      [mention, users],
    )

    const setRef = React.useCallback((node: HTMLTextAreaElement | null) => {
      internalRef.current = node
      if (typeof forwardedRef === "function") forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    }, [forwardedRef])

    const updateMention = React.useCallback((nextValue: string, cursor: number) => {
      const nextMention = getMentionQuery(nextValue, cursor)
      setMention(nextMention ? { ...nextMention, cursor } : null)
      setActiveIndex(0)
    }, [])

    const insertMention = React.useCallback((username: string) => {
      if (!mention || typeof value !== "string") return
      const nextValue = `${value.slice(0, mention.start)}@${username} ${value.slice(mention.cursor)}`
      const nextCursor = mention.start + username.length + 2
      onChange?.({ target: { value: nextValue } } as React.ChangeEvent<HTMLTextAreaElement>)
      setMention(null)
      requestAnimationFrame(() => {
        internalRef.current?.focus()
        internalRef.current?.setSelectionRange(nextCursor, nextCursor)
      })
    }, [mention, onChange, value])

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(event)
      updateMention(event.target.value, event.target.selectionStart ?? event.target.value.length)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mention && suggestions.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault()
          setActiveIndex((current) => (current + 1) % suggestions.length)
          return
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length)
          return
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault()
          insertMention(suggestions[activeIndex].username!)
          return
        }
        if (event.key === "Escape") {
          event.preventDefault()
          setMention(null)
          return
        }
      }
      onKeyDown?.(event)
    }

    return (
      <div className="relative">
        <Textarea
          {...props}
          ref={setRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={className}
        />
        {mention && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-30 mb-2 w-[min(100%,320px)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
            <p className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <AtSign className="h-3 w-3" /> Mention teammate
            </p>
            {suggestions.map((user, index) => (
              <button
                key={user.id}
                type="button"
                className={cn("flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm", index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertMention(user.username!)}
              >
                <span className="min-w-0 truncate font-medium">{user.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">@{user.username}</span>
              </button>
            ))}
            <p className="px-2 pb-1 pt-1 text-[10px] text-muted-foreground">Use ↑ ↓ and Enter to select</p>
          </div>
        )}
      </div>
    )
  },
)

MentionTextarea.displayName = "MentionTextarea"