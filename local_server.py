import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import PurePosixPath


HOST = "127.0.0.1"
PORT = 8000

# Keep answer keys server-side only.
QUIZ_ANSWERS = {
    "module2_useful_language": {"q1": "a", "q2": "a", "q3": "a"},
    "module2_listening": {"lq1": "b", "lq2": "a", "lq3": "b"},
    "module2_h2_listening": {"h2lq1": "b", "h2lq2": "c", "h2lq3": "a"},
    "module2_reading": {"r1": "c", "r2": "c", "r3": "c"},
    "module2_h2_reading": {"h2r1": "a", "h2r2": "b", "h2r3": "a"},
}

# Drag-and-drop / gap-fill answers server-side only.
DND_ANSWERS = {
    "module2_practice": ["doesn't like", "She", "likes", "Do", "flies"],
    "module2_speaking": ["c", "d", "b", "f", "a", "e"],
    "module2_h2_keywords": ["E", "C", "B", "D", "F", "A"],
    "module2_h2_writing_task1": ["rates", "reservations", "beginning", "prices"],
}


def json_bytes(payload):
    return json.dumps(payload, ensure_ascii=True).encode("utf-8")


class AppHandler(SimpleHTTPRequestHandler):
    def _send_json(self, status_code, payload):
        body = json_bytes(payload)
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _is_private_path(self):
        path = PurePosixPath(self.path.split("?", 1)[0].lstrip("/"))
        return str(path).startswith(".private") or str(path) in {"local_server.py"}

    def do_GET(self):
        if self._is_private_path():
            self.send_error(404, "Not found")
            return
        super().do_GET()

    def do_POST(self):
        if self.path not in {"/api/check-quiz", "/api/check-dnd"}:
            self.send_error(404, "Not found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "Invalid Content-Length"})
            return

        raw_body = self.rfile.read(content_length)
        try:
            data = json.loads(raw_body.decode("utf-8"))
        except Exception:
            self._send_json(400, {"error": "Invalid JSON body"})
            return

        if self.path == "/api/check-quiz":
            quiz_id = data.get("quizId")
            submitted = data.get("answers")
            if not isinstance(quiz_id, str) or not isinstance(submitted, dict):
                self._send_json(400, {"error": "Expected quizId (string) and answers (object)"})
                return

            expected = QUIZ_ANSWERS.get(quiz_id)
            if expected is None:
                self._send_json(404, {"error": "Unknown quizId"})
                return

            correct_by_question = {}
            wrong_count = 0

            for qid, correct_value in expected.items():
                is_correct = submitted.get(qid) == correct_value
                correct_by_question[qid] = is_correct
                if not is_correct:
                    wrong_count += 1

            self._send_json(
                200,
                {
                    "quizId": quiz_id,
                    "allCorrect": wrong_count == 0,
                    "wrongCount": wrong_count,
                    "total": len(expected),
                    "correctByQuestion": correct_by_question,
                },
            )
            return

        exercise_id = data.get("exerciseId")
        submitted = data.get("answers")
        if not isinstance(exercise_id, str) or not isinstance(submitted, list):
            self._send_json(400, {"error": "Expected exerciseId (string) and answers (array)"})
            return

        expected = DND_ANSWERS.get(exercise_id)
        if expected is None:
            self._send_json(404, {"error": "Unknown exerciseId"})
            return

        if len(submitted) != len(expected):
            self._send_json(400, {"error": "Answers length mismatch"})
            return

        correct_by_index = []
        wrong_count = 0

        for i, correct_value in enumerate(expected):
            got_value = submitted[i]
            is_correct = got_value == correct_value
            correct_by_index.append(is_correct)
            if not is_correct:
                wrong_count += 1

        self._send_json(
            200,
            {
                "exerciseId": exercise_id,
                "allCorrect": wrong_count == 0,
                "wrongCount": wrong_count,
                "total": len(expected),
                "correctByIndex": correct_by_index,
            },
        )


def main():
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f"Server started on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
