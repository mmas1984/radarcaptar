export function sanitizeHttpUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.includes(':')
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractDomainLabel(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
}

export type DeadlineUrgency = 'continuous' | 'urgent' | 'normal';

export function classifyDeadline(prazo: string, referenceDateIso?: string): {
  urgency: DeadlineUrgency;
  daysLeft: number | null;
} {
  const lower = (prazo || '').toLowerCase();
  if (lower.includes('fluxo contínuo') || lower.includes('fluxo continuo') || lower.includes('permanente')) {
    return { urgency: 'continuous', daysLeft: null };
  }

  const match = prazo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) {
    return { urgency: 'normal', daysLeft: null };
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const target = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  if (Number.isNaN(target.getTime())) {
    return { urgency: 'normal', daysLeft: null };
  }

  const nowRef = referenceDateIso
    ? new Date(`${referenceDateIso}T12:00:00Z`)
    : new Date();

  const diffMs = target.getTime() - nowRef.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft <= 15) {
    return { urgency: 'urgent', daysLeft: Math.max(0, daysLeft) };
  }
  return { urgency: 'normal', daysLeft };
}
