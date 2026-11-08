/**
 * Share / referral loop: every board URL can carry ?ref=<visitor id>.
 * The referred visitor's signup is attributed (insights.ref) without putting an email in the URL.
 */
import { visitorId } from '@/lib/visitor';

const KEY = 'ss_ref';
export const REF_RE = /^[A-Za-z0-9_-]{2,40}$/;

export function captureRef(search = typeof location !== 'undefined' ? location.search : '') {
  const ref = new URLSearchParams(search).get('ref');
  if (!ref || !REF_RE.test(ref)) return;
  try {
    if (ref === visitorId()) return;
    sessionStorage.setItem(KEY, ref);
  } catch { /* private mode */ }
}

export function referralId(): string {
  try {
    const v = sessionStorage.getItem(KEY) || '';
    return REF_RE.test(v) ? v : '';
  } catch {
    return '';
  }
}

export function withRef(href: string, ref = visitorId()): string {
  const origin = typeof location !== 'undefined' ? location.origin : 'https://skiscope.vercel.app';
  const u = new URL(href, origin);
  if (ref && REF_RE.test(ref)) u.searchParams.set('ref', ref);
  return u.toString();
}

export async function sharePage(href: string, title: string): Promise<'shared' | 'copied' | 'dismissed'> {
  const url = withRef(href);
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'dismissed';
  }
}
