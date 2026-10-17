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

/** 지역 다중선택 필터 (2단계: 시도 → 시군구, Swift JobFeedViewModel 포팅)
 *  selectedSidos가 비어 있으면 전체. 시도 선택 = 그 시도 전체,
 *  시군구 선택이 있으면 그 중 하나에 속한 공고만. 시도별로 독립 판정. */
export function filterByRegions(
  jobs: MatchedJob[],
  selectedSidos: Set<string>,
  selectedSigungus: Set<string>,
): MatchedJob[] {
  if (selectedSidos.size === 0) return jobs;
  return jobs.filter((j) => {
    const p = splitRegion(j.post.region);
    if (!selectedSidos.has(p.sido)) return false;
    const prefix = p.sido + ' ';
    const sub = [...selectedSigungus].filter((k) => k.startsWith(prefix));
    if (sub.length === 0) return true;
    const key = p.sigungu ? `${p.sido} ${p.sigungu}` : p.sido;
    return sub.includes(key);
  });
}

/** 태그("경기 성남시 분당구 정자동")를 시도/시군구로 분리한다.
 *  서버 Rust의 region_tag_from_address와 동일한 규칙 (시군구 2토큰 처리 포함). */
export function splitRegion(region: string | undefined | null): { sido: string; sigungu: string | null } {
  const r = (region ?? '').trim();
  if (!r) return { sido: '미정', sigungu: null };
  const toks = r.split(/\s+/);
  if (toks.length < 2) return { sido: toks[0], sigungu: null };
  const sido = toks[0];
  if (toks.length >= 3 && toks[1].endsWith('시') && (toks[2].endsWith('구') || toks[2].endsWith('군'))) {
    return { sido, sigungu: `${toks[1]} ${toks[2]}` };
  }
  return { sido, sigungu: toks[1] };
}

/** 시군구 선택 키 ("시도 시군구" — 서울 중구/인천 중구 구분용) */
export function sigunguKey(sido: string, sigungu: string): string {
  return `${sido} ${sigungu}`;
}

/** 전체 공고의 시도 목록 (1단계 칩 표시용, 중복 제거·정렬) */
export function availableSidos(jobs: MatchedJob[]): string[] {
  return [...new Set(jobs.map((j) => splitRegion(j.post.region).sido))].sort((a, b) =>
    a.localeCompare(b, 'ko'),
  );
}

/** 특정 시도의 시군구 목록 (2단계 칩 표시용, 중복 제거·정렬) */
export function sigungusFor(jobs: MatchedJob[], sido: string): string[] {
  const set = new Set<string>();
  for (const j of jobs) {
    const p = splitRegion(j.post.region);
    if (p.sido === sido && p.sigungu) set.add(p.sigungu);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}

/** 사라진 지역 선택 정리 (시도·시군구 모두) */
export function pruneSelectedRegions(
  jobs: MatchedJob[],
  sidos: Set<string>,
  sigungus: Set<string>,
): [Set<string>, Set<string>] {
  const availSidos = new Set(availableSidos(jobs));
  const nextSidos = new Set([...sidos].filter((s) => availSidos.has(s)));
  const nextSigungus = new Set(
    [...sigungus].filter((key) => {
      const sp = key.indexOf(' ');
      if (sp < 0) return false;
      const sido = key.slice(0, sp);
      if (!availSidos.has(sido)) return false;
      return sigungusFor(jobs, sido).some((sg) => `${sido} ${sg}` === key);
    }),
  );
  return [nextSidos, nextSigungus];
}
