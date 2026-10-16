// 필터 로직 (Swift JobFeedViewModel 포팅)
import type { MatchedJob } from './types';
import { boardEnabled } from './store';
import type { Settings } from './store';

const NON_CAPITAL_KEYWORDS = [
  '대전', '대구', '부산', '광주', '울산', '세종', '강원', '충북', '충남',
  '전북', '전남', '경북', '경남', '제주',
  '청주', '천안', '전주', '포항', '창원', '김해', '구미', '원주', '춘천',
  '강릉', '아산', '익산', '순천', '여수', '목포', '진주', '경산', '양산', '거제',
];

/** 비수도권 제외 (Swift isPotentialCommuteArea 포팅) */
export function isPotentialCommuteArea(region: string | undefined | null): boolean {
  if (!region || !region.trim()) return true;
  return !NON_CAPITAL_KEYWORDS.some((k) => region.includes(k));
}

export function normalizedRegion(r: string | undefined): string {
  const t = (r ?? '').trim();
  return t || '미정';
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** 통근 가능 판정 */
export function isCommutable(job: MatchedJob, s: Settings): boolean {
  const c = job.commute;
  if (!c) return false;
  if (c.totalTimeMins == null || c.transfers == null) return false;
  const maxMins = clamp(s.maxCommuteMins, 10, 180);
  const maxTransfers = clamp(s.maxTransfers, 0, 5);
  if (c.totalTimeMins > maxMins) return false;
  if (c.transfers > maxTransfers) return false;
  // 비수도권 제외: 4개 문자열 모두 통과해야 함
  const fields = [
    job.post.region,
    job.post.title,
    job.extracted.location?.value,
    job.extracted.location?.rawLine,
  ];
  return fields.every(isPotentialCommuteArea);
}

export function applyCommuteFilter(jobs: MatchedJob[], s: Settings): MatchedJob[] {
  return jobs.filter((j) => isCommutable(j, s));
}

/** 게시판 칩 필터 */
export function filterByBoards(jobs: MatchedJob[], s: Settings): MatchedJob[] {
  return jobs.filter((j) => boardEnabled(s, j.post.boardMid));
}

/** 지역 다중선택 필터 */
export function filterByRegions(jobs: MatchedJob[], selected: Set<string>): MatchedJob[] {
  if (selected.size === 0) return jobs;
  return jobs.filter((j) => selected.has(normalizedRegion(j.post.region)));
}

/** 전체 공고의 지역 목록 (중복 제거·정렬) */
export function availableRegions(jobs: MatchedJob[]): string[] {
  const set = new Set<string>();
  for (const j of jobs) set.add(normalizedRegion(j.post.region));
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}

/** 사라진 지역 선택 정리 */
export function pruneSelectedRegions(selected: Set<string>, available: string[]): Set<string> {
  const avail = new Set(available);
  return new Set([...selected].filter((r) => avail.has(r)));
}
