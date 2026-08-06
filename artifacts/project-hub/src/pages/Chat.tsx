import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Download,
  Edit3,
  FileText,
  Hash,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react"

import {
  getListChatChannelsQueryKey,
  getListChatMessagesQueryKey,
  getListUsersQueryKey,
  useCreateChatChannel,
  useCreateChatDirectMessage,
  useCreateChatMessage,
  useDeleteChatMessage,
  useJoinChatChannel,
  useLeaveChatChannel,
  useListChatChannels,
  useListChatMessages,
  useListUsers,
  useMarkChatChannelRead,
  useSearchChatMessages,
  useToggleChatMessageReaction,
  useUpdateChatMessage,
} from "@workspace/api-client-react"
import type { ChatChannel, ChatMessage } from "@workspace/api-client-react"
import { usePortalAuth } from "@/App"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { MentionTextarea } from "@/components/MentionTextarea"
import { useToast } from "@/hooks/use-toast"
import { cn, formatTime, formatDate } from "@/lib/utils"
import { Link } from "wouter"

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U"
}

function conversationName(channel: ChatChannel) {
  if (channel.channelType === "direct") {
    return channel.description?.replace("Direct conversation with ", "") || "Direct message"
  }
  return channel.name
}

function conversationPreview(channel: ChatChannel, currentUserName?: string) {
  if (channel.lastMessageContent) {
    const author = channel.lastMessageAuthorName === currentUserName ? "You" : channel.lastMessageAuthorName
    return author ? `${author}: ${channel.lastMessageContent}` : channel.lastMessageContent
  }
  if (channel.lastMessageAttachmentName) return `File: ${channel.lastMessageAttachmentName}`
  if (channel.description) return channel.description
  return channel.channelType === "direct" ? "Private conversation" : "No messages yet"
}

function conversationTime(dateString: string) {
  return formatTime(dateString).replace(" IST", "")
}

function conversationAvatarClass(channel: ChatChannel) {
  const palette = [
    "bg-[#dce9ff] text-[#245bb3]",
    "bg-[#dff4e9] text-[#197044]",
    "bg-[#fff0d9] text-[#9a5c08]",
    "bg-[#f1e3ff] text-[#7443a8]",
  ]
  return palette[channel.id % palette.length]
}

function formatMessageTime(dateString: string) {
  return formatTime(dateString)
}

function formatMessageDate(dateString: string) {
  return formatDate(dateString)
}

