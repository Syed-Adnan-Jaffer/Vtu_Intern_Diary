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

function buildContext(profile: Profile, dayNumber: number, dateLabel: string) {
  return `Student context:
- Branch: ${profile.branch ?? "Engineering"}
- Internship: ${profile.internship_title ?? "Software Internship"} (${profile.internship_type ?? "General"})
- Company: ${profile.company_name ?? "the host organization"}
- Day ${dayNumber} of internship (${dateLabel})
${profile.weekly_plan ? `- Overall plan: ${profile.weekly_plan}` : ""}`;
}

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
    throw new Error("Missing Gemini API Key! Please add VITE_GEMINI_API_KEY=your_key_here to your .env file and restart Vite.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const userMsg = messages.find((m) => m.role === "user")?.content || "";
  
  const prompt = `${systemMsg}\n\n${userMsg}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error("AI service failed. Please check your API key and connection.");
  }
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

    const raw = await callAI([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ]);
    
    // strip code fences if any
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    return { content: cleaned };
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
