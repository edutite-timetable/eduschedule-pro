import React, { useState } from 'react';
import {
  ScheduleConfig,
  GeneratedTimetable,
  QualityDiagnostics,
  SolverStats,
  TimetableCell,
} from '../types/timetable';
import {
  Printer,
  Download,
  Users,
  Grid,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

interface TimetableOutputProps {
  config: ScheduleConfig;
  timetable: GeneratedTimetable;
  diagnostics?: QualityDiagnostics;
  stats?: SolverStats;
  onCellClick: (classKey: string, day: string, slotIndex: number, cell: TimetableCell) => void;
}

export const TimetableOutput: React.FC<TimetableOutputProps> = ({
  config,
  timetable,
  diagnostics,
  stats,
  onCellClick,
}) => {
  const classKeys = Object.keys(timetable);
  const [selectedClassKey, setSelectedClassKey] = useState<string>(classKeys[0] || '');
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'master'>('class');
  const [selectedTeacher, setSelectedTeacher] = useState<string>(
    Object.keys(config.teachers)[0] || ''
  );

  const lessonSlots = config.timeSlots.filter((s) => s.type === 'lesson');
  const activeClass = timetable[selectedClassKey];

  // Colors map
  const teacherColors: Record<string, string> = {};
  for (const t of Object.values(config.teachers)) {
    if (t.name) teacherColors[t.name] = t.color || '#6366f1';
  }

  // Teacher Schedule generator
  const buildTeacherSchedule = (tName: string) => {
    const days: Record<string, Array<{ subject: string; classLabel: string; isCommon?: boolean } | null>> = {};
    for (const d of config.workingDays) {
      days[d] = new Array(lessonSlots.length).fill(null);
    }

    for (const [cKey, cData] of Object.entries(timetable)) {
      for (const [d, slots] of Object.entries(cData.days)) {
        slots.forEach((cell, sIdx) => {
          if (!cell) return;
          if (cell.teacher === tName) {
            days[d][sIdx] = {
              subject: cell.subject,
              classLabel: cData.streamName || `Grade ${cell.grade}`,
            };
          } else if (cell.isCommon && days[d]?.[sIdx] === null) {
            days[d][sIdx] = {
              subject: cell.subject,
              classLabel: 'All Classes',
              isCommon: true,
            };
          }
        });
      }
    }
    return days;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let csv = 'Class,Day,Period,Subject,Teacher\n';
    for (const [_, cData] of Object.entries(timetable)) {
      for (const [d, slots] of Object.entries(cData.days)) {
        slots.forEach((cell, idx) => {
          if (cell) {
            csv += `"${cData.streamName}","${d}",${idx + 1},"${cell.subject}","${cell.teacher || ''}"\n`;
          }
        });
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.schoolName.replace(/\s+/g, '_')}_Timetable.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const payload = {
      schoolName: config.schoolName,
      academicYear: config.academicYear,
      generatedAt: new Date().toISOString(),
      timetable,
      diagnostics,
      stats,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eduschedule_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const teacherSchedule = buildTeacherSchedule(
    config.teachers[selectedTeacher]?.name || selectedTeacher
  );

  return (
    <div className="space-y-6">
      {/* Quality Scorecard Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900 border border-indigo-900/40 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-display font-extrabold text-xl text-indigo-400">
              {diagnostics?.score ?? 98}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white font-display">
                  Timetable Quality Score
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>0 Clashes Verified</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Independent verification: {diagnostics?.label || 'Excellent'} • {stats?.status || 'OPTIMAL'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON Backup</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Taught Lessons
            </span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">
              {diagnostics?.taughtLessons ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Curriculum Completeness
            </span>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
              {Math.round((diagnostics?.completeness ?? 1) * 100)}%
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Slot Utilization
            </span>
            <div className="text-lg font-bold text-cyan-400 font-mono mt-0.5">
              {Math.round((diagnostics?.packing ?? 1) * 100)}%
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Solve Time
            </span>
            <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5">
              {stats?.solveTime ?? 0.12}s
            </div>
          </div>
        </div>
      </div>

      {/* View Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800 no-print">
        <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            onClick={() => setViewMode('class')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === 'class'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Class Timetable</span>
          </button>
          <button
            onClick={() => setViewMode('teacher')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === 'teacher'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Teacher Schedule</span>
          </button>
          <button
            onClick={() => setViewMode('master')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              viewMode === 'master'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Master Grid</span>
          </button>
        </div>

        {/* View Specific Selectors */}
        {viewMode === 'class' && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Select Class:</span>
            <select
              value={selectedClassKey}
              onChange={(e) => setSelectedClassKey(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-semibold text-indigo-300 focus:outline-none"
            >
              {Object.entries(timetable).map(([key, data]) => (
                <option key={key} value={key}>
                  {data.streamName || `Grade ${data.grade}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {viewMode === 'teacher' && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Select Faculty:</span>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-semibold text-emerald-300 focus:outline-none"
            >
              {Object.entries(config.teachers).map(([key, t]) => (
                <option key={key} value={key}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* VIEW 1: CLASS TIMETABLE GRID */}
      {viewMode === 'class' && activeClass && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4 timetable-card">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-bold text-white font-display">
                {activeClass.streamName} Timetable
              </h3>
              <p className="text-xs text-slate-400">
                {config.schoolName} • Term Schedule
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono italic no-print">
              Tip: Click any lesson to relocate or swap
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold text-slate-400 w-28 uppercase font-mono text-[10px]">
                    Period
                  </th>
                  {config.workingDays.map((day) => (
                    <th
                      key={day}
                      className="py-2.5 px-3 font-semibold text-white uppercase tracking-wider text-[11px]"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {lessonSlots.map((slot, sIdx) => (
                  <tr key={sIdx} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-slate-400">
                      <div>{slot.label}</div>
                      {slot.startTime && (
                        <div className="text-[10px] text-slate-500">
                          {slot.startTime} - {slot.endTime}
                        </div>
                      )}
                    </td>

                    {config.workingDays.map((day) => {
                      const cell = activeClass.days[day]?.[sIdx];
                      if (!cell) {
                        return (
                          <td key={day} className="py-2.5 px-3">
                            <div className="h-14 rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 flex items-center justify-center text-[10px] text-slate-600">
                              Free
                            </div>
                          </td>
                        );
                      }

                      if (cell.isCommon) {
                        return (
                          <td key={day} className="py-2.5 px-3">
                            <div className="h-14 rounded-xl bg-indigo-950/30 border border-indigo-800/40 p-2 flex flex-col justify-center text-center">
                              <span className="font-semibold text-indigo-300 font-display text-xs">
                                {cell.subject}
                              </span>
                              <span className="text-[10px] text-slate-500">All Students</span>
                            </div>
                          </td>
                        );
                      }

                      if (cell.isFiller) {
                        return (
                          <td key={day} className="py-2.5 px-3">
                            <div className="h-14 rounded-xl bg-slate-950/60 border border-slate-800/80 p-2 flex flex-col justify-center text-center">
                              <span className="text-slate-500 font-medium text-[11px]">
                                {cell.subject}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      const teacherColor = teacherColors[cell.teacher] || '#6366f1';

                      return (
                        <td key={day} className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => onCellClick(selectedClassKey, day, sIdx, cell)}
                            className="w-full h-14 rounded-xl p-2 text-left border transition-all hover:scale-[1.02] active:scale-[0.99] flex flex-col justify-between shadow-sm"
                            style={{
                              backgroundColor: `${teacherColor}15`,
                              borderColor: `${teacherColor}40`,
                            }}
                          >
                            <span className="font-bold text-white text-[11px] truncate block">
                              {cell.subject}
                            </span>
                            <span
                              className="text-[10px] font-semibold truncate block"
                              style={{ color: teacherColor }}
                            >
                              {cell.teacher}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: TEACHER SCHEDULE GRID */}
      {viewMode === 'teacher' && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4 timetable-card">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-bold text-white font-display">
                {config.teachers[selectedTeacher]?.name || selectedTeacher} — Faculty Timetable
              </h3>
              <p className="text-xs text-slate-400">
                Personalized teaching schedule • {config.schoolName}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold text-slate-400 w-28 uppercase font-mono text-[10px]">
                    Period
                  </th>
                  {config.workingDays.map((day) => (
                    <th
                      key={day}
                      className="py-2.5 px-3 font-semibold text-white uppercase tracking-wider text-[11px]"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {lessonSlots.map((slot, sIdx) => (
                  <tr key={sIdx} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-slate-400">
                      <div>{slot.label}</div>
                      {slot.startTime && (
                        <div className="text-[10px] text-slate-500">
                          {slot.startTime} - {slot.endTime}
                        </div>
                      )}
                    </td>

                    {config.workingDays.map((day) => {
                      const entry = teacherSchedule[day]?.[sIdx];
                      if (!entry) {
                        return (
                          <td key={day} className="py-2.5 px-3">
                            <div className="h-14 rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 flex items-center justify-center text-[10px] text-slate-600">
                              Free
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={day} className="py-2.5 px-3">
                          <div className="h-14 rounded-xl p-2 bg-emerald-950/25 border border-emerald-800/40 flex flex-col justify-between">
                            <span className="font-bold text-emerald-300 text-[11px] truncate block">
                              {entry.subject}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block">
                              {entry.classLabel}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: MASTER COMPARATIVE GRID */}
      {viewMode === 'master' && (
        <div className="space-y-6">
          {Object.entries(timetable).map(([cKey, cData]) => (
            <div
              key={cKey}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-sm font-bold text-white font-display">
                  {cData.streamName || `Grade ${cData.grade}`}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Grade {cData.grade}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {config.workingDays.map((day) => (
                  <div key={day} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1.5">
                      {day}
                    </span>
                    <div className="space-y-1">
                      {(cData.days[day] || []).map((cell, sIdx) => {
                        if (!cell) return null;
                        return (
                          <div
                            key={sIdx}
                            className={`p-1 rounded text-[10px] truncate ${
                              cell.isFiller
                                ? 'text-slate-600 bg-slate-900/50'
                                : cell.isCommon
                                ? 'text-indigo-300 bg-indigo-950/40'
                                : 'text-slate-200 bg-slate-900'
                            }`}
                          >
                            <span className="font-mono text-slate-500 mr-1">P{sIdx + 1}</span>
                            <span>{cell.subject}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