function formatFileSize(size: number | null | undefined) {
  if (!size || size < 1024) return `${size ?? 0} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getAttachmentUrl(path: string | null | undefined) {
  if (!path) return null
  return path.startsWith("/objects/") ? `/api/storage${path}` : path
}

export default function ChatPage() {
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(() => {
    const value = new URLSearchParams(window.location.search).get("channelId")
    return value ? Number(value) : null
  })
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(() => {
    return Boolean(new URLSearchParams(window.location.search).get("channelId"))
  })
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false)
  const [isDirectDialogOpen, setIsDirectDialogOpen] = useState(false)
  const [channelName, setChannelName] = useState("")
  const [channelDescription, setChannelDescription] = useState("")
  const [message, setMessage] = useState("")
  const [conversationSearch, setConversationSearch] = useState("")
  const [messageSearch, setMessageSearch] = useState("")
  const [isGlobalSearch, setIsGlobalSearch] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [directUserId, setDirectUserId] = useState<number | null>(null)
  const [attachment, setAttachment] = useState<{
    path: string
    name: string
    size: number
    contentType: string
  } | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messageEndRef = useRef<HTMLDivElement | null>(null)

  const channelsQuery = useListChatChannels({
    query: {
      queryKey: getListChatChannelsQueryKey(),
      refetchInterval: 15000,
    },
  })
  const channels = channelsQuery.data ?? []
  const activeChannel = channels.find((channel) => channel.id === selectedChannelId) ?? channels[0] ?? null
  const activeChannelId = activeChannel?.id ?? 0
  const messagesQuery = useListChatMessages(activeChannelId, {
    query: {
      enabled: Boolean(activeChannel),
      queryKey: getListChatMessagesQueryKey(activeChannelId),
      refetchInterval: 5000,
    },
  })
  const messages = messagesQuery.data ?? []
  const globalSearchQuery = useSearchChatMessages(
    { query: messageSearch.trim() || "x" },
    { query: { enabled: isGlobalSearch && messageSearch.trim().length > 0, queryKey: ["/api/chat/search", messageSearch.trim()] } },
  )
  const filteredMessages = useMemo(() => {
    const query = messageSearch.trim().toLocaleLowerCase()
    if (!query) return messages
    return messages.filter((item) => `${item.authorName} ${item.content}`.toLocaleLowerCase().includes(query))
  }, [messageSearch, messages])

  const createChannel = useCreateChatChannel()
  const createDirectMessage = useCreateChatDirectMessage()
  const createMessage = useCreateChatMessage()
  const updateMessage = useUpdateChatMessage()
  const deleteMessage = useDeleteChatMessage()
  const toggleReaction = useToggleChatMessageReaction()
  const joinChannel = useJoinChatChannel()
  const leaveChannel = useLeaveChatChannel()
  const markChannelRead = useMarkChatChannelRead()
  const usersQuery = useListUsers({ query: { enabled: isDirectDialogOpen, queryKey: getListUsersQueryKey() } })
  const visibleChannels = useMemo(() => {
    const query = conversationSearch.trim().toLocaleLowerCase()
    return [...channels]
      .filter((channel) => `${conversationName(channel)} ${channel.description ?? ""}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime()
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime()
        return bTime - aTime
      })
  }, [channels, conversationSearch])

  useEffect(() => {
    if (!selectedChannelId && channels[0]) setSelectedChannelId(channels[0].id)
    if (selectedChannelId && channels.length && !channels.some((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(channels[0]?.id ?? null)
    }
  }, [channels, selectedChannelId])

  useEffect(() => {
    setMessageSearch("")
    setReplyTo(null)
    setEditingMessageId(null)
    if (activeChannelId) {
      markChannelRead.mutate({ channelId: activeChannelId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChatChannelsQueryKey() }),
      })
    }
  }, [activeChannelId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, activeChannelId])

  function submitMessage() {
    const content = message.trim()
    if ((!content && !attachment) || !activeChannel || !activeChannel.joined) return
    createMessage.mutate({
      channelId: activeChannel.id,
      data: {
        content: content || undefined,
        attachmentPath: attachment?.path,
        attachmentName: attachment?.name,
        attachmentSize: attachment?.size,
        attachmentContentType: attachment?.contentType,
        replyToId: replyTo?.id,
      },
    }, {
      onSuccess: (created) => {
        setMessage("")
        setAttachment(null)
        setReplyTo(null)
        queryClient.setQueryData<ChatMessage[]>(getListChatMessagesQueryKey(activeChannel.id), (current) => [...(current ?? []), created])
      },
      onError: (error) => toast({ title: "Message could not be sent", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }

  function beginEdit(item: ChatMessage) {
    setEditingMessageId(item.id)
    setEditingContent(item.content)
  }

  function saveEdit(item: ChatMessage) {
    const content = editingContent.trim()
    if (!content) return
    updateMessage.mutate({ messageId: item.id, data: { content } }, {
      onSuccess: (updated) => {
        queryClient.setQueryData<ChatMessage[]>(getListChatMessagesQueryKey(item.channelId), (current) => (current ?? []).map((entry) => entry.id === updated.id ? updated : entry))
        setEditingMessageId(null)
        setEditingContent("")
      },
      onError: (error) => toast({ title: "Message could not be edited", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }

  function removeMessage(item: ChatMessage) {
    if (!window.confirm("Delete this message?")) return
    deleteMessage.mutate({ messageId: item.id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey(item.channelId) }),
      onError: (error) => toast({ title: "Message could not be deleted", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }

  function reactToMessage(item: ChatMessage, emoji: string) {
    toggleReaction.mutate({ messageId: item.id, data: { emoji } }, {
      onSuccess: (reactions) => {
        queryClient.setQueryData<ChatMessage[]>(getListChatMessagesQueryKey(item.channelId), (current) => (current ?? []).map((entry) => entry.id === item.id ? { ...entry, reactions } : entry))
      },
    })
  }

  function submitDirectMessage() {
    if (!directUserId) return
    createDirectMessage.mutate({ data: { userId: directUserId } }, {
      onSuccess: (channel) => {
        setIsDirectDialogOpen(false)
        setDirectUserId(null)
        setSelectedChannelId(channel.id)
        setIsMobileChatOpen(true)
        queryClient.invalidateQueries({ queryKey: getListChatChannelsQueryKey() })
      },
      onError: (error) => toast({ title: "Direct chat could not be opened", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !activeChannel?.joined) return
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File is too large", description: "Chat files must be 25 MB or smaller." })
      return
    }
    setIsUploading(true)
    try {
      const response = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Could not prepare the upload.")
      const upload = await response.json() as { uploadURL: string; objectPath: string }
      const uploadResponse = await fetch(upload.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!uploadResponse.ok) throw new Error("Could not upload the file.")
      setAttachment({
        path: upload.objectPath,
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      })
    } catch (error) {
      toast({ title: "File could not be attached", description: error instanceof Error ? error.message : "Please try again." })
    } finally {
      setIsUploading(false)
    }
  }

  function joinActiveChannel() {
    if (!activeChannel) return
    joinChannel.mutate({ channelId: activeChannel.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChatChannelsQueryKey() })
        toast({ title: `Joined #${activeChannel.name}` })
      },
      onError: (error) => toast({ title: "Could not join channel", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }

  function leaveActiveChannel() {
    if (!activeChannel) return
    leaveChannel.mutate({ channelId: activeChannel.id }, {
      onSuccess: () => {
        setAttachment(null)
        queryClient.invalidateQueries({ queryKey: getListChatChannelsQueryKey() })
        toast({ title: `Left #${activeChannel.name}` })
      },
      onError: (error) => toast({ title: "Could not leave channel", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }

  function submitChannel() {
    const name = channelName.trim()
    if (!name) {
      toast({ title: "Channel name is required" })
      return
    }
    createChannel.mutate({ data: { name, description: channelDescription.trim() || undefined } }, {
      onSuccess: (created) => {
        setChannelName("")
        setChannelDescription("")
        setIsChannelDialogOpen(false)
        setSelectedChannelId(created.id)
        setIsMobileChatOpen(true)
        queryClient.invalidateQueries({ queryKey: getListChatChannelsQueryKey() })
      },
      onError: (error) => toast({ title: "Channel could not be created", description: error instanceof Error ? error.message : "Please try another name." }),
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f8fa]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className={cn("w-full shrink-0 flex-col border-r bg-white md:w-[290px] lg:w-[320px]", isMobileChatOpen ? "hidden md:flex" : "flex")}>
          <div className="border-b px-4 py-4">
            <div className="flex items-center justify-between">
            <div>
                <p className="text-lg font-bold tracking-tight text-foreground">Chats</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{channels.length} conversation{channels.length === 1 ? "" : "s"}</p>
            </div>
              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary" title="Notifications" data-testid="button-chat-notifications">
                  <Link href="/notifications"><Bell className="h-4 w-4" /></Link>
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => setIsDirectDialogOpen(true)} title="Start a direct message" data-testid="button-create-direct-chat">
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => setIsChannelDialogOpen(true)} title="Create channel" data-testid="button-create-channel">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search conversations"
                placeholder="Search conversations"
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                className="h-9 rounded-lg border-0 bg-[#f1f3f5] pl-9 pr-8 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                data-testid="input-search-conversations"
              />
              {conversationSearch && (
                <button type="button" aria-label="Clear conversation search" onClick={() => setConversationSearch("")} className="absolute right-2 top-2 rounded-sm text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
                <div className="mb-1 flex items-center gap-2 px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">All conversations</p>
                </div>
                <div>
                  {channelsQuery.isLoading ? (
                    <div className="space-y-1 px-1"><Skeleton className="h-[72px] w-full" /><Skeleton className="h-[72px] w-full" /><Skeleton className="h-[72px] w-full" /></div>
                  ) : visibleChannels.length ? visibleChannels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => {
                        setSelectedChannelId(channel.id)
                        setIsMobileChatOpen(true)
                      }}
                      className={cn("group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors", activeChannel?.id === channel.id ? "bg-[#eaf2ff] text-foreground" : "hover:bg-[#f5f7fa]")}
                      data-testid={`button-channel-${channel.id}`}
                    >
                       <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", conversationAvatarClass(channel))}>
                         {channel.channelType === "direct" ? <MessageSquare className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
                       </div>
                       <div className="min-w-0 flex-1">
                         <div className="flex items-center justify-between gap-2">
                           <span className="truncate text-sm font-semibold">{conversationName(channel)}</span>
                            <span className={cn("shrink-0 text-[10px]", channel.unreadCount > 0 ? "font-semibold text-primary" : "text-muted-foreground")}>{channel.lastMessageAt ? conversationTime(channel.lastMessageAt) : channel.unreadCount > 0 ? "New" : " "}</span>
                         </div>
                         <div className="mt-1 flex items-center gap-2">
                            <span className={cn("min-w-0 flex-1 truncate text-xs", channel.unreadCount > 0 ? "font-medium text-foreground/80" : "text-muted-foreground")}>{conversationPreview(channel, user?.name)}</span>
                           {channel.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{channel.unreadCount > 99 ? "99+" : channel.unreadCount}</span>}
                         </div>
                       </div>
                       <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground/0 transition-opacity group-hover:text-muted-foreground/50", activeChannel?.id === channel.id && "text-primary/40")} />
                    </button>
                  )) : (
                    <div className="px-4 py-10 text-center">
                      <Search className="mx-auto h-6 w-6 text-muted-foreground/50" />
                      <p className="mt-2 text-xs font-medium">No conversations found</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">Try another name or create a new channel.</p>
                    </div>
                  )}
                </div>
                <div className="mx-2 mt-5 rounded-xl border border-primary/10 bg-primary/[0.04] p-3">
                  <p className="text-xs font-semibold text-foreground">Keep work moving</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Use channels for decisions, handover notes, and quick site coordination.</p>
                </div>
            </div>
          </ScrollArea>
        </aside>

        <main className={cn("min-w-0 flex-1 flex-col bg-white", isMobileChatOpen ? "flex" : "hidden md:flex")}>
          <div className="flex flex-none flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {activeChannel ? (
              <>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                     <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full md:hidden" onClick={() => setIsMobileChatOpen(false)} aria-label="Back to conversations" data-testid="button-back-to-chat-list">
                       <ArrowLeft className="h-4 w-4" />
                     </Button>
                     {activeChannel.channelType === "direct" ? <MessageSquare className="h-5 w-5 text-primary" /> : <Hash className="h-5 w-5 text-primary" />}
                     <h2 className="truncate text-base font-bold">{conversationName(activeChannel)}</h2>
                      {!activeChannel.joined && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Not joined</span>}
                  </div>
                  <p className="mt-1 truncate pl-7 text-xs text-muted-foreground">{activeChannel.description || "A place for the team to talk."}</p>
                </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <div className="relative hidden sm:block">
                      <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        aria-label="Search messages"
                        placeholder={isGlobalSearch ? "Search all messages" : "Search messages"}
                        value={messageSearch}
                        onChange={(event) => setMessageSearch(event.target.value)}
                        className="h-8 w-40 rounded-full border-0 bg-[#f1f3f5] pl-8 pr-7 text-[11px] shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                        data-testid="input-search-chat"
                      />
                      {messageSearch && <button type="button" aria-label="Clear message search" onClick={() => setMessageSearch("")} className="absolute right-2 top-1.5 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>}
                    </div>
                    <Button variant={isGlobalSearch ? "default" : "ghost"} size="icon" className="h-8 w-8 rounded-full" title="Toggle global message search" onClick={() => setIsGlobalSearch((value) => !value)} data-testid="button-toggle-global-chat-search">
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Notifications" data-testid="button-chat-room-notifications">
                      <Link href="/notifications"><Bell className="h-4 w-4" /></Link>
                    </Button>
                   {activeChannel.joined ? (
                     <Button variant="outline" size="sm" onClick={leaveActiveChannel} disabled={leaveChannel.isPending || activeChannel.createdBy === user?.id} title={activeChannel.createdBy === user?.id ? "Channel creators cannot leave their channel" : "Leave channel"} data-testid="button-leave-chat-channel">
                       {leaveChannel.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogOut className="mr-1.5 h-3.5 w-3.5" />}<span className="hidden sm:inline">Leave</span>
                     </Button>
                   ) : (
                     <Button size="sm" onClick={joinActiveChannel} disabled={joinChannel.isPending} data-testid="button-join-chat-channel">
                       {joinChannel.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogIn className="mr-1.5 h-3.5 w-3.5" />}Join
                     </Button>
                   )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a channel to start chatting.</p>
            )}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto max-w-4xl px-4 py-5 sm:px-8 sm:py-7">
              {messagesQuery.isLoading ? (
                <div className="space-y-5"><Skeleton className="h-16 w-3/4" /><Skeleton className="h-16 w-2/3" /><Skeleton className="ml-8 h-20 w-4/5" /></div>
              ) : !activeChannel ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageSquare className="h-7 w-7" /></div>
                  <h3 className="text-lg font-semibold">Start a team conversation</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">Create your first channel for a project decision, site update, or drawing review.</p>
                  <Button className="mt-5" onClick={() => setIsChannelDialogOpen(true)} data-testid="button-create-first-channel"><Plus className="mr-2 h-4 w-4" />Create channel</Button>
                </div>
               ) : isGlobalSearch && messageSearch.trim() ? (
                 <div className="space-y-3">
                   <div className="rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                     Searching across joined channels for “{messageSearch.trim()}”
                   </div>
                   {globalSearchQuery.isLoading ? (
                     <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-11/12" /></div>
                   ) : globalSearchQuery.data?.length ? (
                     globalSearchQuery.data.map((item) => (
                       <button
                         key={item.id}
                         type="button"
                         className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
                         onClick={() => {
                           setSelectedChannelId(item.channelId)
                           setIsGlobalSearch(false)
                         }}
                       >
                         <div className="flex items-center justify-between gap-3">
                           <span className="text-xs font-semibold">#{item.channelName}</span>
                           <span className="text-[10px] text-muted-foreground">{formatMessageDate(item.createdAt)}</span>
                         </div>
                         <p className="mt-1 text-xs text-muted-foreground">{item.authorName}</p>
                         <p className="mt-1 line-clamp-2 text-sm">{item.content || item.attachmentName || "Attachment"}</p>
                       </button>
                     ))
                   ) : (
                     <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                       <Search className="mb-3 h-9 w-9 text-muted-foreground/60" />
                       <h3 className="font-semibold">No messages found</h3>
                       <p className="mt-1 max-w-sm text-sm text-muted-foreground">Try a different word, phrase, or teammate name.</p>
                     </div>
                   )}
                 </div>
               ) : messages.length && filteredMessages.length ? (
                <div className="space-y-1">
                  <div className="mb-6 border-b pb-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Hash className="h-6 w-6" /></div>
                     <h3 className="mt-3 text-xl font-bold">Welcome to {activeChannel.channelType === "direct" ? conversationName(activeChannel) : `#${activeChannel.name}`}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{activeChannel.description || "This is the beginning of this channel."}</p>
                  </div>
                  {messageSearch && (
                    <p className="mb-3 rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                      Showing {filteredMessages.length} {filteredMessages.length === 1 ? "message" : "messages"} matching “{messageSearch}”
                    </p>
                  )}
                   {filteredMessages.map((item, index) => (
                     <MessageRow
                       key={item.id}
                       message={item}
                       previous={messageSearch ? undefined : filteredMessages[index - 1]}
                       currentUserId={user?.id}
                       isAdmin={user?.role === "admin"}
                       editingMessageId={editingMessageId}
                       editingContent={editingContent}
                       onEditingContentChange={setEditingContent}
                       onBeginEdit={beginEdit}
                       onSaveEdit={saveEdit}
                       onDelete={removeMessage}
                       onReply={setReplyTo}
                       onReact={reactToMessage}
                     />
                  ))}
                  <div ref={messageEndRef} />
                </div>
              ) : messageSearch ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                  <Search className="mb-3 h-9 w-9 text-muted-foreground/60" />
                  <h3 className="font-semibold">No messages found</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">Try a different word, phrase, or teammate name.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setMessageSearch("")}>Clear search</Button>
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col justify-end">
                  <div className="mb-4 border-b pb-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Hash className="h-6 w-6" /></div>
                     <h3 className="mt-3 text-xl font-bold">Welcome to {activeChannel.channelType === "direct" ? conversationName(activeChannel) : `#${activeChannel.name}`}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{activeChannel.description || "Start the conversation with your team."}</p>
                  </div>
                  <div ref={messageEndRef} />
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex-none border-t bg-white px-4 py-3 sm:px-6">
            <div className="mx-auto max-w-4xl">
               {replyTo && (
                 <div className="mb-2 flex items-center gap-2 rounded-md border bg-primary/[0.04] px-3 py-2 text-xs">
                   <Reply className="h-3.5 w-3.5 text-primary" />
                   <span className="min-w-0 flex-1 truncate">Replying to <strong>{replyTo.authorName}</strong>: {replyTo.content || replyTo.attachmentName}</span>
                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="h-3.5 w-3.5" /></Button>
                 </div>
               )}
              <div className="flex items-end gap-2 rounded-xl border bg-[#f7f8fa] p-2 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                 <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
                 <Button variant="ghost" size="icon" className="mb-0.5 h-9 w-9 shrink-0 text-muted-foreground" title={activeChannel?.joined ? "Attach a file" : "Join this channel to attach files"} onClick={() => fileInputRef.current?.click()} disabled={!activeChannel?.joined || isUploading} data-testid="button-attach-chat-file">
                   {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                 </Button>
                <MentionTextarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      submitMessage()
                    }
                  }}
                   placeholder={activeChannel ? `Message ${activeChannel.channelType === "direct" ? conversationName(activeChannel) : `#${activeChannel.name}`}` : "Select a channel"}
                   disabled={!activeChannel?.joined || createMessage.isPending || isUploading}
                  rows={1}
                  className="max-h-32 min-h-9 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"
                  data-testid="input-chat-message"
                />
                 <Button size="icon" className="mb-0.5 h-9 w-9 shrink-0" onClick={submitMessage} disabled={!activeChannel?.joined || (!message.trim() && !attachment) || createMessage.isPending || isUploading} title="Send message" data-testid="button-send-chat-message">
                  {createMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
               {attachment && (
                 <div className="mt-2 flex items-center gap-2 rounded-md border bg-primary/[0.04] px-3 py-2 text-xs">
                   <FileText className="h-4 w-4 shrink-0 text-primary" />
                   <span className="min-w-0 flex-1 truncate font-medium">{attachment.name}</span>
                   <span className="shrink-0 text-muted-foreground">{formatFileSize(attachment.size)}</span>
                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachment(null)} aria-label="Remove attachment" data-testid="button-remove-chat-attachment"><X className="h-3.5 w-3.5" /></Button>
                 </div>
               )}
               <p className="mt-2 px-1 text-[10px] text-muted-foreground">{activeChannel?.joined ? "Press Enter to send · Shift + Enter for a new line · Mention teammates with @username" : "Join this channel to send messages and files."}</p>
            </div>
          </div>
        </main>

      </div>

       <Dialog open={isChannelDialogOpen} onOpenChange={(open) => {
         setIsChannelDialogOpen(open)
         if (!open) {
           setChannelName("")
           setChannelDescription("")
         }
       }}>
         <DialogContent className="overflow-hidden p-0 sm:max-w-[520px]">
           <DialogHeader className="border-b bg-[#eef5ff] px-6 py-6">
             <div className="flex items-start gap-4">
               <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                 <Hash className="h-6 w-6" />
               </div>
               <div className="min-w-0">
                 <DialogTitle className="text-xl tracking-tight">Create a new channel</DialogTitle>
                 <DialogDescription className="mt-1.5 max-w-sm text-sm leading-relaxed">Bring the right people together for a project, site update, or design review.</DialogDescription>
               </div>
             </div>
           </DialogHeader>
           <div className="space-y-5 px-6 py-6">
             <div className="space-y-2">
               <div className="flex items-center justify-between gap-3">
                 <Label htmlFor="chat-channel-name">Channel name</Label>
                 <span className="text-[10px] text-muted-foreground">Required</span>
               </div>
               <div className="relative">
                 <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                 <Input id="chat-channel-name" value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="project-updates" className="h-11 pl-9" autoFocus data-testid="input-chat-channel-name" />
               </div>
               <p className="text-[11px] text-muted-foreground">Use a short, recognizable name your team can find quickly.</p>
             </div>
             <div className="space-y-2">
               <div className="flex items-center justify-between gap-3">
                 <Label htmlFor="chat-channel-description">Description</Label>
                 <span className="text-[10px] text-muted-foreground">Optional</span>
               </div>
               <Textarea id="chat-channel-description" value={channelDescription} onChange={(event) => setChannelDescription(event.target.value)} placeholder="What will your team coordinate here?" rows={3} className="resize-none" data-testid="input-chat-channel-description" />
             </div>
             <div className="flex items-center gap-3 rounded-xl border bg-[#f8fafc] px-3 py-3">
               <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", channelName.trim() ? "bg-[#dce9ff] text-[#245bb3]" : "bg-muted text-muted-foreground")}>
                 <Hash className="h-5 w-5" />
               </div>
               <div className="min-w-0">
                 <p className="truncate text-sm font-semibold">{channelName.trim() || "your-channel"}</p>
                 <p className="truncate text-xs text-muted-foreground">{channelDescription.trim() || "A focused space for your team"}</p>
               </div>
             </div>
           </div>
           <DialogFooter className="border-t bg-[#fbfcfe] px-6 py-4">
             <Button variant="outline" onClick={() => setIsChannelDialogOpen(false)} data-testid="button-cancel-chat-channel">Cancel</Button>
             <Button onClick={submitChannel} disabled={createChannel.isPending || !channelName.trim()} data-testid="button-submit-chat-channel">{createChannel.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create channel</Button>
           </DialogFooter>
         </DialogContent>
      </Dialog>
      <Dialog open={isDirectDialogOpen} onOpenChange={setIsDirectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a direct message</DialogTitle>
            <DialogDescription>Choose a teammate to open a private conversation.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto py-2">
            {(usersQuery.data ?? []).filter((person) => person.id !== user?.id).map((person) => (
              <button
                key={person.id}
                type="button"
                className={cn("flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left", directUserId === person.id ? "border-primary bg-primary/[0.06]" : "hover:bg-muted/40")}
                onClick={() => setDirectUserId(person.id)}
              >
                <Avatar className="h-8 w-8"><AvatarFallback>{initials(person.name)}</AvatarFallback></Avatar>
                <span className="text-sm font-medium">{person.name}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDirectDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitDirectMessage} disabled={!directUserId || createDirectMessage.isPending}>
              {createDirectMessage.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}Open chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MessageRow({
  message,
  previous,
  currentUserId,
  isAdmin,
  editingMessageId,
  editingContent,
  onEditingContentChange,
  onBeginEdit,
  onSaveEdit,
  onDelete,
  onReply,
  onReact,
}: {
  message: ChatMessage
  previous?: ChatMessage
  currentUserId?: number
  isAdmin: boolean
  editingMessageId: number | null
  editingContent: string
  onEditingContentChange: (value: string) => void
  onBeginEdit: (message: ChatMessage) => void
  onSaveEdit: (message: ChatMessage) => void
  onDelete: (message: ChatMessage) => void
  onReply: (message: ChatMessage) => void
  onReact: (message: ChatMessage, emoji: string) => void
}) {
  const grouped = previous?.authorId === message.authorId && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 300000
  const attachmentUrl = getAttachmentUrl(message.attachmentPath)
  const canModerate = message.authorId === currentUserId || isAdmin
  const isEditing = editingMessageId === message.id
  const actionBar = !message.deletedAt ? (
    <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-md border bg-white p-0.5 shadow-sm group-hover:flex">
      <Button variant="ghost" size="icon" className="h-6 w-6" title="Reply" onClick={() => onReply(message)}><Reply className="h-3 w-3" /></Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" title="React with thumbs up" onClick={() => onReact(message, "👍")}><Smile className="h-3 w-3" /></Button>
      {canModerate && <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit message" onClick={() => onBeginEdit(message)}><Edit3 className="h-3 w-3" /></Button>}
      {canModerate && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" title="Delete message" onClick={() => onDelete(message)}><Trash2 className="h-3 w-3" /></Button>}
    </div>
  ) : null
  const messageBody = message.deletedAt ? (
    <p className="italic text-sm text-muted-foreground">This message was deleted.</p>
  ) : isEditing ? (
    <div className="mt-1 flex items-center gap-2">
      <Input value={editingContent} onChange={(event) => onEditingContentChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSaveEdit(message); if (event.key === "Escape") onEditingContentChange(message.content) }} className="h-8 text-sm" autoFocus />
      <Button size="icon" className="h-8 w-8" title="Save edit" onClick={() => onSaveEdit(message)}><Send className="h-3.5 w-3.5" /></Button>
    </div>
  ) : (
    <>
      {message.content && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{message.content}</p>}
      {message.editedAt && <span className="ml-1 text-[10px] text-muted-foreground">(edited)</span>}
    </>
  )
  const attachmentCard = attachmentUrl && message.attachmentName ? (
    <a
      href={attachmentUrl}
      target="_blank"
      rel="noreferrer"
      download={message.attachmentName}
      className="mt-2 flex max-w-sm items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60"
      data-testid={`link-chat-attachment-${message.id}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{message.attachmentName}</p>
        <p className="text-[10px] text-muted-foreground">{formatFileSize(message.attachmentSize)} · Click to open</p>
      </div>
      <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
    </a>
  ) : null
  if (grouped) {
    return (
      <div className="group relative flex gap-3 rounded-md px-2 py-0.5 pl-[3.75rem] hover:bg-muted/40" data-testid={`message-chat-${message.id}`}>
        <span className="w-12 shrink-0 pt-1 text-right text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">{formatMessageTime(message.createdAt)}</span>
        <div className="min-w-0">
          {messageBody}
          {attachmentCard}
          {message.reactions?.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{message.reactions.map((reaction) => <button key={reaction.emoji} type="button" className={cn("rounded-full border px-1.5 py-0.5 text-[11px]", reaction.reacted && "border-primary bg-primary/10")} onClick={() => onReact(message, reaction.emoji)}>{reaction.emoji} {reaction.count}</button>)}</div>}
        </div>
        {actionBar}
      </div>
    )
  }
  return (
    <div className="group relative flex gap-3 rounded-md px-2 py-2 hover:bg-muted/40" data-testid={`message-chat-${message.id}`}>
      <Avatar className="h-9 w-9 shrink-0 rounded-lg">
        <AvatarFallback className="rounded-lg bg-primary/10 text-xs text-primary">{initials(message.authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">{message.authorName}</span>
          <span className="text-[10px] text-muted-foreground">{formatMessageDate(message.createdAt)} at {formatMessageTime(message.createdAt)}</span>
        </div>
        {messageBody}
        {attachmentCard}
        {message.reactions?.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{message.reactions.map((reaction) => <button key={reaction.emoji} type="button" className={cn("rounded-full border px-1.5 py-0.5 text-[11px]", reaction.reacted && "border-primary bg-primary/10")} onClick={() => onReact(message, reaction.emoji)}>{reaction.emoji} {reaction.count}</button>)}</div>}
      </div>
      {actionBar}
    </div>
  )
}