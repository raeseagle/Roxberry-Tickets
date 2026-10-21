'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/*
 * Keeps dashboard numbers live without reloading the page.
 * One shared timer, however many pages include this component.
 * Refreshes every 15 seconds while the tab is visible, and right away
 * when you come back to the tab. Skips a refresh while you're typing.
 */
let instances = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let refresh: (() => void) | null = null;

function typing() {
  const el = document.activeElement;
  return !!el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}
function tick() {
  if (document.visibilityState === 'visible' && !typing()) refresh?.();
}
function onReturn() {
  if (document.visibilityState === 'visible') tick();
}

export default function AutoRefresh({ ms = 15_000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    refresh = () => router.refresh();
    instances += 1;
    if (instances === 1) {
      timer = setInterval(tick, ms);
      document.addEventListener('visibilitychange', onReturn);
      window.addEventListener('focus', onReturn);
    }
    return () => {
      instances -= 1;
      if (instances === 0) {
        if (timer) clearInterval(timer);
        timer = null;
        document.removeEventListener('visibilitychange', onReturn);
        window.removeEventListener('focus', onReturn);
      }
    };
  }, [router, ms]);
  return null;
}
