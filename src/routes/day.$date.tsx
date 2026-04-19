import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { generateDiaryEntry } from "@/server/diary.functions";
import { useServerFn } from "@tanstack/react-start";
import { buildInternshipDays, formatDayLabel } from "@/lib/diary-utils";
import { parseISO } from "date-fns";
import { ArrowLeft, Sparkles, Save, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/day/$date")({
  component: () => (
    <RequireAuth>
      <DayEditor />
    </RequireAuth>
  ),
});

function DayEditor() {
  const { date } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const generate = useServerFn(generateDiaryEntry);

  const [bullets, setBullets] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "finalized">("draft");
  const [dayNumber, setDayNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: profile }, { data: entry }] = await Promise.all([
        supabase.from("profiles").select("start_date, end_date, skip_weekends").eq("id", user.id).maybeSingle(),
        supabase.from("diary_entries").select("*").eq("user_id", user.id).eq("entry_date", date).maybeSingle(),
      ]);
      if (!active) return;
      if (profile) {
        const days = buildInternshipDays(profile.start_date, profile.end_date, profile.skip_weekends);
        const found = days.find((d) => d.isoDate === date);
        setDayNumber(found?.dayNumber ?? null);
      }
      if (entry) {
        setBullets(entry.bullets ?? "");
        setContent(entry.content ?? "");
        setStatus((entry.status as "draft" | "finalized") ?? "draft");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user, date]);

  const handleGenerate = async () => {
    if (!bullets.trim()) {
      toast.error("Add a few bullet points first.");
      return;
    }
    setGenerating(true);
    try {
      const dateLabel = formatDayLabel(parseISO(date));
      const res = await generate({ data: { bullets, dayNumber: dayNumber ?? 1, dateLabel } });
      setContent(res.content);
      toast.success("Entry generated — review and edit before saving.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const save = async (newStatus: "draft" | "finalized") => {
    if (!user) return;
    if (newStatus === "finalized" && !content.trim()) {
      toast.error("Cannot finalize an empty entry.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("diary_entries").upsert(
      {
        user_id: user.id,
        entry_date: date,
        day_number: dayNumber,
        bullets,
        content,
        status: newStatus,
      },
      { onConflict: "user_id,entry_date" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStatus(newStatus);
    toast.success(newStatus === "finalized" ? "Entry finalized" : "Draft saved");
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm("Delete this entry?")) return;
    await supabase.from("diary_entries").delete().eq("user_id", user.id).eq("entry_date", date);
    setBullets("");
    setContent("");
    setStatus("draft");
    toast.success("Entry deleted");
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {status === "finalized" ? (
            <Badge className="bg-success text-success-foreground">Finalized</Badge>
          ) : content ? (
            <Badge variant="secondary">Draft</Badge>
          ) : null}
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">
          Day {dayNumber ?? "?"} — {formatDayLabel(parseISO(date))}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your bullet points</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={5}
            value={bullets}
            onChange={(e) => setBullets(e.target.value)}
            placeholder={"e.g.\n- Learned about React useState hook\n- Built a counter component\n- Started reading docs on useEffect"}
          />
          <Button onClick={handleGenerate} disabled={generating}>
            <Sparkles className="mr-2 h-4 w-4" />
            {generating ? "Generating…" : content ? "Regenerate from bullets" : "Generate diary entry"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diary entry (editable)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Generated entry will appear here. Edit freely before finalizing."
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void save("draft")} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              Save draft
            </Button>
            <Button onClick={() => void save("finalized")} disabled={saving}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Finalize
            </Button>
            {(content || bullets) && (
              <Button variant="ghost" onClick={handleDelete} className="text-destructive ml-auto">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
