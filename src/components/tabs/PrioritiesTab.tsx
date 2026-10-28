import React from 'react';
import { ScheduleConfig } from '../../types/timetable';
import { Star, ShieldAlert, Sparkles, Building2 } from 'lucide-react';

interface PrioritiesTabProps {
  config: ScheduleConfig;
  onChange: (updated: ScheduleConfig) => void;
}

export const PrioritiesTab: React.FC<PrioritiesTabProps> = ({ config, onChange }) => {
  const toggleHighPriority = (subject: string) => {
    const isPriority = config.highPrioritySubjects.includes(subject);
    const updated = isPriority
      ? config.highPrioritySubjects.filter((s) => s !== subject)
      : [...config.highPrioritySubjects, subject];

    onChange({ ...config, highPrioritySubjects: updated });
  };

  return (
    <div className="space-y-6">
      {/* High Priority Subjects */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2">
          <Star className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-semibold text-white font-display">Core Subject Priority</h3>
            <p className="text-xs text-slate-400">
              High-priority subjects are distributed evenly across days and protected from automated reductions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {config.subjects.map((sub) => {
            const isPriority = config.highPrioritySubjects.includes(sub);
            return (
              <button
                key={sub}
                type="button"
                onClick={() => toggleHighPriority(sub)}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  isPriority
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-xs font-medium truncate">{sub}</span>
                <Star
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isPriority ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Assembly / Common School Session */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-semibold text-white font-display">
              General School Session / Assembly
            </h3>
            <p className="text-xs text-slate-400">
              Blocks a fixed period across all grades simultaneously with no regular teaching.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Session Name</label>
            <input
              type="text"
              value={config.commonSession.name || 'General Assembly'}
              onChange={(e) =>
                onChange({
                  ...config,
                  commonSession: { ...config.commonSession, name: e.target.value },
                })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Scheduled Day</label>
            <select
              value={config.commonSession.day || 'Monday'}
              onChange={(e) =>
                onChange({
                  ...config,
                  commonSession: { ...config.commonSession, day: e.target.value },
                })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
            >
              {config.workingDays.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Period Index</label>
            <select
              value={config.commonSession.slotIndex || 0}
              onChange={(e) =>
                onChange({
                  ...config,
                  commonSession: { ...config.commonSession, slotIndex: Number(e.target.value) },
                })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
            >
              {config.timeSlots
                .filter((s) => s.type === 'lesson')
                .map((s, idx) => (
                  <option key={idx} value={idx}>
                    Slot {idx + 1} ({s.label})
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
