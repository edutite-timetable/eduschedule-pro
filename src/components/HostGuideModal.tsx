import React, { useState } from 'react';
import { X, Copy, Check, Globe, Server, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';

interface HostGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
  onUpdateBackendUrl: (url: string) => void;
}

export const HostGuideModal: React.FC<HostGuideModalProps> = ({
  isOpen,
  onClose,
  backendUrl,
  onUpdateBackendUrl,
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [tempUrl, setTempUrl] = useState(backendUrl);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  if (!isOpen) return null;

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleTestBackend = async () => {
    setTestStatus('testing');
    try {
      const clean = tempUrl.trim().replace(/\/+$/, '');
      const res = await fetch(`${clean}/health`);
      if (res.ok) {
        setTestStatus('success');
        onUpdateBackendUrl(tempUrl);
      } else {
        setTestStatus('failed');
      }
    } catch {
      setTestStatus('failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white font-display">
                Static Hosting & Deployment Guide
              </h3>
              <p className="text-xs text-slate-400">
                How to copy, build, and deploy the frontend anywhere in the world
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

        {/* Content */}
        <div className="p-6 space-y-6 text-sm text-slate-300 max-h-[75vh] overflow-y-auto">
          {/* Key Answer 1: Which files to copy */}
          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-indigo-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>The Exact Files to Copy for Static Hosting</span>
              </span>
              <button
                onClick={() => copyToClipboard('npm run build', 'build_cmd')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                {copiedSection === 'build_cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy build command</span>
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              When you run <code className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-xs">npm run build</code>, Vite compiles this entire frontend into a single standalone directory named:
            </p>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 flex items-center justify-between">
              <span>📁 dist/</span>
              <span className="text-[11px] text-slate-500 font-sans">Contains index.html + assets/ (100% static)</span>
            </div>
            <p className="text-xs text-slate-400">
              You can drag-and-drop or copy the contents of <strong className="text-slate-200">dist/</strong> to <strong>any</strong> static host: GitHub Pages, Netlify, Vercel, Cloudflare Pages, Firebase Hosting, AWS S3, or shared cPanel hosting.
            </p>
          </div>

          {/* Hosting Options */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white flex items-center space-x-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <span>Best Ways to Host for Free</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
                <div className="font-semibold text-white flex items-center justify-between">
                  <span>1. GitHub Pages</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Free</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  In your GitHub repository, go to <strong>Settings → Pages → Source</strong>, select GitHub Actions or deploy from the <code className="text-indigo-300">gh-pages</code> branch.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
                <div className="font-semibold text-white flex items-center justify-between">
                  <span>2. Vercel or Netlify</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">Instant</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Import repository, choose <strong>Vite</strong> preset. Build command: <code className="text-indigo-300">npm run build</code>, Output directory: <code className="text-indigo-300">dist</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Backend CP-SAT Solver Connection */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-white flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>Backend CP-SAT Solver URL</span>
              </h4>
              <span className="text-xs text-slate-400">Optional: Connect to live Python service</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              The repository includes <code className="text-indigo-300">render.yaml</code> and <code className="text-indigo-300">app.py</code> to run Google OR-Tools CP-SAT in the cloud. If left blank, this app automatically uses its high-speed internal client engine!
            </p>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="e.g. https://eduschedule-solver.onrender.com or empty for local"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleTestBackend}
                disabled={testStatus === 'testing' || !tempUrl.trim()}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors disabled:opacity-50"
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test & Save'}
              </button>
            </div>

            {testStatus === 'success' && (
              <p className="text-xs text-emerald-400 flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Successfully connected to CP-SAT backend solver service!</span>
              </p>
            )}
            {testStatus === 'failed' && (
              <p className="text-xs text-amber-400">
                Could not connect to that URL. The app will use its built-in zero-clash client solver.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
