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
import { ArrowLeft, Sparkles, Save, Download } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        toast.error("Error: VITE_GEMINI_API_KEY is missing from your .env file!");
        setGenerating(false);
        return;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const dayList = eligibleDays.map((d) => `- Day ${d.dayNumber} (${d.dateLabel})`).join("\n");
      
      const prompt = `You are a professional VTU internship mentor. 
      The student has noted these topics covered across a specific period:
      ${summary}

      Generate ONE diary entry for EACH of the following ${eligibleDays.length} days. Spread the topics naturally across days in a logical learning progression. Vary phrasing, sentence structure, and the specific aspect emphasized each day.

      Days to fill:
      ${dayList}

      Output STRICTLY a valid JSON object matching exactly this structure, with no markdown fences:
      {
        "entries": [
          {
            "dayNumber": <number>,
            "entryData": {
              "summary": "around 50 words describing the objective and work done in first-person past-tense",
              "hours": "6.5",
              "links": "",
              "learnings": "1-2 sentences on what was learned or skills gained",
              "blockers": "None",
              "skills": "Comma separated list of 3-5 technical keywords"
            }
          }
        ]
      }`;

      const modelsToTry = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite-001", "gemini-1.5-flash-001", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"];
      let text = "";
      for (const modelName of modelsToTry) {
        try {
          // Force v1 explicitly to bypass v1beta model masking limit.
          const model = genAI.getGenerativeModel(
            { model: modelName },
            { apiVersion: 'v1' }
          );
          const result = await model.generateContent(prompt);
          const response = await result.response;
          text = response.text() || "";
          if (text) break;
        } catch (err: any) {
          console.warn(`Model ${modelName} failed. Trying next...`, err.message);
          
          if (err.message.includes("429") || err.message.includes("quota")) {
            throw new Error(`Rate Limit Exceeded on ${modelName}! Please wait 60 seconds. Error: ${err.message}`);
          }
          if (modelName === modelsToTry[modelsToTry.length - 1]) {
            throw new Error(`Generation failed. Last error: ${err.message}`);
          }
        }
      }
      
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
      
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("AI returned invalid JSON.");
        parsed = JSON.parse(m[0]);
      }

      if (!parsed.entries || !Array.isArray(parsed.entries)) {
         throw new Error("AI response missing entries array.");
      }

      const map: Record<string, string> = {};
      for (const e of parsed.entries) {
        const day = eligibleDays.find((d) => d.dayNumber === e.dayNumber);
        if (day) {
           map[day.isoDate] = typeof e.entryData === 'object' ? JSON.stringify(e.entryData) : e.entryData || "";
        }
      }
      
      setDrafts(map);
      toast.success(`Generated ${Object.keys(map).length} entries — review and save.`);
    } catch (err: any) {
      console.error(err);
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

  const handleExportWord = async () => {
    try {
      const children: any[] = [];
      const sortedDays = eligibleDays
        .filter((d) => drafts[d.isoDate])
        .sort((a, b) => a.dayNumber - b.dayNumber);

      for (const d of sortedDays) {
        let parsed;
        try {
          parsed = JSON.parse(drafts[d.isoDate]);
        } catch {
          parsed = { summary: drafts[d.isoDate] };
        }

        children.push(
          new Paragraph({
            text: `Day ${d.dayNumber} — ${d.dateLabel}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Work Summary: ", bold: true }),
              new TextRun(parsed.summary || "No summary provided."),
            ],
            spacing: { after: 120 },
          })
        );

        if (parsed.hours) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: "Hours Logged: ", bold: true }), new TextRun(String(parsed.hours))],
            })
          );
        }
        if (parsed.learnings) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: "Learnings: ", bold: true }), new TextRun(parsed.learnings)],
            })
          );
        }
        if (parsed.skills) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: "Skills Used: ", bold: true }), new TextRun(parsed.skills)],
            })
          );
        }
      }

      if (children.length === 0) {
        toast.error("No valid entries to export.");
        return;
      }

      const doc = new Document({
        sections: [{ properties: {}, children }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `VTU_Internship_Diary_${allDays[0]?.isoDate || "Catchup"}.docx`);
      toast.success("Word document downloaded successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate Word document");
    }
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
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleSaveAll} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Save all as drafts"}
              </Button>
              <Button onClick={handleExportWord} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download as Word
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
