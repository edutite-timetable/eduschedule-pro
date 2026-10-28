import sys
from pathlib import Path

# Ensure repository-root modules import consistently under pytest and CI.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import quality_engine


def base_config():
    return {
        "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "rules": {"maxTeacherPerDay": 8},
        "teachers": {
            "T1": {
                "assignments": [
                    {"grade": 4, "streamIndex": 0, "subject": "Math", "lessons": 5},
                ],
                "maxLessons": 12,
                "maxPerDay": 5,
                "unavailDays": [],
            },
            "T2": {
                "assignments": [
                    {"grade": 4, "streamIndex": 0, "subject": "English", "lessons": 1},
                ],
                "maxLessons": 8,
                "maxPerDay": 5,
                "unavailDays": [],
            },
        },
    }


def timetable_for_grade4():
    return {
        "4": {
            "grade": 4,
            "streamIndex": 0,
            "days": {
                "Monday": [
                    {"subject": "Math", "teacher": "T1"},
                    {"subject": "English", "teacher": "T2"},
                ],
                "Tuesday": [{"subject": "Math", "teacher": "T1"}],
                "Wednesday": [{"subject": "Math", "teacher": "T1"}],
                "Thursday": [{"subject": "Math", "teacher": "T1"}],
                "Friday": [{"subject": "Math", "teacher": "T1"}],
            },
        }
    }


def test_valid_complete_schedule_is_valid():
    result = quality_engine.analyze(base_config(), timetable_for_grade4())
    assert result["valid"] is True
    assert result["missingLessons"] == []
    assert result["teacherClashes"] == []
    assert result["classClashes"] == []
    assert result["ineligibleTeachers"] == []
    assert result["teacherUnavailable"] == []


def test_teacher_clash_is_detected():
    config = base_config()
    timetable = timetable_for_grade4()
    timetable["5"] = {
        "grade": 5,
        "streamIndex": 0,
        "days": {"Monday": [{"subject": "Math", "teacher": "T1"}]},
    }
    result = quality_engine.analyze(config, timetable)
    assert result["valid"] is False
    assert result["teacherClashes"]


def test_ineligible_teacher_is_detected():
    config = base_config()
    timetable = timetable_for_grade4()
    timetable["4"]["days"]["Monday"][0]["teacher"] = "T2"
    result = quality_engine.analyze(config, timetable)
    assert result["valid"] is False
    assert result["ineligibleTeachers"]


def test_unavailable_teacher_is_detected():
    config = base_config()
    config["teachers"]["T1"]["unavailDays"] = ["Monday"]
    result = quality_engine.analyze(config, timetable_for_grade4())
    assert result["valid"] is False
    assert result["teacherUnavailable"]


def test_missing_lessons_are_detected():
    config = base_config()
    timetable = timetable_for_grade4()
    timetable["4"]["days"]["Friday"] = []
    result = quality_engine.analyze(config, timetable)
    assert result["valid"] is False
    assert result["missingLessons"]
    assert result["completeness"] < 1


def test_free_working_day_warning_is_detected():
    config = base_config()
    timetable = timetable_for_grade4()
    timetable["4"]["days"]["Friday"] = []
    result = quality_engine.analyze(config, timetable)
    assert result["freeWorkingDays"]


def test_max_two_subject_distribution_warning():
    config = base_config()
    config["teachers"]["T1"]["assignments"][0]["lessons"] = 7
    timetable = timetable_for_grade4()
    timetable["4"]["days"]["Monday"] = [
        {"subject": "Math", "teacher": "T1"},
        {"subject": "Math", "teacher": "T1"},
        {"subject": "Math", "teacher": "T1"},
        {"subject": "English", "teacher": "T2"},
    ]
    result = quality_engine.analyze(config, timetable)
    assert result["distributionIssues"]


def test_streams_are_checked_independently():
    config = base_config()
    config["teachers"]["T1"]["assignments"].append(
        {"grade": 4, "streamIndex": 1, "subject": "Math", "lessons": 1}
    )
    timetable = {
        "4A": {
            "grade": 4,
            "streamIndex": 0,
            "days": {"Monday": [{"subject": "Math", "teacher": "T1"}]},
        },
        "4B": {
            "grade": 4,
            "streamIndex": 1,
            "days": {"Monday": [{"subject": "Math", "teacher": "T1"}]},
        },
    }
    result = quality_engine.analyze(config, timetable)
    assert result["ineligibleTeachers"] == []
    assert result["teacherClashes"]
