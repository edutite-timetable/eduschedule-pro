import React from 'react';
import { Sparkles, Calendar, Server, HelpCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface NavbarProps {
  schoolName: string;
  academicYear: string;
  isSolving: boolean;
  onSolve: () => void;
  onOpenPreflight: () => void;
  onOpenHostGuide: () => void;
  backendUrl: string;
  isBackendConnected: boolean;
  preflightFeasible: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  schoolName,
  academicYear,
  isSolving,
  onSolve,
  onOpenPreflight,
  onOpenHostGuide,
  backendUrl,
  isBackendConnected,
  preflightFeasible,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white font-display">
                EduSchedule <span className="text-indigo-400">Pro</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold uppercase tracking-wider">
                CP-SAT v8.2
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[220px] sm:max-w-xs">
              {schoolName} • {academicYear}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Preflight indicator */}
          <button
            onClick={onOpenPreflight}
            className={`hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              preflightFeasible
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            {preflightFeasible ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Preflight: {preflightFeasible ? 'Ready' : 'Warnings'}</span>
          </button>

          {/* Hosting Guide & Backend Config */}
          <button
            onClick={onOpenHostGuide}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
            title="Static Hosting & Backend Setup Guide"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span className="hidden md:inline">Hosting & Deployment</span>
          </button>

          {/* Primary Generate Button */}
          <button
            onClick={onSolve}
            disabled={isSolving}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            <Sparkles className={`w-4 h-4 ${isSolving ? 'animate-spin' : ''}`} />
            <span>{isSolving ? 'Optimizing Schedule...' : 'Generate Timetable'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
