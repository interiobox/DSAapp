import * as React from "react"
import { Building2, Edit3, Mail, MapPin, Phone, Plus, Search, Trash2, UserRound, UsersRound, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import {
  getListContactsQueryKey,
  useAddContactProject,
  useCreateContact,
  useDeleteContact,
  useListContacts,
  useListProjects,
  useUpdateContact,
} from "@workspace/api-client-react"
import type { Contact, ContactInputType } from "@workspace/api-client-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

const contactTypes: { value: ContactInputType; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "consultant", label: "Consultant" },
  { value: "contractor", label: "Contractor" },
  { value: "vendor", label: "Vendor" },
  { value: "supplier", label: "Supplier" },
  { value: "authority", label: "Authority" },
  { value: "other", label: "Other" },
]

type ContactForm = {
  companyName: string
  contactName: string
  type: ContactInputType
  service: string
  email: string
  phone: string
  website: string
  address: string
  notes: string
  projectName: string
  projectRole: string
  projectNotes: string
}

const emptyForm: ContactForm = {
  companyName: "",
  contactName: "",
  type: "consultant",
  service: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  notes: "",
  projectName: "",
  projectRole: "",
  projectNotes: "",
}

function labelForType(type: string) {
  return contactTypes.find((item) => item.value === type)?.label ?? type
}

function formFromContact(contact: Contact): ContactForm {
  return {
    companyName: contact.companyName,
    contactName: contact.contactName ?? "",
    type: contact.type,
    service: contact.service ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    website: contact.website ?? "",
    address: contact.address ?? "",
    notes: contact.notes ?? "",
    projectName: "",
    projectRole: "",
    projectNotes: "",
  }
}

function Header({ projectName, onAdd }: { projectName: string; onAdd: () => void }) {
  return (
    <div className="flex-none border-b bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{projectName ? `${projectName} Directory` : "Contacts & Partners"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{projectName ? "Consultants, vendors, clients, and project partners." : "A shared directory of clients, consultants, vendors, and project partners."}</p>
          </div>
        </div>
        <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" /> Add contact</Button>
      </div>
    </div>
  )
}

