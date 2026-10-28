import React, { useState, useMemo, useEffect } from 'react';
import { DEFAULT_CONFIG } from './utils/defaults';
import { ScheduleConfig, GeneratedTimetable, QualityDiagnostics, SolverStats, TimetableCell, RepairCandidate } from './types/timetable';
import { calculatePreflight, executeScheduleGeneration, findRepairCandidates, auditTimetable } from './utils/solver';
import { Navbar } from './components/Navbar';
import { SchoolConfigTab } from './components/tabs/SchoolConfigTab';
import { TeacherConfigTab } from './components/tabs/TeacherConfigTab';
import { AssignmentMatrixTab } from './components/tabs/AssignmentMatrixTab';
import { PrioritiesTab } from './components/tabs/PrioritiesTab';
import { TimetableOutput } from './components/TimetableOutput';
import { HostGuideModal } from './components/HostGuideModal';
import { PreflightModal } from './components/PreflightModal';
import { MoveLessonModal } from './components/MoveLessonModal';
import { Calendar, Users, BookOpen, Star, Sparkles, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export const App: React.FC = () => {
  // Load initial config from localStorage or default
  const [config, setConfig] = useState<ScheduleConfig>(() => {
    try {
      const saved = localStorage.getItem('eduschedule_config_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CONFIG;
  });

  const [activeTab, setActiveTab] = useState<'school' | 'teachers' | 'matrix' | 'priorities' | 'timetable'>('timetable');
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    return localStorage.getItem('eduschedule_backend_url') || '';
  });

  const [timetable, setTimetable] = useState<GeneratedTimetable | null>(null);
  const [diagnostics, setDiagnostics] = useState<QualityDiagnostics | undefined>(undefined);
  const [solverStats, setSolverStats] = useState<SolverStats | undefined>(undefined);
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [solveStep, setSolveStep] = useState<string>('');

  // Modals
  const [isHostGuideOpen, setIsHostGuideOpen] = useState(false);
  const [isPreflightOpen, setIsPreflightOpen] = useState(false);

  // Move Modal State
  const [moveModalData, setMoveModalData] = useState<{
    isOpen: boolean;
    cell: TimetableCell | null;
    classKey: string;
    day: string;
    slotIndex: number;
    candidates: RepairCandidate[];
  }>({
    isOpen: false,
    cell: null,
    classKey: '',
    day: '',
    slotIndex: 0,
    candidates: [],
  });

  // Save config changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('eduschedule_config_v1', JSON.stringify(config));
    } catch {}
  }, [config]);

  // Save backend URL
  const handleUpdateBackendUrl = (url: string) => {
    setBackendUrl(url);
    localStorage.setItem('eduschedule_backend_url', url);
  };

  // Run preflight math
  const preflightResult = useMemo(() => calculatePreflight(config), [config]);

  // Initial automatic solve on load so user sees a beautiful timetable immediately!
  useEffect(() => {
    if (!timetable) {
      handleSolve();
    }
  }, []);

  const handleSolve = async () => {
    setIsSolving(true);
    setSolveStep('Validating mathematical constraints & preflight capacity...');

    await new Promise((r) => setTimeout(r, 200));
    setSolveStep('Running CP-SAT global branch-and-bound solver...');

    try {
      const res = await executeScheduleGeneration(config, backendUrl);
      if (res.success && res.timetable) {
        setTimetable(res.timetable);
        setDiagnostics(res.diagnostics);
        setSolverStats(res.stats);
        setActiveTab('timetable');
      }
    } catch (err) {
      console.error('Solve error:', err);
    } finally {
      setIsSolving(false);
      setSolveStep('');
    }
  };

  const handleCellClick = (classKey: string, day: string, slotIndex: number, cell: TimetableCell) => {
    if (!timetable || cell.isCommon || cell.isFiller) return;
    const candidates = findRepairCandidates(config, timetable, classKey, day, slotIndex);
    setMoveModalData({
      isOpen: true,
      cell,
      classKey,
      day,
      slotIndex,
      candidates,
    });
  };

  const handleApplyMove = (toDay: string, toSlot: number) => {
    if (!timetable || !moveModalData.cell) return;

    const { classKey, day: srcDay, slotIndex: srcSlot, cell } = moveModalData;
    const updated = JSON.parse(JSON.stringify(timetable)) as GeneratedTimetable;

    const targetCell = updated[classKey].days[toDay][toSlot];
    updated[classKey].days[toDay][toSlot] = cell;
    updated[classKey].days[srcDay][srcSlot] = targetCell && !targetCell.isFiller ? targetCell : {
      subject: config.fillerLabel || 'Study Period',
      teacher: '',
      grade: cell.grade,
      isFiller: true,
    };

    const newDiagnostics = auditTimetable(config, updated);
    setTimetable(updated);
    setDiagnostics(newDiagnostics);
    setMoveModalData((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#e2e8f0] flex flex-col selection:bg-indigo-500/30">
      <Navbar
        schoolName={config.schoolName}
        academicYear={config.academicYear}
        isSolving={isSolving}
        onSolve={handleSolve}
        onOpenPreflight={() => setIsPreflightOpen(true)}
        onOpenHostGuide={() => setIsHostGuideOpen(true)}
        backendUrl={backendUrl}
        isBackendConnected={Boolean(backendUrl)}
        preflightFeasible={preflightResult.feasible}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1.5 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-x-auto no-print">
          <button
            onClick={() => setActiveTab('timetable')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 shrink-0 transition-all ${
              activeTab === 'timetable'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generated Timetable</span>
            {timetable && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('school')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 shrink-0 transition-all ${
              activeTab === 'school'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>School Timing & Streams</span>
          </button>

          <button
            onClick={() => setActiveTab('teachers')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 shrink-0 transition-all ${
              activeTab === 'teachers'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Faculty & Availability</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 shrink-0 transition-all ${
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Assignment Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('priorities')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 shrink-0 transition-all ${
              activeTab === 'priorities'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Core Priorities & Assembly</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'timetable' && timetable && (
          <TimetableOutput
            config={config}
            timetable={timetable}
            diagnostics={diagnostics}
            stats={solverStats}
            onCellClick={handleCellClick}
          />
        )}

        {activeTab === 'school' && (
          <SchoolConfigTab config={config} onChange={setConfig} />
        )}

        {activeTab === 'teachers' && (
          <TeacherConfigTab config={config} onChange={setConfig} />
        )}

        {activeTab === 'matrix' && (
          <AssignmentMatrixTab config={config} onChange={setConfig} />
        )}

        {activeTab === 'priorities' && (
          <PrioritiesTab config={config} onChange={setConfig} />
        )}
      </main>

      {/* Solving Overlay */}
      {isSolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-display">
                Solving Timetable
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 font-mono">{solveStep}</p>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-emerald-400 to-indigo-500 animate-pulse w-3/4 mx-auto rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <HostGuideModal
        isOpen={isHostGuideOpen}
        onClose={() => setIsHostGuideOpen(false)}
        backendUrl={backendUrl}
        onUpdateBackendUrl={handleUpdateBackendUrl}
      />

      <PreflightModal
        isOpen={isPreflightOpen}
        onClose={() => setIsPreflightOpen(false)}
        result={preflightResult}
      />

      <MoveLessonModal
        isOpen={moveModalData.isOpen}
        onClose={() => setMoveModalData((prev) => ({ ...prev, isOpen: false }))}
        cell={moveModalData.cell}
        classKey={moveModalData.classKey}
        classNameLabel={timetable?.[moveModalData.classKey]?.streamName || ''}
        day={moveModalData.day}
        slotIndex={moveModalData.slotIndex}
        candidates={moveModalData.candidates}
        onApplyMove={handleApplyMove}
      />
    </div>
  );
};

export default App;
