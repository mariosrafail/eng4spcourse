const QUIZ_ANSWERS = {
  module2_useful_language: { q1: "a", q2: "a", q3: "a" },
  module2_listening: { lq1: "b", lq2: "a", lq3: "b" },
  module2_h2_listening: { h2lq1: "b", h2lq2: "c", h2lq3: "a" },
  module2_reading: { r1: "c", r2: "c", r3: "c" },
  module2_h2_reading: { h2r1: "a", h2r2: "b", h2r3: "a" }
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
    const quizId = data?.quizId;
    const submitted = data?.answers;

    if (typeof quizId !== "string" || typeof submitted !== "object" || submitted === null || Array.isArray(submitted)) {
      return json(400, { error: "Expected quizId (string) and answers (object)" });
    }

    const expected = QUIZ_ANSWERS[quizId];
    if (!expected) {
      return json(404, { error: "Unknown quizId" });
    }

    let wrongCount = 0;
    const correctByQuestion = {};

    Object.entries(expected).forEach(([qid, correctValue]) => {
      const ok = submitted[qid] === correctValue;
      correctByQuestion[qid] = ok;
      if (!ok) wrongCount += 1;
    });

    return json(200, {
      quizId,
      allCorrect: wrongCount === 0,
      wrongCount,
      total: Object.keys(expected).length,
      correctByQuestion
    });
  } catch (e) {
    return json(500, { error: e?.message || "Internal error" });
  }
};