function ContactFormFields({ form, setForm, projects, includeProject }: {
  form: ContactForm
  setForm: React.Dispatch<React.SetStateAction<ContactForm>>
  projects: { id: number; name: string }[]
  includeProject: boolean
}) {
  const update = (key: keyof ContactForm, value: string) => setForm((current) => ({ ...current, [key]: value }))
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="contact-company">Company or organization *</Label>
        <Input id="contact-company" className="mt-1.5" value={form.companyName} onChange={(event) => update("companyName", event.target.value)} placeholder="e.g. Northline Structural Engineers" required />
      </div>
      <div>
        <Label htmlFor="contact-person">Primary contact</Label>
        <Input id="contact-person" className="mt-1.5" value={form.contactName} onChange={(event) => update("contactName", event.target.value)} placeholder="Name" />
      </div>
      <div>
        <Label>Directory type</Label>
        <Select value={form.type} onValueChange={(value) => update("type", value)}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>{contactTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="contact-service">Service / discipline</Label>
        <Input id="contact-service" className="mt-1.5" value={form.service} onChange={(event) => update("service", event.target.value)} placeholder="e.g. Structural engineering" />
      </div>
      <div>
        <Label htmlFor="contact-email">Email</Label>
        <Input id="contact-email" type="email" className="mt-1.5" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="contact@company.com" />
      </div>
      <div>
        <Label htmlFor="contact-phone">Phone</Label>
        <Input id="contact-phone" className="mt-1.5" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+44 ..." />
      </div>
      <div>
        <Label htmlFor="contact-website">Website</Label>
        <Input id="contact-website" className="mt-1.5" value={form.website} onChange={(event) => update("website", event.target.value)} placeholder="https://" />
      </div>
      <div>
        <Label htmlFor="contact-address">Address</Label>
        <Input id="contact-address" className="mt-1.5" value={form.address} onChange={(event) => update("address", event.target.value)} placeholder="Office address" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="contact-notes">General notes</Label>
        <Textarea id="contact-notes" className="mt-1.5 min-h-20" value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Preferred contact method, payment terms, or other firm-wide notes." />
      </div>
      {includeProject && (
        <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-4">
          <p className="mb-3 text-sm font-semibold">Project association <span className="font-normal text-muted-foreground">(optional)</span></p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Project</Label>
              <Select value={form.projectName || "none"} onValueChange={(value) => update("projectName", value === "none" ? "" : value)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose a project" /></SelectTrigger>
                <SelectContent><SelectItem value="none">No project yet</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contact-project-role">Project role</Label>
              <Input id="contact-project-role" className="mt-1.5" value={form.projectRole} onChange={(event) => update("projectRole", event.target.value)} placeholder="e.g. Structural consultant" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="contact-project-notes">Project notes</Label>
              <Textarea id="contact-project-notes" className="mt-1.5 min-h-16" value={form.projectNotes} onChange={(event) => update("projectNotes", event.target.value)} placeholder="Scope, package, or project-specific notes." />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ContactCard({ contact, onEdit, onDelete, onAddProject }: {
  contact: Contact
  onEdit: () => void
  onDelete: () => void
  onAddProject: () => void
}) {
  return (
    <Card className="h-full">
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{contact.companyName}</CardTitle>
              <CardDescription className="mt-1">{labelForType(contact.type)}{contact.service ? ` · ${contact.service}` : ""}</CardDescription>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${contact.companyName}`}><Edit3 className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive" onClick={onDelete} aria-label={`Move ${contact.companyName} to recycle bin`} data-testid={`button-recycle-contact-${contact.id}`}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Recycle</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {contact.contactName && <p className="flex items-center gap-2 text-sm font-medium"><UserRound className="h-4 w-4 text-muted-foreground" />{contact.contactName}</p>}
        {contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-2 truncate text-sm text-primary hover:underline"><Mail className="h-4 w-4 shrink-0 text-muted-foreground" />{contact.email}</a>}
        {contact.phone && <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline"><Phone className="h-4 w-4 text-muted-foreground" />{contact.phone}</a>}
        {contact.address && <p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{contact.address}</p>}
        {contact.notes && <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">{contact.notes}</p>}
        <div className="border-t pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projects</p>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onAddProject}><Plus className="mr-1 h-3 w-3" /> Add</Button>
          </div>
          {contact.projects.length ? <div className="flex flex-wrap gap-1.5">{contact.projects.map((project) => <Badge key={project.id} variant="secondary" title={project.role ?? undefined}>{project.projectName}{project.role ? ` · ${project.role}` : ""}</Badge>)}</div> : <p className="text-xs text-muted-foreground">Shared directory only</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ContactsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const projectFromUrl = React.useMemo(() => new URLSearchParams(window.location.search).get("project") ?? "", [])
  const [projectFilter, setProjectFilter] = React.useState(projectFromUrl || "all")
  const [typeFilter, setTypeFilter] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const [form, setForm] = React.useState<ContactForm>(emptyForm)
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Contact | null>(null)
  const [projectContact, setProjectContact] = React.useState<Contact | null>(null)
  const [associationProject, setAssociationProject] = React.useState("")
  const [projectRole, setProjectRole] = React.useState("")
  const [projectNotes, setProjectNotes] = React.useState("")

  const { data: projects } = useListProjects()
  const { data: contacts, isLoading } = useListContacts(projectFilter !== "all" ? { projectName: projectFilter } : undefined)
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()
  const addContactProject = useAddContactProject()
  const projectOptions = projects ?? []

  const visibleContacts = React.useMemo(() => (contacts ?? []).filter((contact) => {
    const matchesType = typeFilter === "all" || contact.type === typeFilter
    const haystack = `${contact.companyName} ${contact.contactName ?? ""} ${contact.service ?? ""} ${contact.email ?? ""} ${contact.projects.map((project) => project.projectName).join(" ")}`.toLowerCase()
    return matchesType && haystack.includes(search.toLowerCase())
  }), [contacts, search, typeFilter])

  function invalidateContacts() {
    void queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() })
    if (projectFilter !== "all") void queryClient.invalidateQueries({ queryKey: getListContactsQueryKey({ projectName: projectFilter }) })
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, projectName: projectFilter !== "all" ? projectFilter : "" })
    setIsFormOpen(true)
  }

  function openEdit(contact: Contact) {
    setEditing(contact)
    setForm(formFromContact(contact))
    setIsFormOpen(true)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = {
      companyName: form.companyName.trim(),
      contactName: form.contactName.trim() || undefined,
      type: form.type,
      service: form.service.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      ...(editing ? {} : {
        projectName: form.projectName || undefined,
        projectRole: form.projectRole.trim() || undefined,
        projectNotes: form.projectNotes.trim() || undefined,
      }),
    }
    const onSuccess = () => {
      invalidateContacts()
      setIsFormOpen(false)
      toast({ title: editing ? "Contact updated" : "Contact added" })
    }
    if (editing) updateContact.mutate({ id: editing.id, data }, { onSuccess, onError: (error) => toast({ title: "Contact could not be updated", description: error instanceof Error ? error.message : "Please try again." }) })
    else createContact.mutate({ data }, { onSuccess, onError: (error) => toast({ title: "Contact could not be added", description: error instanceof Error ? error.message : "Please try again." }) })
  }

  function handleDelete(contact: Contact) {
    if (!window.confirm(`Move ${contact.companyName} to the recycle bin? You can restore it within 30 days.`)) return
    deleteContact.mutate({ id: contact.id }, {
      onSuccess: () => { invalidateContacts(); toast({ title: "Contact deleted" }) },
      onError: (error) => toast({ title: "Contact could not be moved to recycle bin", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }

  function handleAddProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!projectContact || !associationProject) return
    addContactProject.mutate({ id: projectContact.id, data: { projectName: associationProject, role: projectRole.trim() || undefined, notes: projectNotes.trim() || undefined } }, {
      onSuccess: () => {
        invalidateContacts()
        setProjectContact(null)
        setAssociationProject("")
        setProjectRole("")
        setProjectNotes("")
        toast({ title: "Project association added" })
      },
      onError: (error) => toast({ title: "Project association failed", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <Header projectName={projectFilter !== "all" ? projectFilter : ""} onAdd={openCreate} />
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search companies, people, services, or projects" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger className="w-full lg:w-[240px]"><SelectValue placeholder="All projects" /></SelectTrigger><SelectContent><SelectItem value="all">All projects</SelectItem>{projectOptions.map((project) => <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>)}</SelectContent></Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full lg:w-[180px]"><SelectValue placeholder="All types" /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{contactTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}s</SelectItem>)}</SelectContent></Select>
            {(projectFilter !== "all" || typeFilter !== "all" || search) && <Button variant="ghost" size="icon" onClick={() => { setProjectFilter("all"); setTypeFilter("all"); setSearch("") }} aria-label="Clear filters"><X className="h-4 w-4" /></Button>}
          </div>
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{visibleContacts.length} contact{visibleContacts.length === 1 ? "" : "s"}{projectFilter !== "all" ? ` linked to ${projectFilter}` : ""}</p></div>
          {isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton className="h-64" key={item} />)}</div> : visibleContacts.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleContacts.map((contact) => <ContactCard key={contact.id} contact={contact} onEdit={() => openEdit(contact)} onDelete={() => handleDelete(contact)} onAddProject={() => setProjectContact(contact)} />)}</div> : <Card><CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground"><UsersRound className="mb-3 h-10 w-10 opacity-30" /><p className="font-medium text-foreground">{search || projectFilter !== "all" || typeFilter !== "all" ? "No contacts match these filters." : "The shared directory is empty."}</p><p className="mt-1 text-sm">Add clients, consultants, vendors, and contractors to make project coordination easier.</p><Button className="mt-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add first contact</Button></CardContent></Card>}
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit contact" : "Add contact"}</DialogTitle><DialogDescription>Keep one shared record for each organization, then link it to the projects where it is involved.</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5"><ContactFormFields form={form} setForm={setForm} projects={projectOptions} includeProject={!editing} /><DialogFooter><Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button><Button type="submit" disabled={!form.companyName.trim() || createContact.isPending || updateContact.isPending}>{editing ? "Save changes" : "Add contact"}</Button></DialogFooter></form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(projectContact)} onOpenChange={(open) => !open && setProjectContact(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link project</DialogTitle><DialogDescription>Add {projectContact?.companyName ?? "this contact"} to another project directory.</DialogDescription></DialogHeader>
          <form onSubmit={handleAddProject} className="space-y-4">
            <div><Label>Project</Label><Select value={associationProject} onValueChange={setAssociationProject}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent>{projectOptions.filter((project) => !projectContact?.projects.some((item) => item.projectName === project.name)).map((project) => <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="association-role">Project role</Label><Input id="association-role" className="mt-1.5" value={projectRole} onChange={(event) => setProjectRole(event.target.value)} placeholder="e.g. MEP consultant" /></div>
            <div><Label htmlFor="association-notes">Project notes</Label><Textarea id="association-notes" className="mt-1.5" value={projectNotes} onChange={(event) => setProjectNotes(event.target.value)} placeholder="Scope or package notes" /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => { setProjectContact(null); setAssociationProject("") }}>Cancel</Button><Button type="submit" disabled={!associationProject || addContactProject.isPending}>Link project</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}