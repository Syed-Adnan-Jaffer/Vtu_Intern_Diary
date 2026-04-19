import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { generateBulkEntries } from "@/server/diary.functions";
import { useServerFn } from "@tanstack/react-start";
import { buildInternshipDays, formatDayLabel } from "@/lib/diary-utils";
import { parseISO } from "date-fns";
import { ArrowLeft, Sparkles, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/catch-up")({
  component: () => (
    <RequireAuth>
      <CatchUp />
    </RequireAuth>
  ),
});

type DayItem = { isoDate: string; dayNumber: number; dateLabel: string };

function CatchUp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const generate = useServerFn(generateBulkEntries);

  const [allDays, setAllDays] = useState<DayItem[]>([]);
  const [filledDates, setFilledDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [summary, setSummary] = useState("");
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: profile }, { data: entries }] = await Promise.all([
        supabase.from("profiles").select("start_date, end_date, skip_weekends, weekly_plan").eq("id", user.id).maybeSingle(),
        supabase.from("diary_entries").select("entry_date, content").eq("user_id", user.id),
      ]);
      if (!active) return;
      if (profile) {
        const days = buildInternshipDays(profile.start_date, profile.end_date, profile.skip_weekends);
        setAllDays(days.map((d) => ({ isoDate: d.isoDate, dayNumber: d.dayNumber, dateLabel: formatDayLabel(d.date) })));
        if (!summary && profile.weekly_plan) setSummary(profile.weekly_plan);
      }
      const filled = new Set<string>();
      for (const e of entries ?? []) if (e.content && e.content.trim()) filled.add(e.entry_date);
      setFilledDates(filled);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const eligibleDays = useMemo(() => {
    if (!start || !end) return [];
    return allDays.filter((d) => d.isoDate >= start && d.isoDate <= end && !filledDates.has(d.isoDate));
  }, [allDays, filledDates, start, end]);

  const handleGenerate = async () => {
    if (eligibleDays.length === 0) {
      toast.error("No empty days in this range.");
      return;
    }
    setGenerating(true);
    try {
      const res = await generate({ data: { summary, days: eligibleDays } });
      const map: Record<string, string> = {};
      for (const e of res.entries) {
        const day = eligibleDays.find((d) => d.dayNumber === e.dayNumber);
        if (day) map[day.isoDate] = e.content;
      }
      // any days not returned, leave empty
      setDrafts(map);
      toast.success(`Generated ${Object.keys(map).length} entries — review and save.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveAll = async () => {
    if (!user) return;
    const rows = Object.entries(drafts)
      .filter(([, content]) => content.trim().length > 0)
      .map(([isoDate, content]) => {
        const d = allDays.find((x) => x.isoDate === isoDate);
        return {
          user_id: user.id,
          entry_date: isoDate,
          day_number: d?.dayNumber ?? null,
          content,
          status: "draft" as const,
        };
      });
    if (rows.length === 0) {
      toast.error("Nothing to save.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("diary_entries").upsert(rows, { onConflict: "user_id,entry_date" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${rows.length} drafts saved. Open each to finalize.`);
    void navigate({ to: "/dashboard" });
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  if (allDays.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">Set your internship dates first.</p>
          <Link to="/profile">
            <Button>Go to profile</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const minDate = allDays[0]?.isoDate;
  const maxDate = allDays[allDays.length - 1]?.isoDate;

  return (
    <div className="space-y-6">
      <Link to="/dashboard">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Catch up on missed days</h1>
        <p className="mt-1 text-muted-foreground">Pick a date range and tell us what was covered. We'll fill in plausible varied entries for each empty day.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Date range &amp; topics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" min={minDate} max={maxDate} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" min={start || minDate} max={maxDate} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {start && end && (
            <p className="text-sm text-muted-foreground">
              {eligibleDays.length} empty day{eligibleDays.length === 1 ? "" : "s"} will be filled.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Topics covered in this period</Label>
            <Textarea
              rows={5}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g. Week 1: HTML/CSS basics, semantic markup, Flexbox, responsive design. Week 2: intro to React, components, props, useState…"
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating || !start || !end || eligibleDays.length === 0}>
            <Sparkles className="mr-2 h-4 w-4" />
            {generating ? "Generating…" : `Generate ${eligibleDays.length} entr${eligibleDays.length === 1 ? "y" : "ies"}`}
          </Button>
        </CardContent>
      </Card>

      {Object.keys(drafts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Review &amp; tweak</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {eligibleDays
              .filter((d) => drafts[d.isoDate])
              .map((d) => (
                <div key={d.isoDate} className="space-y-1.5 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Day {d.dayNumber} — {d.dateLabel}</div>
                    <Checkbox
                      checked={!!drafts[d.isoDate]}
                      onCheckedChange={(v) => {
                        if (!v) {
                          const copy = { ...drafts };
                          delete copy[d.isoDate];
                          setDrafts(copy);
                        }
                      }}
                    />
                  </div>
                  <Textarea
                    rows={5}
                    value={drafts[d.isoDate]}
                    onChange={(e) => setDrafts({ ...drafts, [d.isoDate]: e.target.value })}
                  />
                </div>
              ))}
            <Button onClick={handleSaveAll} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving…" : "Save all as drafts"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
