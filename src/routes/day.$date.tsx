import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { generateDiaryEntry } from "@/server/diary.functions";
import { buildInternshipDays, formatDayLabel } from "@/lib/diary-utils";
import { parseISO } from "date-fns";
import { ArrowLeft, Sparkles, Save, CheckCircle2, Trash2, Clock, Link as LinkIcon, BookOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { DIARY_CURRICULUM } from "@/lib/diaryData";

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

  const [bullets, setBullets] = useState("");
  const [entryData, setEntryData] = useState({
    summary: "",
    hours: "",
    links: "",
    learnings: "",
    blockers: "",
    skills: "",
  });

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
        setStatus((entry.status as "draft" | "finalized") ?? "draft");
        if (entry.content) {
          try {
            const parsed = JSON.parse(entry.content);
            setEntryData({
              summary: parsed.summary || "",
              hours: parsed.hours || "",
              links: parsed.links || "",
              learnings: parsed.learnings || "",
              blockers: parsed.blockers || "",
              skills: parsed.skills || "",
            });
          } catch {
            // fallback
            setEntryData(prev => ({ ...prev, summary: entry.content || "" }));
          }
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user, date]);

  const handleChange = (field: keyof typeof entryData, value: string) => {
    setEntryData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    // Pull from the 'java' curriculum for now, or you can make this dynamic
    const localEntry = (DIARY_CURRICULUM as any).java?.[date];

    if (localEntry) {
      setBullets(localEntry.bullets || "Loaded from curriculum");
      setEntryData({
        summary: localEntry.summary || "",
        hours: "6.5",
        links: "",
        learnings: localEntry.learnings || "",
        blockers: "None",
        skills: Array.isArray(localEntry.skills) ? localEntry.skills.join(", ") : (localEntry.skills || ""),
      });
      toast.success("Loaded from local curriculum!");
      return;
    }

    if (!bullets.trim()) {
      toast.error("Add a few bullet points first.");
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

      const prompt = `You are a professional VTU internship mentor. 
      The student has noted these bullet points for their work today:
      ${bullets}

      Generate a diary entry in JSON format with EXACTLY these fields:
      "summary": (around 50 words describing the objective and work done in first-person past-tense),
      "hours": (a number between 5.5 and 6.5),
      "links": (any helpful dummy links if requested, otherwise empty),
      "learnings": (1-2 sentences on what was learned or skills gained),
      "blockers": ("None" or inferred from bullets),
      "skills": (Comma separated list of 3-5 technical keywords)
      
      Output STRICTLY a valid JSON object. No markdown, no fences.`;

      // Flash models have significantly higher free-tier limits.
      const modelsToTry = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite-001", "gemini-1.5-flash-001", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"];
      let text = "";
      for (const modelName of modelsToTry) {
        try {
          // Explicitly forcing v1 instead of v1beta to ensure stable API endpoint resolving
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
          
          // CRITICAL: Do NOT swallow rate limit errors!
          if (err.message.includes("429") || err.message.includes("quota")) {
            throw new Error(`Rate Limit Exceeded on ${modelName}! Please wait 60 seconds. Error: ${err.message}`);
          }
          // if it's the last one, we will find out exactly what their key supports!
          if (modelName === modelsToTry[modelsToTry.length - 1]) {
            try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
              const data = await res.json();
              if (data.models && Array.isArray(data.models)) {
                 const available = data.models
                   .filter((m: any) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
                   .map((m: any) => m.name.replace('models/', ''));
                 throw new Error(`Generation failed! Valid models: ${available.slice(0, 5).join(', ')}... Original Error: ${err.message}`);
              } else if (data.error) {
                 throw new Error(`API Key Error: ${data.error.message}`);
              }
              throw new Error(`All Gemini models failed. Last error: ${err.message}`);
            } catch (fetchErr: any) {
              if (fetchErr.message.includes('Original Error')) {
                 throw fetchErr;
              }
              throw new Error(`Generation failed. Last error: ${err.message}`);
            }
          }
        }
      }
      
      // Clean up potential markdown formatting code blocks
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
      
      try {
        const parsed = JSON.parse(text);
        setEntryData({
          summary: parsed.summary || "",
          hours: parsed.hours ? String(parsed.hours) : "6.5",
          links: parsed.links || "",
          learnings: parsed.learnings || "",
          blockers: parsed.blockers || "",
          skills: parsed.skills || "",
        });
        toast.success("Entry generated directly on frontend — review and edit before saving.");
      } catch (parseError) {
        console.error("Failed to parse JSON:", text);
        setEntryData(prev => ({ ...prev, summary: text }));
        toast.error("AI returned invalid format, dumped to summary.");
      }
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const save = async (newStatus: "draft" | "finalized") => {
    if (!user) return;
    if (newStatus === "finalized" && (!entryData.summary.trim() || !entryData.learnings.trim())) {
      toast.error("Cannot finalize an entry with missing required fields.");
      return;
    }
    setSaving(true);
    const contentStr = JSON.stringify(entryData);

    const { error } = await supabase.from("diary_entries").upsert(
      {
        user_id: user.id,
        entry_date: date,
        day_number: dayNumber,
        bullets,
        content: contentStr,
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
    setEntryData({ summary: "", hours: "", links: "", learnings: "", blockers: "", skills: "" });
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
          ) : entryData.summary ? (
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
            {generating ? "Generating…" : entryData.summary ? "Regenerate from bullets" : "Generate diary entry"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <FieldGroup label="Work Summary" required>
            <Textarea
              rows={8}
              value={entryData.summary}
              onChange={(e) => handleChange("summary", e.target.value)}
              placeholder="Briefly describe the work you did today..."
            />
          </FieldGroup>

          <FieldGroup label="Hours worked" required icon={Clock}>
            <Input
              value={entryData.hours}
              onChange={(e) => handleChange("hours", e.target.value)}
              placeholder="e.g. 6.5"
            />
            <p className="text-xs text-muted-foreground">Allowed range: 0-24 (supports 0.25 steps)</p>
          </FieldGroup>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-lg mb-2 text-primary">Show Your Work (Links)</h3>
            <FieldGroup label="Reference Links" icon={LinkIcon}>
              <Textarea
                rows={2}
                value={entryData.links}
                onChange={(e) => handleChange("links", e.target.value)}
                placeholder="Paste one or more relevant links, separated by commas"
              />
            </FieldGroup>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-lg mb-2 text-primary">Blockers & Learnings</h3>
            <FieldGroup label="Learnings / Outcomes" required icon={BookOpen}>
              <Textarea
                rows={5}
                value={entryData.learnings}
                onChange={(e) => handleChange("learnings", e.target.value)}
                placeholder="What did you learn or ship today?"
              />
            </FieldGroup>

            <FieldGroup label="Blockers / Risks" icon={AlertTriangle}>
              <Textarea
                rows={3}
                value={entryData.blockers}
                onChange={(e) => handleChange("blockers", e.target.value)}
                placeholder="Anything that slowed you down?"
              />
            </FieldGroup>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-lg mb-2 text-primary">Skills</h3>
            <FieldGroup label="Skills Used" required>
              <Input
                value={entryData.skills}
                onChange={(e) => handleChange("skills", e.target.value)}
                placeholder="Add skills"
              />
            </FieldGroup>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 justify-end">
            <Button variant="outline" onClick={() => void save("draft")} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              Save draft
            </Button>
            <Button onClick={() => void save("finalized")} disabled={saving}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Finalize
            </Button>
            {(entryData.summary || bullets) && (
              <Button variant="ghost" onClick={handleDelete} className="text-destructive">
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

function FieldGroup({ label, required, icon: Icon, children }: any) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center text-sm font-medium">
        {Icon && <Icon className="mr-1.5 h-4 w-4 text-muted-foreground" />}
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}
