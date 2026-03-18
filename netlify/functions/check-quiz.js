const QUIZ_ANSWERS = {
  module1_useful_language: { m1q1: "a", m1q2: "a", m1q3: "a", m1q4: "a", m1q5: "a" },
  module1_listening: { lq1: "b", lq2: "b", lq3: "b" },
  module1_reading: { r1: "b", r2: "a", r3: "a" },
  module1_h2_listening: { h2lq1: "a", h2lq2: "c", h2lq3: "a" },
  module1_h2_reading: { h2r1: "b", h2r2: "a", h2r3: "c" },
  module2_useful_language: { q1: "a", q2: "a", q3: "a" },
  module2_listening: { lq1: "b", lq2: "a", lq3: "b" },
  module2_h2_listening: { h2lq1: "b", h2lq2: "c", h2lq3: "a" },
  module2_reading: { r1: "c", r2: "c", r3: "c" },
  module2_h2_reading: { h2r1: "a", h2r2: "b", h2r3: "a" },
  module3_reading: { r1: "b", r2: "c", r3: "b" },
  module3_h2_listening: { h2lq1: "b", h2lq2: "a", h2lq3: "c" },
  module3_h2_reading: { h2r1: "b", h2r2: "b", h2r3: "b" },
  module3_keywords_listening: { m3kq1: "b", m3kq2: "a", m3kq3: "c" },
  module4_useful_language: { m4ul1: "c", m4ul2: "a", m4ul3: "d", m4ul4: "b", m4ul5: "e" },
  module4_listening: { m4lq1: "b", m4lq2: "c", m4lq3: "a" },
  module4_reading: { m4r1: "b", m4r2: "a", m4r3: "b" },
  module4_h2_listening: { m4h2lq1: "b", m4h2lq2: "a", m4h2lq3: "b" },
  module4_h2_reading: { m4h2r1: "b", m4h2r2: "c", m4h2r3: "b", m4h2r4: "a" },
  module5_listening: { m5lq1: "b", m5lq2: "d", m5lq3: "a", m5lq4: "c" },
  module5_h2_listening: { m5h2lq1: "d", m5h2lq2: "b", m5h2lq3: "c", m5h2lq4: "a" },
  module5_h2_reading: { m5h2r1: "a", m5h2r2: "b" },
  module5_speaking: { m5sp1: "b", m5sp2: "a" },
  module6_listening: { m6lq1: "c", m6lq2: "b", m6lq3: "c" },
  module6_reading: { m6r1: "a", m6r2: "b", m6r3: "b" },
  module6_h2_listening: { m6h2lq1: "b", m6h2lq2: "a", m6h2lq3: "a", m6h2lq4: "a" },
  module7_listening: { m7lq1: "b", m7lq2: "a", m7lq3: "b" },
  module7_h2_listening: { m7h2lq1: "a", m7h2lq2: "a", m7h2lq3: "b", m7h2lq4: "b" },
  module7_h2_reading: { m7h2r1: "b", m7h2r2: "a" },
  module8_h2_mock_listening: { m8h2lq1: "a", m8h2lq2: "b", m8h2lq3: "c", m8h2lq4: "a", m8h2lq5: "c", m8h2lq6: "b", m8h2lq7: "b", m8h2lq8: "a" },
  module8_h2_mock_reading_a: { m8h2ra1: "a", m8h2ra2: "a", m8h2ra3: "b", m8h2ra4: "a" },
  module8_h2_mock_reading_b: { m8h2rb5: "c", m8h2rb6: "a", m8h2rb7: "a", m8h2rb8: "c" },
  mini_mock_listening_1a: { mq1: "b", mq2: "c" },
  mini_mock_listening_1b: { mq3: "a", mq4: "b", mq5: "c" },
  mini_mock_reading_1: { mqr1: "b", mqr2: "a", mqr3: "b", mqr4: "b" },
  mini_mock_reading_2: { mqrb5: "a", mqrb6: "c", mqrb7: "b", mqrb8: "a" }
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
