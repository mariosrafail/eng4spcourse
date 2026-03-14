import { scoreWritingWithAI } from "./_lib/writing-score.js";

export default async (req) => {
  try {
    const { text, taskPrompt, taskHint, maxWords } = await req.json();
    const result = await scoreWritingWithAI({ text, taskPrompt, taskHint, maxWords });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Writing scoring failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
