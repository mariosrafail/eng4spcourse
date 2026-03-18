const DND_ANSWERS = {
  module1_practice: ["are", "in", "like", "prefer", "she", "this", "glad"],
  module1_speaking: ["d", "f", "a", "b", "c", "e"],
  module1_h2_keywords: ["F", "C", "E", "A", "D", "B"],
  module1_h2_writing_task1: ["flight", "visit", "island", "travel", "ferry"],
  module3_activity2: ["C", "F", "A", "D", "E", "B"],
  module3_practice: ["guided", "attractions", "flying", "will drive", "wearing", "usually"],
  module3_speaking: ["d", "f", "b", "e", "a", "c"],
  module3_h2_writing_task1: ["A", "C", "E", "B", "F"],
  module3_h2_recall: ["C", "A", "B", "D"],
  module2_practice: ["doesn't like", "she", "likes", "do", "flies"],
  module2_speaking: ["c", "d", "b", "f", "a", "e"],
  module2_h2_keywords: ["E", "C", "B", "D", "F", "A"],
  module3_h2_keywords: ["D", "C", "E", "A", "B", "G", "F"],
  module2_h2_writing_task1: ["rates", "reservations", "beginning", "prices"],
  module4_activity2: ["C", "A", "D", "B", "E"],
  module4_practice: ["baggage", "shuttle bus", "included", "nearest", "safe", "there", "leave", "walked", "was"],
  module4_h2_keywords: ["D", "C", "A", "F", "E", "B"],
  module4_h2_writing_task1: ["G", "E", "C", "D", "B"],
  module5_h1_keywords: ["cockroach", "impatient", "disappointed", "front desk assistant", "angry", "upset"],
  module5_h2_keywords: ["G", "E", "A", "C", "F", "B", "D"],
  module5_h1_revision: ["D", "C", "B", "A"],
  module5_h2_writing_task1: ["A", "D", "F", "C", "E", "B"],
  module6_practice: ["a", "c"],
  module6_h2_keywords: ["D", "B", "E", "A", "C"],
  module6_h2_reading_heard: ["hear", "empathise", "apologise", "resolve", "diagnose"],
  module6_h2_writing_task1: ["F", "C", "B", "A"],
  module7_activity2: ["E", "C", "A", "F", "B", "D"],
  module7_h1_keywords: ["A", "I", "E", "G", "F", "H", "D", "C", "B"],
  module7_practice: ["are", "be", "are", "is"],
  module7_h1_reading_terms: ["open", "search", "log in", "save"],
  module7_speaking: ["c", "b", "d", "a", "e"],
  module7_h2_writing_task1: ["will", "you", "there", "be", "have", "us"],
  module8_h1_activity1: ["E", "B", "D", "C", "A"],
  module8_h1_activity2_partb: ["B", "A", "E", "D", "C", "J", "F", "H", "G", "I"],
  module8_h1_activity2_partc: ["get up", "get rid of", "get in touch", "get ready", "take a photo", "take a shower", "take time", "take a break"],
  module8_h2_mock_writing_task1: ["for", "plans", "to", "give"],
  mini_mock_writing_1: ["manners", "warm", "respect", "team"]
};

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const data = await req.json();
    const exerciseId = data?.exerciseId;
    const submitted = data?.answers;

    if (typeof exerciseId !== "string" || !Array.isArray(submitted)) {
      return json(400, { error: "Expected exerciseId (string) and answers (array)" });
    }

    const expected = DND_ANSWERS[exerciseId];
    if (!expected) {
      return json(404, { error: "Unknown exerciseId" });
    }

    if (submitted.length !== expected.length) {
      return json(400, { error: "Answers length mismatch" });
    }

    const correctByIndex = [];
    let wrongCount = 0;

    expected.forEach((correctValue, i) => {
      const ok = submitted[i] === correctValue;
      correctByIndex.push(ok);
      if (!ok) wrongCount += 1;
    });

    return json(200, {
      exerciseId,
      allCorrect: wrongCount === 0,
      wrongCount,
      total: expected.length,
      correctByIndex
    });
  } catch (e) {
    return json(500, { error: e?.message || "Internal error" });
  }
};
