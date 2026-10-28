import React, { useState } from 'react';
import { ScheduleConfig, TeacherAssignment } from '../../types/timetable';
import { BookOpen, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface AssignmentMatrixTabProps {
  config: ScheduleConfig;
  onChange: (updated: ScheduleConfig) => void;
}

export const AssignmentMatrixTab: React.FC<AssignmentMatrixTabProps> = ({ config, onChange }) => {
  const teacherKeys = Object.keys(config.teachers);
  const [selectedTeacherKey, setSelectedTeacherKey] = useState<string>(teacherKeys[0] || '');
  const [newGrade, setNewGrade] = useState<number>(config.grades[0] || 7);
  const [newStream, setNewStream] = useState<number>(0);
  const [newSubject, setNewSubject] = useState<string>(config.subjects[0] || 'Mathematics');
  const [newLessons, setNewLessons] = useState<number>(4);

  const selectedTeacher = config.teachers[selectedTeacherKey];

  const handleAddAssignment = () => {
    if (!selectedTeacher) return;

    const newAssignment: TeacherAssignment = {
      grade: newGrade,
      streamIndex: newStream,
      subject: newSubject,
      lessons: Math.max(1, newLessons),
    };

    const updatedAssignments = [...selectedTeacher.assignments, newAssignment];

    onChange({
      ...config,
      teachers: {
        ...config.teachers,
        [selectedTeacherKey]: {
          ...selectedTeacher,
          assignments: updatedAssignments,
        },
      },
    });
  };

  const handleRemoveAssignment = (tKey: string, index: number) => {
    const teacher = config.teachers[tKey];
    if (!teacher) return;

    const updatedAssignments = teacher.assignments.filter((_, i) => i !== index);

    onChange({
      ...config,
      teachers: {
        ...config.teachers,
        [tKey]: {
          ...teacher,
          assignments: updatedAssignments,
        },
      },
    });
  };

  const handleLessonCountChange = (tKey: string, index: number, count: number) => {
    const teacher = config.teachers[tKey];
    if (!teacher) return;

    const updatedAssignments = [...teacher.assignments];
    updatedAssignments[index] = {
      ...updatedAssignments[index],
      lessons: Math.max(1, count),
    };

    onChange({
      ...config,
      teachers: {
        ...config.teachers,
        [tKey]: {
          ...teacher,
          assignments: updatedAssignments,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Quick Add Assignment Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2 font-display">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span>Allocate Teaching Assignments</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Teacher</label>
            <select
              value={selectedTeacherKey}
              onChange={(e) => setSelectedTeacherKey(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
            >
              {Object.entries(config.teachers).map(([key, t]) => (
                <option key={key} value={key}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Grade</label>
            <select
              value={newGrade}
              onChange={(e) => {
                setNewGrade(Number(e.target.value));
                setNewStream(0);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
            >
              {config.grades.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Class Stream</label>
            <select
              value={newStream}
              onChange={(e) => setNewStream(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
            >
              {Array.from({ length: config.gradeStreams[String(newGrade)] || 1 }).map((_, sIdx) => {
                const names = config.gradeStreamNames[String(newGrade)] || [];
                const label = names[sIdx] || `Stream ${String.fromCharCode(65 + sIdx)}`;
                return (
                  <option key={sIdx} value={sIdx}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
            <select
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
            >
              {config.subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-20">
              <label className="block text-xs font-medium text-slate-400 mb-1">Hours/Wk</label>
              <input
                type="number"
                min={1}
                max={15}
                value={newLessons}
                onChange={(e) => setNewLessons(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-center font-mono text-white focus:outline-none"
              />
            </div>
            <button
              onClick={handleAddAssignment}
              className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors h-[38px] flex items-center justify-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign</span>
            </button>
          </div>
        </div>
      </div>

      {/* Assignments by Teacher */}
      <div className="space-y-4">
        {Object.entries(config.teachers).map(([tKey, teacher]) => {
          const totalAssigned = teacher.assignments.reduce(
            (sum, a) => sum + (Number(a.lessons) || 0),
            0
          );
          const percent = Math.min(100, Math.round((totalAssigned / (teacher.maxLessons || 25)) * 100));

          return (
            <div
              key={tKey}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: teacher.color || '#6366f1' }}
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white font-display">{teacher.name}</h4>
                    <span className="text-xs text-slate-400 font-mono">
                      {totalAssigned} / {teacher.maxLessons || 25} Lessons ({percent}% load)
                    </span>
                  </div>
                </div>

                {/* Mini progress bar */}
                <div className="w-36 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      percent > 100 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
              </div>

              {teacher.assignments.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No subjects currently allocated to this faculty member.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                  {teacher.assignments.map((assign, aIdx) => {
                    const streamNames = config.gradeStreamNames[String(assign.grade)] || [];
                    const streamLabel = streamNames[assign.streamIndex] || `Stream ${String.fromCharCode(65 + assign.streamIndex)}`;

                    return (
                      <div
                        key={aIdx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="font-semibold text-white truncate">{assign.subject}</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            Grade {assign.grade} • {streamLabel}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min={1}
                            max={12}
                            value={assign.lessons}
                            onChange={(e) =>
                              handleLessonCountChange(tKey, aIdx, Number(e.target.value))
                            }
                            className="w-12 px-1.5 py-1 rounded bg-slate-900 border border-slate-800 text-center font-mono text-xs text-indigo-300 focus:outline-none"
                          />
                          <span className="text-[11px] text-slate-500">hrs</span>
                          <button
                            onClick={() => handleRemoveAssignment(tKey, aIdx)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
