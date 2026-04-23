import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are an academic assistant that writes professional VTU (Visvesvaraya Technological University) internship diary entries for engineering students.

Style guidelines:
- Formal, academic tone in third or first person (use first person, past tense).
- Length: 110-180 words per entry.
- Identify: 1. Objective, 2. Work done, 3. Learning outcome.
- Use the internship context to make entries plausible.
- Never invent confidential details. Keep it educational.`;

type Profile = {
  full_name: string | null;
  internship_type: string | null;
  internship_title: string | null;
  company_name: string | null;
  branch: string | null;
  weekly_plan: string | null;
};

function buildFallbackEntry(
  profile: Profile,
  bullets: string,
  dayNumber: number,
  dateLabel: string,
) {
  const bulletLines = bullets
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  const objective = bulletLines[0] ?? "Worked on assigned internship tasks";
  const workDone =
    bulletLines.length > 1 ? bulletLines.slice(0, 3).join("; ") : "Completed focused practical exercises";
  const learning = bulletLines[1] ?? bulletLines[0] ?? "Improved practical understanding of the topic";

  const summary = `On Day ${dayNumber} (${dateLabel}), I continued my internship work in ${profile.branch ?? "engineering"} at ${
    profile.company_name ?? "the host organization"
  }. The main objective was to ${objective.toLowerCase()}. During the session, I ${workDone.toLowerCase()}. I maintained a structured approach, verified each step, and documented key observations to keep the work aligned with internship expectations. This helped me build confidence in practical execution and strengthened my understanding of real-world workflow, communication, and problem-solving in a professional environment.`;

  return JSON.stringify(
    {
      summary,
      hours: "6.0",
      links: "",
      learnings: learning,
      blockers: "None",
      skills: "Problem Solving, Documentation, Communication",
    },
    null,
    2,
  );
}

function buildContext(profile: Profile, dayNumber: number, dateLabel: string) {
  return `Student context:
- Branch: ${profile.branch ?? "Engineering"}
- Internship: ${profile.internship_title ?? "Software Internship"} (${profile.internship_type ?? "General"})
- Company: ${profile.company_name ?? "the host organization"}
- Day ${dayNumber} of internship (${dateLabel})
${profile.weekly_plan ? `- Overall plan: ${profile.weekly_plan}` : ""}`;
}

function isValidDiaryJson(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "{}" || trimmed === "[]") return false;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return typeof parsed?.summary === "string" && parsed.summary.trim().length > 20;
  } catch {
    // Non-JSON prose is still acceptable as long as it is substantial.
    return trimmed.length > 60;
  }
}

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
    throw new Error("Missing Gemini API Key! Please add VITE_GEMINI_API_KEY=your_key_here to your .env file and restart Vite.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const userMsg = messages.find((m) => m.role === "user")?.content || "";
  
  const prompt = `${systemMsg}\n\n${userMsg}`;

  // Mirror the working catch-up strategy: prefer v1 endpoint and fallback across models.
  const models = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite-001",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
  ];
  let lastError: unknown = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text()?.trim() || "";
      if (text) return text;
    } catch (error: any) {
      lastError = error;
      console.error(`Gemini API Error (${modelName}):`, error);
    }
  }

  const lastMessage = lastError instanceof Error ? lastError.message : String(lastError ?? "");
  const quotaError =
    /quota|429|too many requests|rate limit|billing|free_tier|limit:\s*0/i.test(lastMessage);
  if (quotaError) {
    throw new Error(
      "Gemini quota exceeded for this API key (429). Enable billing or use a different key/project with available quota.",
    );
  }

  throw new Error("AI service returned no text from Gemini. Please verify API key permissions and model access.");
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

    try {
      const raw = await callAI([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);

      // Strip code fences if any, then ensure we actually got usable text back.
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
      if (!isValidDiaryJson(cleaned)) {
        const fallback = buildFallbackEntry(profile, data.bullets, data.dayNumber, data.dateLabel);
        return { content: fallback };
      }

      return { content: cleaned };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/quota|429|billing|rate limit|limit:\s*0/i.test(message)) {
        throw error;
      }
      const fallback = buildFallbackEntry(profile, data.bullets, data.dayNumber, data.dateLabel);
      return { content: fallback };
    }
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
{ "entries": [ { "dayNumber": <number>, "entryData": { "summary": "...", "hours": "6.5", "links": "", "learnings": "...", "blockers": "None", "skills": "..." } } ] }`;

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
    
    const formattedEntries = parsed.entries.map((e: any) => ({
      dayNumber: e.dayNumber,
      content: typeof e.entryData === 'object' ? JSON.stringify(e.entryData) : e.content || JSON.stringify({ summary: e.content })
    }));

    return { entries: formattedEntries };
  });
