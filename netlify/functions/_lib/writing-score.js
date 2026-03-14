function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const contentParts = [];
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        contentParts.push(part.text);
      }
    }
  }
  return contentParts.join("\n").trim();
}

function sanitizeStringList(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function buildPrompt({ text, taskPrompt, taskHint, maxWords }) {
  return [
    "Evaluate this English writing task for a learner.",
    `Task instructions: ${taskPrompt || "Short writing response."}`,
    `Task hint/checklist: ${taskHint || "No hint provided."}`,
    `Maximum words: ${maxWords || 50}.`,
    "",
    "Return strict JSON only with this shape:",
    '{"score":0,"summary":"","notes":[""],"issues":[""],"isNonsense":false}',
    "",
    "Scoring rules:",
    "- Score from 0 to 10.",
    "- Give 0 if the answer is nonsense, a random word list, unrelated, or not a meaningful message.",
    "- Judge task completion, relevance, coherence, sentence quality, grammar, and clarity.",
    "- 'notes' must be actionable bullet points about missing or improved content.",
    "- 'issues' must be short writing-quality checks about grammar, punctuation, capitalization, or structure.",
    "- Keep notes and issues concise.",
    "- If the answer is strong, notes and issues can be empty arrays.",
    "",
    "Student answer:",
    text || ""
  ].join("\n");
}

export async function scoreWritingWithAI({
  text,
  taskPrompt,
  taskHint,
  maxWords = 50,
  model = process.env.OPENAI_WRITING_MODEL || "gpt-4.1-mini"
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "You are a strict English writing examiner for hospitality learners. Detect nonsense, unrelated text, or word-salad and score it as zero."
        },
        {
          role: "user",
          content: buildPrompt({ text, taskPrompt, taskHint, maxWords })
        }
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `OpenAI request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const rawText = extractOutputText(data);
  if (!rawText) {
    throw new Error("OpenAI returned no text output.");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("OpenAI returned invalid JSON.");
  }

  const result = {
    score: clampScore(parsed?.score),
    summary: String(parsed?.summary || "").trim(),
    notes: sanitizeStringList(parsed?.notes),
    issues: sanitizeStringList(parsed?.issues),
    isNonsense: !!parsed?.isNonsense
  };

  if (!result.summary) {
    result.summary = result.score >= 8
      ? "Strong answer. Minor tweaks only."
      : (result.score >= 5 ? "Good start. Improve the missing points below." : "Needs work. Follow the checklist below.");
  }

  return result;
}
