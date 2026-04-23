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
  const generate = useServerFn(generateDiaryEntry);

  const [bullets, setBullets] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "finalized">("draft");
  const [dayNumber, setDayNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const normalizeGeneratedText = (text: string): string => {
    const trimmed = text.trim();
    if (!trimmed) return "";
    if (trimmed === "{}" || trimmed === "[]") return "";

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") return trimmed;

      const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
      const learnings = typeof parsed.learnings === "string" ? parsed.learnings.trim() : "";
      const skills = typeof parsed.skills === "string" ? parsed.skills.trim() : "";
      const hours = typeof parsed.hours === "string" ? parsed.hours.trim() : "";
      const blockers = typeof parsed.blockers === "string" ? parsed.blockers.trim() : "";

      if (!summary) return "";

      const parts = [summary];
      if (learnings) parts.push(`Learnings: ${learnings}`);
      if (skills) parts.push(`Skills: ${skills}`);
      if (hours) parts.push(`Hours: ${hours}`);
      if (blockers) parts.push(`Blockers: ${blockers}`);
      return parts.join("\n\n");
    } catch {
      return trimmed;
    }
  };

  const extractGeneratedContent = (payload: unknown): string => {
    const deepFindText = (value: unknown, depth = 0): string => {
      if (depth > 4 || value == null) return "";
      if (typeof value === "string") return value.trim();
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = deepFindText(item, depth + 1);
          if (found) return found;
        }
        return "";
      }
      if (typeof value !== "object") return "";

      const obj = value as Record<string, unknown>;
      const priorityKeys = ["content", "text", "summary", "message"];
      for (const key of priorityKeys) {
        if (typeof obj[key] === "string" && (obj[key] as string).trim()) {
          return (obj[key] as string).trim();
        }
      }

      for (const nested of Object.values(obj)) {
        const found = deepFindText(nested, depth + 1);
        if (found) return found;
      }
      return "";
    };

    if (typeof payload === "string") return payload.trim();
    if (!payload || typeof payload !== "object") return "";

    const obj = payload as Record<string, unknown>;
    const direct = obj.content;
    if (typeof direct === "string") return direct.trim();

    const data = obj.data;
    if (data && typeof data === "object" && typeof (data as Record<string, unknown>).content === "string") {
      return ((data as Record<string, unknown>).content as string).trim();
    }

    const result = obj.result;
    if (result && typeof result === "object" && typeof (result as Record<string, unknown>).content === "string") {
      return ((result as Record<string, unknown>).content as string).trim();
    }

    const deepText = deepFindText(payload);
    if (deepText) return deepText;
    return "";
  };

  const buildClientFallbackContent = (rawBullets: string, day: number | null, dayLabel: string): string => {
    const items = rawBullets
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);

    const objective = items[0] ?? "complete assigned internship tasks";
    const work = items.length > 1 ? items.slice(0, 3).join("; ") : "perform practical learning activities";
    const learning = items[1] ?? items[0] ?? "improved understanding through hands-on practice";

    return `On Day ${day ?? "?"} (${dayLabel}), I focused on ${objective.toLowerCase()}. During the session, I worked on ${work.toLowerCase()}. I followed a structured and practical approach to complete the assigned work, verify outcomes, and maintain proper documentation. This activity strengthened my technical confidence and helped me understand how theoretical concepts are applied in a real professional environment. I also improved my communication, planning, and problem-solving skills while carrying out the tasks. Overall, the day was productive and contributed meaningfully to my internship learning progress.\n\nKey Learning: ${learning}\nSkills: Problem Solving, Documentation, Communication`;
  };

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

    const javaEntry = (DIARY_CURRICULUM.java as any)[date];
    const sqlEntry = (DIARY_CURRICULUM.sql as any)[date];
    const localEntry = javaEntry || sqlEntry;

  if (localEntry) {
    setBullets(`- ${localEntry.summary}\n- ${localEntry.learnings}`);
    setContent(`${localEntry.summary}\n\n${localEntry.learnings}\n\nSkills: ${localEntry.skills.join(', ')}`);
    toast.success("Loaded from local curriculum!");
    return; // Stop here, no need to call the expensive AI
  }

  // FALLBACK: Original AI logic if date isn't in our local list
  if (!bullets.trim()) {
    toast.error("Add a few bullet points first.");
    return;
  }
    setGenerating(true);
    try {
      const dateLabel = formatDayLabel(parseISO(date));
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing VITE_GEMINI_API_KEY in .env");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const prompt = `You are an academic assistant that writes professional VTU internship diary entries.

Student day info:
- Day ${dayNumber ?? 1} (${dateLabel})

The student's notes for the day:
${bullets}

Generate the diary entry as a JSON object with these EXACT keys:
{
  "summary": "110-160 words describing the objective and work done",
  "hours": "generate a random number between 5.5 and 6.5",
  "links": "",
  "learnings": "What was learned/skills gained",
  "blockers": "None",
  "skills": "Comma separated list of technologies matching the notes"
}
Output STRICTLY a JSON object. No markdown formatting.`;

      const modelsToTry = [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite-001",
        "gemini-1.5-flash-001",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
      ];

      let text = "";
      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1" });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          text = (response.text() || "").replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
          if (text) break;
        } catch (modelErr) {
          console.warn(`Single-day model ${modelName} failed`, modelErr);
        }
      }

      // Keep existing server function as a fallback path if client models all fail.
      if (!text) {
        const res = await generate({ data: { bullets, dayNumber: dayNumber ?? 1, dateLabel } });
        text = extractGeneratedContent(res);
      }

      const generatedText = normalizeGeneratedText(text);
      if (!generatedText) {
        const fallbackText = buildClientFallbackContent(bullets, dayNumber, dateLabel);
        setContent(fallbackText);
        toast.warning("AI returned empty output. Loaded a local generated draft instead.");
        return;
      }
      setContent(generatedText);
      toast.success("Entry generated — review and edit before saving.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      if (/quota|429|billing|rate limit|limit:\s*0/i.test(message)) {
        toast.error("Gemini quota exceeded (429). Update billing/key, then try again.");
      } else {
        toast.error(message);
      }
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
