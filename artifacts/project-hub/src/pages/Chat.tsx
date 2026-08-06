import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Bell,
  Download,
  FileText,
  Hash,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react"

import {
  getListChatChannelsQueryKey,
  getListChatChannelMembersQueryKey,
  getListChatMessagesQueryKey,
  useCreateChatChannel,
  useCreateChatMessage,
  useJoinChatChannel,
  useLeaveChatChannel,
  useListChatChannelMembers,
  useListChatChannels,
  useListChatMessages,
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
import { MentionTextarea } from "@/components/MentionTextarea"
import { useToast } from "@/hooks/use-toast"
import { cn, formatTime, formatDate } from "@/lib/utils"

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U"
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
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false)
  const [channelName, setChannelName] = useState("")
  const [channelDescription, setChannelDescription] = useState("")
  const [message, setMessage] = useState("")
  const [messageSearch, setMessageSearch] = useState("")
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
  const membersQuery = useListChatChannelMembers(activeChannelId, {
    query: {
      enabled: Boolean(activeChannel),
      queryKey: getListChatChannelMembersQueryKey(activeChannelId),
      refetchInterval: 15000,
    },
  })
  const filteredMessages = useMemo(() => {
    const query = messageSearch.trim().toLocaleLowerCase()
    if (!query) return messages
    return messages.filter((item) => `${item.authorName} ${item.content}`.toLocaleLowerCase().includes(query))
  }, [messageSearch, messages])

  const createChannel = useCreateChatChannel()
  const createMessage = useCreateChatMessage()
  const joinChannel = useJoinChatChannel()
  const leaveChannel = useLeaveChatChannel()

  useEffect(() => {
    if (!selectedChannelId && channels[0]) setSelectedChannelId(channels[0].id)
    if (selectedChannelId && channels.length && !channels.some((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(channels[0]?.id ?? null)
    }
  }, [channels, selectedChannelId])

  useEffect(() => {
    setMessageSearch("")
  }, [activeChannelId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, activeChannelId])

  const participants = membersQuery.data ?? []

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
      },
    }, {
      onSuccess: (created) => {
        setMessage("")
        setAttachment(null)
        queryClient.setQueryData<ChatMessage[]>(getListChatMessagesQueryKey(activeChannel.id), (current) => [...(current ?? []), created])
      },
      onError: (error) => toast({ title: "Message could not be sent", description: error instanceof Error ? error.message : "Please try again." }),
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
        queryClient.invalidateQueries({ queryKey: getListChatChannelMembersQueryKey(activeChannel.id) })
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
        queryClient.invalidateQueries({ queryKey: getListChatChannelMembersQueryKey(activeChannel.id) })
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
        queryClient.invalidateQueries({ queryKey: getListChatChannelsQueryKey() })
      },
      onError: (error) => toast({ title: "Channel could not be created", description: error instanceof Error ? error.message : "Please try another name." }),
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f8fa]">
      <div className="flex-none border-b bg-card px-4 py-4 sm:px-6">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Team Chat</h1>
                <p className="text-xs text-muted-foreground">Keep project conversations close to the drawing register.</p>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search messages"
                placeholder="Search messages"
                value={messageSearch}
                onChange={(event) => setMessageSearch(event.target.value)}
                className="h-9 w-full pl-9 pr-8 sm:w-52 lg:w-64"
                data-testid="input-search-chat"
              />
              {messageSearch && (
                <button
                  type="button"
                  aria-label="Clear message search"
                  onClick={() => setMessageSearch("")}
                  className="absolute right-2 top-2 rounded-sm text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-chat-search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" className="hidden sm:inline-flex" title="Notifications" data-testid="button-chat-notifications">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[220px] shrink-0 flex-col border-r bg-[#eef0f3] sm:w-[250px] lg:flex">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
              <p className="mt-1 truncate text-sm font-semibold">Design Sense Architects</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsChannelDialogOpen(true)} title="Create channel" data-testid="button-create-channel">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-5 p-3">
              <section>
                <div className="mb-2 flex items-center justify-between px-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Channels</p>
                  <span className="font-mono text-[10px] text-muted-foreground">{channels.length}</span>
                </div>
                <div className="space-y-0.5">
                  {channelsQuery.isLoading ? (
                    <div className="space-y-2 px-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-4/5" /><Skeleton className="h-8 w-11/12" /></div>
                  ) : channels.length ? channels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setSelectedChannelId(channel.id)}
                      className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors", activeChannel?.id === channel.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:bg-white/70 hover:text-foreground")}
                      data-testid={`button-channel-${channel.id}`}
                    >
                      <Hash className={cn("h-4 w-4 shrink-0", activeChannel?.id === channel.id ? "text-primary" : "text-muted-foreground/70")} />
                      <span className="truncate">{channel.name}</span>
                    </button>
                  )) : (
                    <p className="px-2 text-xs text-muted-foreground">No channels yet.</p>
                  )}
                </div>
              </section>
              <section className="rounded-lg border border-primary/10 bg-primary/[0.04] p-3">
                <p className="text-xs font-semibold text-foreground">Make space for the work</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Use channels for decisions, handover notes, and quick site coordination.</p>
              </section>
            </div>
          </ScrollArea>
          <div className="border-t px-3 py-3">
            <div className="flex items-center gap-2 rounded-md bg-white/70 px-2 py-2">
              <Avatar className="h-7 w-7 rounded-md">
                <AvatarFallback className="rounded-md bg-primary text-[10px] text-primary-foreground">{initials(user?.name || user?.username || "User")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{user?.name || user?.username}</p>
                <p className="text-[10px] text-emerald-700">Active now</p>
              </div>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-white">
          <div className="flex flex-none flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {activeChannel ? (
              <>
                <div className="min-w-0">
                  <div className="mb-2 flex gap-1 overflow-x-auto lg:hidden">
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setSelectedChannelId(channel.id)}
                        className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", activeChannel.id === channel.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                      >
                        #{channel.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Hash className="h-5 w-5 text-primary" />
                    <h2 className="truncate text-base font-bold">{activeChannel.name}</h2>
                      {!activeChannel.joined && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Not joined</span>}
                  </div>
                  <p className="mt-1 truncate pl-7 text-xs text-muted-foreground">{activeChannel.description || "A place for the team to talk."}</p>
                </div>
                 <div className="flex shrink-0 items-center gap-2">
                   <div className="flex items-center gap-2 text-xs text-muted-foreground">
                     <Users className="h-4 w-4" />
                     <span className="hidden sm:inline">{activeChannel.memberCount} member{activeChannel.memberCount === 1 ? "" : "s"}</span>
                   </div>
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
              ) : messages.length && filteredMessages.length ? (
                <div className="space-y-1">
                  <div className="mb-6 border-b pb-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Hash className="h-6 w-6" /></div>
                    <h3 className="mt-3 text-xl font-bold">Welcome to #{activeChannel.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{activeChannel.description || "This is the beginning of this channel."}</p>
                  </div>
                  {messageSearch && (
                    <p className="mb-3 rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                      Showing {filteredMessages.length} {filteredMessages.length === 1 ? "message" : "messages"} matching “{messageSearch}”
                    </p>
                  )}
                  {filteredMessages.map((item, index) => (
                    <MessageRow key={item.id} message={item} previous={messageSearch ? undefined : filteredMessages[index - 1]} />
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
                    <h3 className="mt-3 text-xl font-bold">Welcome to #{activeChannel.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{activeChannel.description || "Start the conversation with your team."}</p>
                  </div>
                  <div ref={messageEndRef} />
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex-none border-t bg-white px-4 py-3 sm:px-6">
            <div className="mx-auto max-w-4xl">
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
                  placeholder={activeChannel ? `Message #${activeChannel.name}` : "Select a channel"}
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

        <aside className="hidden w-[210px] shrink-0 border-l bg-[#fbfbfc] lg:flex lg:flex-col">
          <div className="border-b px-4 py-4">
            <div className="flex items-center justify-between">
               <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Members</p>
               <span className="font-mono text-[10px] text-muted-foreground">{activeChannel?.memberCount ?? 0}</span>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1 p-3">
               {participants.length ? participants.map((participant) => (
                 <div key={participant.userId} className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50" data-testid={`member-chat-${participant.userId}`}>
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                     <AvatarFallback className="bg-secondary text-[10px]">{initials(participant.name)}</AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#fbfbfc] bg-emerald-500" />
                  </div>
                  <div className="min-w-0">
                   <p className="truncate text-xs font-medium">{participant.name}</p>
                   <p className="text-[10px] text-muted-foreground">{participant.userId === activeChannel?.createdBy ? "Channel owner" : participant.role}</p>
                  </div>
                </div>
               )) : <p className="px-2 py-3 text-xs text-muted-foreground">No members yet.</p>}
            </div>
          </ScrollArea>
        </aside>
      </div>

      <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a channel</DialogTitle>
            <DialogDescription>Give your team a focused place to discuss a project or workstream.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="chat-channel-name">Channel name</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="chat-channel-name" value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="project-updates" className="pl-9" data-testid="input-chat-channel-name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chat-channel-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="chat-channel-description" value={channelDescription} onChange={(event) => setChannelDescription(event.target.value)} placeholder="What is this channel for?" data-testid="input-chat-channel-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChannelDialogOpen(false)} data-testid="button-cancel-chat-channel"><X className="mr-2 h-4 w-4" />Cancel</Button>
            <Button onClick={submitChannel} disabled={createChannel.isPending} data-testid="button-submit-chat-channel">{createChannel.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create channel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MessageRow({ message, previous }: { message: ChatMessage; previous?: ChatMessage }) {
  const grouped = previous?.authorId === message.authorId && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 300000
  const attachmentUrl = getAttachmentUrl(message.attachmentPath)
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
      <div className="group flex gap-3 rounded-md px-2 py-0.5 pl-[3.75rem] hover:bg-muted/40" data-testid={`message-chat-${message.id}`}>
        <span className="w-12 shrink-0 pt-1 text-right text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">{formatMessageTime(message.createdAt)}</span>
        <div className="min-w-0">
          {message.content && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>}
          {attachmentCard}
        </div>
      </div>
    )
  }
  return (
    <div className="group flex gap-3 rounded-md px-2 py-2 hover:bg-muted/40" data-testid={`message-chat-${message.id}`}>
      <Avatar className="h-9 w-9 shrink-0 rounded-lg">
        <AvatarFallback className="rounded-lg bg-primary/10 text-xs text-primary">{initials(message.authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">{message.authorName}</span>
          <span className="text-[10px] text-muted-foreground">{formatMessageDate(message.createdAt)} at {formatMessageTime(message.createdAt)}</span>
        </div>
        {message.content && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{message.content}</p>}
        {attachmentCard}
      </div>
    </div>
  )
}