'use client';

import { useEffect } from 'react';
import { clearChunkReloadState, isRecoverableChunkError, recoverChunkError } from '@/components/layout/chunk-load-recovery';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[route error]', error);
    recoverChunkError(error, false);
  }, [error]);

  const chunkError = isRecoverableChunkError(error);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-xl font-extrabold text-slate-900">{chunkError ? 'Stale app bundle detected' : 'Page failed to load'}</h1>
        {chunkError ? (
          <ol className="mt-4 space-y-2 text-left text-sm font-semibold text-slate-600 list-decimal list-inside">
            <li>In your terminal, press <strong>Ctrl+C</strong> to stop any running server.</li>
            <li>Run <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">npm run dev:3020</code> and wait for <strong>Ready</strong>.</li>
            <li>Click <strong>Reload page</strong> below (or open a new browser tab).</li>
          </ol>
        ) : (
          <p className="mt-2 text-sm font-semibold text-slate-600">An unexpected error stopped this page from rendering.</p>
        )}
        {process.env.NODE_ENV === 'development' ? (
          <p className="mt-3 text-xs font-mono text-rose-700 break-all">{error.message}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => recoverChunkError(error, true)}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-extrabold hover:bg-slate-800"
          >
            Reload page
          </button>
          {!chunkError ? (
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
