import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { analyzeCv } from "@/lib/cv.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Briefcase, LogOut, Plus, Search, UserPlus, Mail, Linkedin, Trash2, ShieldCheck, Sparkles, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({ component: AppPage });

type Job = { id: string; title: string; description: string | null; user_id: string | null; created_at: string | null };
type Candidate = {
  id: string; full_name: string; email: string | null; linkedin: string | null;
  status: string | null; job_id: string | null; user_id: string | null; created_at: string | null;
  cv_url: string | null;
  ai_score: number | null;
  ai_summary: string | null;
  ai_strengths: string | null;
  ai_risks: string | null;
};

const STAGES = [
  { key: "applied", label: "Applied", tone: "bg-slate-100 text-slate-700" },
  { key: "screening", label: "Screening", tone: "bg-blue-100 text-blue-700" },
  { key: "interview", label: "Interview", tone: "bg-violet-100 text-violet-700" },
  { key: "offer", label: "Offer", tone: "bg-amber-100 text-amber-700" },
  { key: "hired", label: "Hired", tone: "bg-emerald-100 text-emerald-700" },
  { key: "rejected", label: "Rejected", tone: "bg-rose-100 text-rose-700" },
] as const;

function AppPage() {
  const { user, loading, profile, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login", replace: true });
  }, [user, loading, nav]);

  const [selectedJobId, setSelectedJobId] = useState<string | "all">("all");
  const [search, setSearch] = useState("");

  const jobsQ = useQuery({
    queryKey: ["jobs"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Job[];
    },
  });

  const candidatesQ = useQuery({
    queryKey: ["candidates"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Candidate[];
    },
  });

  const filtered = useMemo(() => {
    const list = candidatesQ.data ?? [];
    return list.filter((c) => {
      if (selectedJobId !== "all" && c.job_id !== selectedJobId) return false;
      if (search && !c.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [candidatesQ.data, selectedJobId, search]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("candidates").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCandidate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("candidates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Candidate removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const jobsForCandidate = jobsQ.data ?? [];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-72 flex-col border-r bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">TrackHire</div>
            <div className="text-xs text-muted-foreground">Mini ATS</div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jobs</div>
          <AddJobDialog />
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <button
            onClick={() => setSelectedJobId("all")}
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
              selectedJobId === "all" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
            }`}
          >
            All jobs
          </button>
          {jobsQ.data?.map((j) => (
            <button
              key={j.id}
              onClick={() => setSelectedJobId(j.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                selectedJobId === j.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              }`}
            >
              <div className="truncate font-medium">{j.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {(candidatesQ.data ?? []).filter(c => c.job_id === j.id).length} candidates
              </div>
            </button>
          ))}
          {jobsQ.data?.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No jobs yet. Create your first one.
            </div>
          )}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{profile?.full_name ?? user.email}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {isAdmin && <ShieldCheck className="h-3 w-3" />}
                {isAdmin ? "Admin" : "Customer"}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b bg-card px-6 py-3">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidates by name…"
              className="pl-9"
            />
          </div>
          <Select value={selectedJobId} onValueChange={(v) => setSelectedJobId(v)}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Filter by job" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobsQ.data?.map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AddCandidateDialog jobs={jobsForCandidate} defaultJobId={selectedJobId === "all" ? undefined : selectedJobId} />
        </header>

        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          {jobsQ.data?.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex h-full gap-4 min-w-max">
              {STAGES.map((stage) => {
                const items = filtered.filter((c) => (c.status ?? "applied") === stage.key);
                return (
                  <div
                    key={stage.key}
                    className="flex w-72 flex-col rounded-xl bg-muted/40"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) updateStatus.mutate({ id, status: stage.key });
                    }}
                  >
                    <div className="flex items-center justify-between px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className={`${stage.tone} hover:${stage.tone} border-0`}>{stage.label}</Badge>
                        <span className="text-xs text-muted-foreground">{items.length}</span>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 px-3 pb-3">
                      {items.map((c) => {
                        const job = jobsQ.data?.find((j) => j.id === c.job_id);
                        return (
                          <Card
                            key={c.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                            className="group cursor-grab active:cursor-grabbing p-3 hover:shadow-md transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-medium text-sm">{c.full_name}</div>
                                {job && <div className="truncate text-xs text-muted-foreground">{job.title}</div>}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <AiScoreBadge score={c.ai_score} summary={c.ai_summary} />
                                <button
                                  onClick={() => deleteCandidate.mutate(c.id)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                              {c.email && (
                                <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-foreground truncate">
                                  <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{c.email}</span>
                                </a>
                              )}
                              {c.linkedin && (
                                <a href={c.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground truncate">
                                  <Linkedin className="h-3 w-3 shrink-0" /><span className="truncate">LinkedIn</span>
                                </a>
                              )}
                              {c.cv_url && (
                                <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                                  <FileText className="h-3 w-3 shrink-0" /><span className="truncate">CV attached</span>
                                </span>
                              )}
                            </div>
                            <Select
                              value={c.status ?? "applied"}
                              onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}
                            >
                              <SelectTrigger className="mt-2 h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STAGES.map((s) => (
                                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Card>
                        );
                      })}
                      {items.length === 0 && (
                        <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                          Drop here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return EmptyStateInner();
}

function AiScoreBadge({ score, summary }: { score: number | null; summary: string | null }) {
  if (score == null) return null;
  const tone =
    score >= 80
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : score >= 50
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-rose-100 text-rose-700 border-rose-200";
  return (
    <span
      title={summary ?? `AI score: ${score}`}
      className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {score}
    </span>
  );
}

function EmptyStateInner() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Briefcase className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Create your first job</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Add a job opening, then start tracking candidates through your hiring pipeline.
      </p>
      <div className="mt-4"><AddJobDialog primary /></div>
    </div>
  );
}

function AddJobDialog({ primary }: { primary?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: async (vals: { title: string; description: string }) => {
      const { error } = await supabase.from("jobs").insert({
        title: vals.title, description: vals.description || null, user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      setOpen(false);
      toast.success("Job created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {primary ? (
          <Button><Plus className="mr-1 h-4 w-4" />New job</Button>
        ) : (
          <Button size="icon" variant="ghost" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New job</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            create.mutate({
              title: String(fd.get("title")),
              description: String(fd.get("description") ?? ""),
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="j-title">Job title</Label>
            <Input id="j-title" name="title" required placeholder="Senior Product Designer" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="j-desc">Description</Label>
            <Textarea id="j-desc" name="description" rows={4} placeholder="What are you hiring for?" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddCandidateDialog({ jobs, defaultJobId }: { jobs: Job[]; defaultJobId?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | undefined>(defaultJobId);
  const [status, setStatus] = useState<string>("applied");

  useEffect(() => { setJobId(defaultJobId); }, [defaultJobId, open]);

  const create = useMutation({
    mutationFn: async (vals: { full_name: string; email: string; linkedin: string }) => {
      if (!jobId) throw new Error("Pick a job");
      const { error } = await supabase.from("candidates").insert({
        full_name: vals.full_name,
        email: vals.email || null,
        linkedin: vals.linkedin || null,
        status,
        job_id: jobId,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setOpen(false);
      toast.success("Candidate added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={jobs.length === 0}>
          <UserPlus className="mr-1 h-4 w-4" />Add candidate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add candidate</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            create.mutate({
              full_name: String(fd.get("full_name")),
              email: String(fd.get("email") ?? ""),
              linkedin: String(fd.get("linkedin") ?? ""),
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="c-name">Full name</Label>
            <Input id="c-name" name="full_name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Job</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" name="email" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-linkedin">LinkedIn URL</Label>
            <Input id="c-linkedin" name="linkedin" type="url" placeholder="https://linkedin.com/in/…" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add candidate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}