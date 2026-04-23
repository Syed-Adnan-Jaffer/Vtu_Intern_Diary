require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = 'The student notes: Java : Introduction. Generate the diary entry as a JSON object with these EXACT keys: { "summary": "110-160 words describing the objective and work done", "hours": "generate a random number between 5.5 and 6.5", "links": "", "learnings": "What was learned/skills gained", "blockers": "None", "skills": "Comma separated list of technologies matching the notes" } Output STRICTLY a JSON object. No markdown formatting.';
  
  try {
    const res = await model.generateContent(prompt);
    console.log('RESULT:', res.response.text());
  } catch(e) {
    console.error(e);
  }
}

test();
