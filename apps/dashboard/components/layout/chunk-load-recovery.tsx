'use client';

import { useEffect } from 'react';

const RELOAD_FLAG = 'dle-chunk-reload-once';
const RELOAD_COUNT_KEY = 'dle-chunk-reload-count';
const MAX_AUTO_RELOADS = 2;

const isChunkLoadFailure = (value: string) =>
  /chunkloaderror|loading chunk .* failed|failed to fetch dynamically imported module|script failed:.*\/_next\//i.test(value);

export const clearChunkReloadState = () => {
  sessionStorage.removeItem(RELOAD_FLAG);
  sessionStorage.removeItem(RELOAD_COUNT_KEY);
};

const reloadForChunkError = (force = false) => {
  if (!force) {
    const count = Number(sessionStorage.getItem(RELOAD_COUNT_KEY) || 0);
    if (count >= MAX_AUTO_RELOADS) return false;
    sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
  } else {
    clearChunkReloadState();
  }

  sessionStorage.setItem(RELOAD_FLAG, '1');
  const url = new URL(window.location.href);
  url.searchParams.set('__chunk_reload', String(Date.now()));
  window.location.replace(url.toString());
  return true;
};

export function ChunkLoadRecovery() {
  useEffect(() => {
    if (new URL(window.location.href).searchParams.has('__chunk_reload')) {
      clearChunkReloadState();
    }

    const timer = window.setTimeout(() => clearChunkReloadState(), 10000);

    const recover = (raw: string) => {
      if (!isChunkLoadFailure(String(raw || ''))) return;
      reloadForChunkError(false);
    };

    const onError = (event: Event) => {
      if (event instanceof ErrorEvent) {
        recover(String(event.message || event.error?.message || ''));
        return;
      }
      const target = event.target;
      if (target instanceof HTMLScriptElement) {
        const src = target.src || '';
        if (src.includes('/_next/static/chunks/') || src.includes('/_next/static/css/')) {
          recover(`script failed: ${src}`);
        }
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      recover(typeof reason === 'string' ? reason : String(reason?.message || reason || ''));
    };

    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}

export function isRecoverableChunkError(error: Error) {
  return isChunkLoadFailure(error.message || String(error));
}

export function recoverChunkError(error: Error, force = false) {
  if (!isRecoverableChunkError(error)) return false;
  return reloadForChunkError(force);
}
