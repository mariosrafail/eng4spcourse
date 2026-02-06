const DND_ANSWERS = {
  module2_practice: ["doesn't like", "She", "likes", "Do", "flies"],
  module2_speaking: ["c", "d", "b", "f", "a", "e"],
  module2_h2_keywords: ["E", "C", "B", "D", "F", "A"],
  module2_h2_writing_task1: ["rates", "reservations", "beginning", "prices"]
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
