import React, { useState } from 'react';
import { ScheduleConfig, Teacher } from '../../types/timetable';
import { Users, Plus, Trash2, CalendarOff, ShieldAlert } from 'lucide-react';

interface TeacherConfigTabProps {
  config: ScheduleConfig;
  onChange: (updated: ScheduleConfig) => void;
}

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b',
  '#06b6d4', '#ef4444', '#14b8a6', '#6366f1', '#f97316'
];

export const TeacherConfigTab: React.FC<TeacherConfigTabProps> = ({ config, onChange }) => {
  const [newTeacherName, setNewTeacherName] = useState('');

  const addTeacher = () => {
    if (!newTeacherName.trim()) return;
    const id = newTeacherName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
    const color = PRESET_COLORS[Object.keys(config.teachers).length % PRESET_COLORS.length];

    const newTeacher: Teacher = {
      id,
      name: newTeacherName.trim(),
      maxLessons: 22,
      maxPerDay: 5,
      unavailDays: [],
      color,
      assignments: [],
    };

    onChange({
      ...config,
      teachers: {
        ...config.teachers,
        [newTeacherName.trim()]: newTeacher,
      },
    });
    setNewTeacherName('');
  };

  const removeTeacher = (tKey: string) => {
    const updated = { ...config.teachers };
    delete updated[tKey];
    onChange({ ...config, teachers: updated });
  };

  const updateTeacher = (tKey: string, field: keyof Teacher, value: any) => {
    const teacher = config.teachers[tKey];
    if (!teacher) return;

    onChange({
      ...config,
      teachers: {
        ...config.teachers,
        [tKey]: { ...teacher, [field]: value },
      },
    });
  };

  const toggleUnavailDay = (tKey: string, day: string) => {
    const teacher = config.teachers[tKey];
    if (!teacher) return;

    const unavail = teacher.unavailDays || [];
    const updated = unavail.includes(day)
      ? unavail.filter((d) => d !== day)
      : [...unavail, day];

    updateTeacher(tKey, 'unavailDays', updated);
  };

  return (
    <div className="space-y-6">
      {/* Add New Teacher Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-semibold text-white font-display">Faculty Directory</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {Object.keys(config.teachers).length} Teachers
          </span>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <input
            type="text"
            value={newTeacherName}
            onChange={(e) => setNewTeacherName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTeacher()}
            placeholder="e.g. Dr. Jane Goodall"
            className="flex-1 sm:w-64 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={addTeacher}
            disabled={!newTeacherName.trim()}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Faculty</span>
          </button>
        </div>
      </div>

      {/* Teachers List */}
      <div className="space-y-3">
        {Object.entries(config.teachers).map(([tKey, teacher]) => {
          const totalAssigned = teacher.assignments.reduce(
            (sum, a) => sum + (Number(a.lessons) || 0),
            0
          );
          const isOverloaded = teacher.maxLessons && totalAssigned > teacher.maxLessons;

          return (
            <div
              key={tKey}
              className={`p-4 rounded-2xl border transition-all ${
                isOverloaded
                  ? 'bg-amber-950/20 border-amber-800/40'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded-full ring-2 ring-slate-800 shrink-0"
                    style={{ backgroundColor: teacher.color || '#6366f1' }}
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white font-display">{teacher.name}</h4>
                    <span className="text-[11px] text-slate-400">
                      Assigned: <strong className={isOverloaded ? 'text-amber-400' : 'text-emerald-400'}>{totalAssigned}</strong> / {teacher.maxLessons || 25} lessons/week
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Max Weekly:</span>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={teacher.maxLessons || 24}
                      onChange={(e) => updateTeacher(tKey, 'maxLessons', Number(e.target.value))}
                      className="w-12 text-center bg-transparent text-white font-mono focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Daily Cap:</span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={teacher.maxPerDay || 5}
                      onChange={(e) => updateTeacher(tKey, 'maxPerDay', Number(e.target.value))}
                      className="w-10 text-center bg-transparent text-white font-mono focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => removeTeacher(tKey)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                    title="Remove faculty member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Unavailable Days Toggle */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <CalendarOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Off-Days (Hard Constraint):</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {config.workingDays.map((day) => {
                    const isOff = (teacher.unavailDays || []).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleUnavailDay(tKey, day)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                          isOff
                            ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                            : 'bg-slate-950/70 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {day.slice(0, 3)} {isOff ? '(Off)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
