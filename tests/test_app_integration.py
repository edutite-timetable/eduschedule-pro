import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app

# The runtime patches are provided by sitecustomize.py. Import explicitly so
# routes and diagnostics are available even when the repository root is not
# on Python's startup path in CI.
import sitecustomize  # noqa: F401


def minimal_config():
    return {
        "grades": [4],
        "targetGrades": [4],
        "subjects": ["Math"],
        "teachers": {
            "T1": {
                "assignments": [
                    {"grade": 4, "streamIndex": 0, "subject": "Math", "lessons": 1}
                ],
                "maxLessons": 1,
                "maxPerDay": 1,
                "unavailDays": [],
            }
        },
        "timeSlots": [{"type": "lesson", "label": "Period 1"}],
        "workingDays": ["Monday"],
        "gradeStreams": {"4": 1},
    }


def test_health_endpoint():
    response = app.app.test_client().get("/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_real_solver_generates_a_valid_minimal_timetable():
    response = app.app.test_client().post("/generate?timeout=5&workers=1", json=minimal_config())
    assert response.status_code == 200, response.get_data(as_text=True)
    result = response.get_json()
    assert result["success"] is True
    assert result["quality"]["verified"] is True
    assert result["missing"] == 0
    assert result["fillers"] == 0
    assert result["timetable"]["4_0"]["days"]["Monday"][0]["subject"] == "Math"
    assert result["timetable"]["4_0"]["days"]["Monday"][0]["teacher"] == "T1"
    assert result["diagnostics"]["valid"] is True


def test_preflight_reports_capacity():
    config = minimal_config()
    config["teachers"]["T1"]["assignments"][0]["lessons"] = 2
    response = app.app.test_client().post("/api/preflight", json=config)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["feasible"] is False
    assert data["issues"]
