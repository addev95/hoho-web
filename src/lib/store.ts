// localStorage 기반 설정 + 시간표 스토어 (Swift AppSettings/TimetableStore 포팅)
import type { TimetableItem } from './types';

const K = {
  pat: 'github_pat',
  repo: 'github_repo',
  destinationStation: 'destination_station',
  destinationLat: 'destination_lat',
  destinationLng: 'destination_lng',
  maxCommuteMins: 'max_commute_mins',
  maxTransfers: 'max_transfers',
  includeKyongin: 'include_kyongin',
  includeDaegang: 'include_daegang',
  includeSeoul: 'include_seoul',
  includeFlying: 'include_flying',
  timetable: 'hoho_timetable_items_v1',
} as const;

function getStr(key: string, def: string): string {
  try {
    return localStorage.getItem(key) ?? def;
  } catch {
    return def;
  }
}

function getNum(key: string, def: number): number {
  const v = parseFloat(getStr(key, ''));
  return Number.isFinite(v) ? v : def;
}

function getBool(key: string, def: boolean): boolean {
  const v = getStr(key, '');
  if (v === 'true') return true;
  if (v === 'false') return false;
  return def;
}

function set(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

export interface Settings {
  pat: string;
  repo: string;
  destinationStation: string;
  destinationLat: number;
  destinationLng: number;
  maxCommuteMins: number;
  maxTransfers: number;
  includeKyongin: boolean;
  includeDaegang: boolean;
  includeSeoul: boolean;
  includeFlying: boolean;
}

export function loadSettings(): Settings {
  return {
    pat: getStr(K.pat, ''),
    repo: getStr(K.repo, 'addev95/hohoparser'),
    destinationStation: getStr(K.destinationStation, '4호선 진접역'),
    destinationLat: getNum(K.destinationLat, 37.719908),
    destinationLng: getNum(K.destinationLng, 127.203247),
    maxCommuteMins: getNum(K.maxCommuteMins, 60),
    maxTransfers: getNum(K.maxTransfers, 2),
    includeKyongin: getBool(K.includeKyongin, true),
    includeDaegang: getBool(K.includeDaegang, true),
    includeSeoul: getBool(K.includeSeoul, true),
    includeFlying: getBool(K.includeFlying, true),
  };
}

export function saveSettings(s: Settings) {
  set(K.pat, s.pat);
  set(K.repo, s.repo);
  set(K.destinationStation, s.destinationStation);
  set(K.destinationLat, String(s.destinationLat));
  set(K.destinationLng, String(s.destinationLng));
  set(K.maxCommuteMins, String(s.maxCommuteMins));
  set(K.maxTransfers, String(s.maxTransfers));
  set(K.includeKyongin, String(s.includeKyongin));
  set(K.includeDaegang, String(s.includeDaegang));
  set(K.includeSeoul, String(s.includeSeoul));
  set(K.includeFlying, String(s.includeFlying));
}

export function isPatConfigured(s: Settings): boolean {
  return s.pat.trim().length > 0;
}

/** 게시판 mid → 설정 include 플래그 */
export function boardEnabled(s: Settings, mid: string): boolean {
  switch (mid) {
    case 'job_yoga_kyongin':
      return s.includeKyongin;
    case 'job_yoga_d':
      return s.includeDaegang;
    case 'job_yoga':
      return s.includeSeoul;
    case 'job_flying':
      return s.includeFlying;
    default:
      return true;
  }
}

// ── 시간표 ──────────────────────────────────────────────

export function loadTimetable(): TimetableItem[] {
  try {
    const raw = localStorage.getItem(K.timetable);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as TimetableItem[]) : [];
  } catch {
    return [];
  }
}

export function saveTimetable(items: TimetableItem[]) {
  set(K.timetable, JSON.stringify(items));
}

export function isJobRegistered(items: TimetableItem[], url: string): boolean {
  return items.some((i) => i.originalJobUrl === url);
}

export function newTimetableId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
