import React from 'react';
import { ScheduleConfig, TimeSlot } from '../../types/timetable';
import { Calendar, Plus, Trash2, Clock, Layers } from 'lucide-react';

interface SchoolConfigTabProps {
  config: ScheduleConfig;
  onChange: (updated: ScheduleConfig) => void;
}

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const SchoolConfigTab: React.FC<SchoolConfigTabProps> = ({ config, onChange }) => {
  const toggleDay = (day: string) => {
    const nextDays = config.workingDays.includes(day)
      ? config.workingDays.filter((d) => d !== day)
      : [...config.workingDays, day];
    if (nextDays.length === 0) return; // Keep at least 1 day
    onChange({ ...config, workingDays: nextDays });
  };

  const handleSlotChange = (index: number, field: keyof TimeSlot, value: any) => {
    const updatedSlots = [...config.timeSlots];
    updatedSlots[index] = { ...updatedSlots[index], [field]: value };
    onChange({ ...config, timeSlots: updatedSlots });
  };

  const addSlot = (type: 'lesson' | 'break') => {
    const lessonCount = config.timeSlots.filter((s) => s.type === 'lesson').length;
    const newSlot: TimeSlot = {
      type,
      label: type === 'lesson' ? `Period ${lessonCount + 1}` : 'Break',
      startTime: '00:00',
      endTime: '00:00',
    };
    onChange({ ...config, timeSlots: [...config.timeSlots, newSlot] });
  };

  const removeSlot = (index: number) => {
    const updatedSlots = config.timeSlots.filter((_, i) => i !== index);
    onChange({ ...config, timeSlots: updatedSlots });
  };

  const handleStreamChange = (grade: number, streams: number) => {
    const count = Math.max(1, Math.min(6, streams));
    const currentNames = config.gradeStreamNames[String(grade)] || [];
    const newNames = Array.from({ length: count }, (_, i) => {
      return currentNames[i] || `Grade ${grade} Stream ${String.fromCharCode(65 + i)}`;
    });

    onChange({
      ...config,
      gradeStreams: { ...config.gradeStreams, [String(grade)]: count },
      gradeStreamNames: { ...config.gradeStreamNames, [String(grade)]: newNames },
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic School Information */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2 font-display">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span>School Profile & Timetable Parameters</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">School Name</label>
            <input
              type="text"
              value={config.schoolName}
              onChange={(e) => onChange({ ...config, schoolName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Academic Term / Year</label>
            <input
              type="text"
              value={config.academicYear}
              onChange={(e) => onChange({ ...config, academicYear: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Unfilled Period Label</label>
            <input
              type="text"
              value={config.fillerLabel}
              onChange={(e) => onChange({ ...config, fillerLabel: e.target.value })}
              placeholder="e.g. Study Period or Library"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Working Days */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white font-display">Active Teaching Days</h3>
          <span className="text-xs text-slate-400 font-mono">
            {config.workingDays.length} day(s) configured
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((day) => {
            const active = config.workingDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  active
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade Levels & Class Streams */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2 font-display">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Grades & Class Streams</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {config.grades.map((grade) => {
            const streams = config.gradeStreams[String(grade)] || 1;
            const streamNames = config.gradeStreamNames[String(grade)] || [];

            return (
              <div
                key={grade}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white font-display">Grade {grade}</span>
                  <div className="flex items-center space-x-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-mono">Streams:</label>
                    <select
                      value={streams}
                      onChange={(e) => handleStreamChange(grade, Number(e.target.value))}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs text-indigo-300 font-mono focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {Array.from({ length: streams }).map((_, sIdx) => (
                    <input
                      key={sIdx}
                      type="text"
                      value={streamNames[sIdx] || `Grade ${grade} Stream ${String.fromCharCode(65 + sIdx)}`}
                      onChange={(e) => {
                        const updatedNames = [...streamNames];
                        updatedNames[sIdx] = e.target.value;
                        onChange({
                          ...config,
                          gradeStreamNames: {
                            ...config.gradeStreamNames,
                            [String(grade)]: updatedNames,
                          },
                        });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Time Slots Grid */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white font-display">Daily Period Structure</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => addSlot('lesson')}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lesson Period</span>
            </button>
            <button
              onClick={() => addSlot('break')}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Break</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {config.timeSlots.map((slot, idx) => (
            <div
              key={idx}
              className={`flex items-center space-x-3 p-3 rounded-xl border transition-all ${
                slot.type === 'lesson'
                  ? 'bg-slate-950/80 border-slate-800 text-slate-200'
                  : 'bg-amber-950/15 border-amber-900/30 text-amber-200'
              }`}
            >
              <span className="w-6 text-center text-xs font-mono font-semibold text-slate-500">
                {idx + 1}
              </span>

              <div className="w-24">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-semibold uppercase tracking-wider ${
                    slot.type === 'lesson'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {slot.type}
                </span>
              </div>

              <input
                type="text"
                value={slot.label}
                onChange={(e) => handleSlotChange(idx, 'label', e.target.value)}
                placeholder="Period Name"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              />

              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <input
                  type="text"
                  value={slot.startTime || ''}
                  onChange={(e) => handleSlotChange(idx, 'startTime', e.target.value)}
                  placeholder="08:00"
                  className="w-16 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center font-mono text-xs text-slate-200 focus:outline-none"
                />
                <span>-</span>
                <input
                  type="text"
                  value={slot.endTime || ''}
                  onChange={(e) => handleSlotChange(idx, 'endTime', e.target.value)}
                  placeholder="08:45"
                  className="w-16 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center font-mono text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <button
                onClick={() => removeSlot(idx)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                title="Remove slot"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
