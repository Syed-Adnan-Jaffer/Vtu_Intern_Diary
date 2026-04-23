import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RequireAuth } from "@/components/RequireAuth";
import { buildInternshipDays } from "@/lib/diary-utils";
import { format } from "date-fns";
import { CheckCircle2, Circle, FileEdit, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

type EntryRow = { entry_date: string; status: string; content: string | null };
type ProfileRow = {
  start_date: string | null;
  end_date: string | null;
  skip_weekends: boolean;
  full_name: string | null;
  internship_title: string | null;
};

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: p }, { data: e }] = await Promise.all([
        supabase.from("profiles").select("start_date, end_date, skip_weekends, full_name, internship_title").eq("id", user.id).maybeSingle(),
        supabase.from("diary_entries").select("entry_date, status, content").eq("user_id", user.id),
      ]);
      if (!active) return;
      setProfile(p);
      setEntries(e ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const days = useMemo(
    () => buildInternshipDays(profile?.start_date ?? null, profile?.end_date ?? null, profile?.skip_weekends ?? true),
    [profile?.start_date, profile?.end_date, profile?.skip_weekends],
  );

  const entryByDate = useMemo(() => {
    const m = new Map<string, EntryRow>();
    for (const e of entries) m.set(e.entry_date, e);
    return m;
  }, [entries]);

  const finalized = entries.filter((e) => e.status === "finalized").length;
  const drafted = entries.filter((e) => e.status === "draft" && e.content && e.content.trim()).length;
  const total = days.length;
  const progress = total > 0 ? Math.round((finalized / total) * 100) : 0;

  if (loading) return <div className="py-16 text-center text-muted-foreground">Loading…</div>;

  if (!profile?.start_date || !profile?.end_date) {
    return (
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-warning" />
          <h2 className="text-xl font-semibold">Set up your internship first</h2>
          <p className="text-sm text-muted-foreground">
            Add your name, USN, and internship dates so we can build your diary.
          </p>
          <Button onClick={() => void navigate({ to: "/profile" })}>Go to profile</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">
          Hi {profile.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {profile.internship_title ?? "Your internship"} · {finalized} of {total} days finalized
          {drafted > 0 && ` · ${drafted} draft${drafted > 1 ? "s" : ""}`}
        </p>
        <Progress value={progress} className="mt-3 h-2" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {days.map((d) => {
          const e = entryByDate.get(d.isoDate);
          const status: "finalized" | "draft" | "empty" =
            e?.status === "finalized"
              ? "finalized"
              : e?.content && e.content.trim()
                ? "draft"
                : "empty";
          return (
            <Link
              key={d.isoDate}
              to="/day/$date"
              params={{ date: d.isoDate }}
              className={cn(
                "group flex flex-col gap-1 rounded-lg border p-3 text-left transition hover:border-primary hover:shadow-sm",
                status === "finalized" && "border-success/40 bg-success/5",
                status === "draft" && "border-warning/40 bg-warning/5",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Day {d.dayNumber}</span>
                {status === "finalized" && <CheckCircle2 className="h-4 w-4 text-success" />}
                {status === "draft" && <FileEdit className="h-4 w-4 text-warning" />}
                {status === "empty" && <Circle className="h-4 w-4 text-muted-foreground/50" />}
              </div>
              <div className="text-sm font-semibold">{format(d.date, "MMM d")}</div>
              <div className="text-xs text-muted-foreground">{format(d.date, "EEE")}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
