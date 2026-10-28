import React from 'react';
import { X, CheckCircle2, AlertTriangle, Info, Clock, Users, BookOpen } from 'lucide-react';
import { PreflightResult } from '../types/timetable';

interface PreflightModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: PreflightResult;
}

export const PreflightModal: React.FC<PreflightModalProps> = ({
  isOpen,
  onClose,
  result,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-lg border ${
                result.feasible
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              {result.feasible ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white font-display">
                Mathematical Feasibility Audit
              </h3>
              <p className="text-xs text-slate-400">
                Preflight capacity verification before starting solver
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm text-slate-300 max-h-[70vh] overflow-y-auto">
          {/* Status banner */}
          <div
            className={`p-4 rounded-xl border flex items-start space-x-3 ${
              result.feasible
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
            }`}
          >
            {result.feasible ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold text-sm">
                {result.feasible
                  ? 'Configuration is Feasible & Ready for Optimization'
                  : 'Feasibility Warnings Detected'}
              </div>
              <p className="text-xs mt-1 text-slate-300">
                {result.feasible
                  ? 'All teacher hours fit available teaching days and class capacities. The solver will produce a clean, clash-free timetable.'
                  : 'Review the capacity bottlenecks below before generating to ensure optimal distribution.'}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-center space-x-1">
                <BookOpen className="w-3 h-3 text-indigo-400" />
                <span>Required Lessons</span>
              </span>
              <div className="text-xl font-bold text-white font-mono mt-1">
                {result.totalRequiredLessons}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-center space-x-1">
                <Users className="w-3 h-3 text-emerald-400" />
                <span>Teacher Capacity</span>
              </span>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                {result.totalTeacherCapacity}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-center space-x-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Periods / Class</span>
              </span>
              <div className="text-xl font-bold text-cyan-400 font-mono mt-1">
                {result.capacityPerClass}
              </div>
            </div>
          </div>

          {/* Issues list */}
          {result.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Capacity Issues ({result.issues.length})
              </h4>
              <div className="space-y-2">
                {result.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/30 text-xs text-amber-200"
                  >
                    <div className="font-semibold text-amber-300">
                      {issue.teacher || issue.class || issue.type}
                    </div>
                    <div className="text-slate-300 mt-0.5">{issue.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Observations ({result.warnings.length})
              </h4>
              <div className="space-y-1.5">
                {result.warnings.slice(0, 5).map((w, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300 flex items-start space-x-2"
                  >
                    <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
