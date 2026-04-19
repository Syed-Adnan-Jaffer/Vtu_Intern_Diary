import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are an academic assistant that writes professional VTU (Visvesvaraya Technological University) internship diary entries for engineering students.

Style guidelines:
- Formal, academic tone in third or first person (use first person, past tense).
- Length: 110-180 words per entry.
- Structure each entry with three implicit parts (do not use headings):
  1. Objective (what was the goal that day),
  2. Work done (what was actually done — be specific with technologies/concepts),
  3. Learning outcome (what was learned/skills gained).
- Use the internship context (type, company, technologies) to make entries plausible.
- Vary sentence structure across entries; do not repeat opening phrases.
- Never invent confidential details. Keep it educational.
- Output ONLY the diary entry text, no titles, no markdown, no bullet points.`;

type Profile = {
  full_name: string | null;
  internship_type: string | null;
  internship_title: string | null;
  company_name: string | null;
  branch: string | null;
  weekly_plan: string | null;
};

function buildContext(profile: Profile, dayNumber: number, dateLabel: string) {
  return `Student context:
- Branch: ${profile.branch ?? "Engineering"}
- Internship: ${profile.internship_title ?? "Software Internship"} (${profile.internship_type ?? "General"})
- Company: ${profile.company_name ?? "the host organization"}
- Day ${dayNumber} of internship (${dateLabel})
${profile.weekly_plan ? `- Overall plan: ${profile.weekly_plan}` : ""}`;
}

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI service is not configured");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
    }),
  });

  if (resp.status === 429) {
    throw new Error("Rate limit reached. Please wait a moment and try again.");
  }
  if (resp.status === 402) {
    throw new Error("AI credits exhausted. Please add credits in Settings → Workspace → Usage.");
  }
  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error:", resp.status, t);
    throw new Error("AI service failed. Please try again.");
  }
  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export const generateDiaryEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      bullets: string;
      dayNumber: number;
      dateLabel: string;
    }) => {
      if (!input.bullets || input.bullets.trim().length < 3) {
        throw new Error("Please provide at least a few words about what you learned.");
      }
      if (input.bullets.length > 2000) {
        throw new Error("Bullets too long (max 2000 chars).");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name, internship_type, internship_title, company_name, branch, weekly_plan")
      .single();
    if (error || !profile) {
      throw new Error("Profile not found. Please complete your internship setup first.");
    }
    const ctx = buildContext(profile, data.dayNumber, data.dateLabel);
    const userPrompt = `${ctx}

The student's notes for the day:
${data.bullets}

Write the polished diary entry now.`;

    const content = await callAI([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ]);
    return { content };
  });

export const generateBulkEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      summary: string;
      days: Array<{ isoDate: string; dayNumber: number; dateLabel: string }>;
    }) => {
      if (!input.summary || input.summary.trim().length < 10) {
        throw new Error("Please provide a brief summary of topics covered.");
      }
      if (!input.days || input.days.length === 0) {
        throw new Error("No days selected.");
      }
      if (input.days.length > 30) {
        throw new Error("Please catch up at most 30 days at a time.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name, internship_type, internship_title, company_name, branch, weekly_plan")
      .single();
    if (error || !profile) {
      throw new Error("Profile not found.");
    }

    const baseCtx = `Student context:
- Branch: ${profile.branch ?? "Engineering"}
- Internship: ${profile.internship_title ?? "Software Internship"} (${profile.internship_type ?? "General"})
- Company: ${profile.company_name ?? "the host organization"}
${profile.weekly_plan ? `- Weekly plan: ${profile.weekly_plan}` : ""}`;

    const dayList = data.days
      .map((d) => `- Day ${d.dayNumber} (${d.dateLabel})`)
      .join("\n");

    const userPrompt = `${baseCtx}

Topics covered across this period (use these as the source material):
${data.summary}

Generate ONE diary entry for EACH of the following ${data.days.length} days. Spread the topics naturally across days in a logical learning progression — do not repeat the same content. Vary phrasing, sentence structure, and the specific aspect emphasized each day.

Days to fill:
${dayList}

Output a JSON object only, no markdown, with this exact shape:
{ "entries": [ { "dayNumber": <number>, "content": "<diary text 110-180 words>" }, ... ] }`;

    const raw = await callAI([
      { role: "system", content: SYSTEM_PROMPT + "\n\nWhen asked for multiple days, output strict JSON as instructed." },
      { role: "user", content: userPrompt },
    ]);

    // strip code fences if any
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    let parsed: { entries: Array<{ dayNumber: number; content: string }> };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // try to extract JSON block
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned an invalid response. Please try again.");
      parsed = JSON.parse(m[0]);
    }
    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      throw new Error("AI response missing entries.");
    }
    return { entries: parsed.entries };
  });
