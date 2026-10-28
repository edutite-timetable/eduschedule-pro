import React from 'react';
import { X, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { RepairCandidate, TimetableCell } from '../types/timetable';

interface MoveLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  cell: TimetableCell | null;
  classKey: string;
  classNameLabel: string;
  day: string;
  slotIndex: number;
  candidates: RepairCandidate[];
  onApplyMove: (toDay: string, toSlot: number) => void;
}

export const MoveLessonModal: React.FC<MoveLessonModalProps> = ({
  isOpen,
  onClose,
  cell,
  classKey,
  classNameLabel,
  day,
  slotIndex,
  candidates,
  onApplyMove,
}) => {
  if (!isOpen || !cell) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div>
            <h3 className="text-base font-semibold text-white font-display">
              Smart Lesson Relocation
            </h3>
            <p className="text-xs text-slate-400">
              {cell.subject} • {cell.teacher} ({classNameLabel})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Position */}
        <div className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Current Position:</span>
            <span className="font-mono text-indigo-300 font-semibold">
              {day} • Period {slotIndex + 1}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Legal Clash-Free Alternative Slots</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {candidates.length} options
              </span>
            </div>

            {candidates.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                No alternative clash-free slots found for this teacher/class combination.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {candidates.map((cand, idx) => (
                  <button
                    key={idx}
                    onClick={() => onApplyMove(cand.day, cand.slot)}
                    className="w-full p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/30 border border-slate-800 hover:border-indigo-500/50 text-left transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-indigo-300 font-mono">
                        {cand.day} • Period {cand.slot + 1}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {cand.reasons.join(' • ')}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {cand.score}%
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
