// GitHub API 클라이언트: hohoparser data/*.json 조회 + Actions dispatch/폴링
import { BOARD_MIDS } from './types';
import type {
  BoardPost,
  CommuteEvaluation,
  Coordinate,
  ExtractedField,
  ExtractedJobPosting,
  MatchedJob,
  ServerBoardState,
  ServerCommute,
  ServerStoredPost,
  TimetableSlot,
  Snapshot,
} from './types';

const API_BASE = 'https://api.github.com';
const FALLBACK_DESTINATION = '4호선 진접역';

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function headers(pat: string, accept?: string): HeadersInit {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: accept ?? 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function httpError(status: number): GitHubError {
  switch (status) {
    case 401:
      return new GitHubError(status, 'GitHub 인증 실패 (401): PAT가 올바르지 않거나 만료되었습니다.');
    case 403:
      return new GitHubError(status, 'GitHub 접근 거부 (403): PAT 권한(contents:read)이 부족하거나 API 요청 한도를 초과했습니다.');
    case 404:
      return new GitHubError(status, 'GitHub 저장소 또는 데이터 파일을 찾을 수 없습니다 (404).');
    default:
      return new GitHubError(status, `GitHub API 오류 (HTTP ${status})`);
  }
}

function parseRepo(repo: string): [string, string] {
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error('저장소 형식이 올바르지 않습니다 (owner/repo).');
  return [owner, name];
}

/** 게시판 JSON 조회 (raw accept로 파일 내용 직접 수신) */
export async function fetchBoardState(
  repo: string,
  boardMid: string,
  pat: string,
): Promise<ServerBoardState> {
  const [owner, name] = parseRepo(repo);
  const url = `${API_BASE}/repos/${owner}/${name}/contents/data/${boardMid}.json`;
  let res: Response;
  try {
    res = await fetch(url, { headers: headers(pat, 'application/vnd.github.raw') });
  } catch (e) {
    throw new Error(`네트워크 오류: ${(e as Error).message}`);
  }
  if (!res.ok) throw httpError(res.status);
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    throw new Error(`네트워크 오류: ${(e as Error).message}`);
  }
  try {
    return JSON.parse(text) as ServerBoardState;
  } catch (e) {
    throw new Error(`서버 데이터 해석 실패: ${(e as Error).message}`);
  }
}

function toField(v: unknown): ExtractedField | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return { value: t, rawLine: t, confidence: 1.0 };
}

function toTimetableSlots(v: unknown): TimetableSlot[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const days = '월화수목금토일';
  const out: TimetableSlot[] = [];
  for (const s of v) {
    if (typeof s !== 'object' || s === null) continue;
    const o = s as Record<string, unknown>;
    const day = typeof o['day'] === 'string' ? o['day'].trim() : '';
    const start = typeof o['start'] === 'string' ? o['start'].trim() : '';
    const end = typeof o['end'] === 'string' ? o['end'].trim() : '';
    if (day.length !== 1 || !days.includes(day)) continue;
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) continue;
    if (end <= start) continue;
    out.push({ day, start, end });
  }
  return out;
}

function toExtracted(raw: Record<string, unknown> | null | undefined): ExtractedJobPosting {
  const r = raw ?? {};
  const contactRaw = (r['contact'] as Record<string, unknown> | undefined) ?? {};
  return {
    studioName: toField(r['studio_name']),
    location: toField(r['location']),
    wage: toField(r['wage']),
    contact: {
      email: toField(contactRaw['email']),
      phone: toField(contactRaw['phone']),
    },
    timetable: toField(r['timetable']),
    classDuration: toField(r['class_duration']),
    breakTime: toField(r['break_time']),
    timetableSlots: toTimetableSlots(r['timetable_slots']),
  };
}

function toCommuteEval(c: ServerCommute, destination: string): CommuteEvaluation {
  const transfers = c.transfers ?? 99;
  return {
    walkWithin10min: c.walk_within_10min ?? false,
    walkConfidence: 1.0,
    transitWithin2Transfers: transfers <= 2,
    transitConfidence: 1.0,
    destination,
    totalTimeMins: c.total_time_mins ?? undefined,
    transfers: c.transfers ?? undefined,
    walkToStationMins: c.walk_to_station_mins ?? undefined,
    totalWalkMins: c.total_walk_mins ?? undefined,
    summaryGuidance: c.summary_guidance ?? undefined,
    landingUrl: c.landing_url ?? undefined,
  };
}

function mapStoredPost(
  stored: ServerStoredPost,
  destination: string,
  boardDefault: string,
): MatchedJob | null {
  if (stored.status === 'closed') return null;
  const p = stored.post;
  const post: BoardPost = {
    boardMid: p.board_mid,
    title: p.title,
    url: p.url,
    region: p.region ?? undefined,
    isRecruiting: p.is_recruiting,
    updatedAt: p.updated_at ?? undefined,
    detailDate: p.detail_date ?? undefined,
  };
  const extracted = toExtracted(stored.extracted);

  let commute: CommuteEvaluation | undefined;
  let geocodedCoord: Coordinate | undefined;
  const commutes = stored.commutes ?? {};
  const pick = (c: ServerCommute | undefined | null, dest: string) => {
    if (!c) return;
    commute = toCommuteEval(c, dest);
    if (c.origin_coord) geocodedCoord = c.origin_coord;
  };
  if (commutes[destination]) {
    pick(commutes[destination], destination);
  } else if (commutes[boardDefault]) {
    pick(commutes[boardDefault], boardDefault);
  } else if (stored.commute) {
    pick(stored.commute, boardDefault); // 레거시 단일 결과
  }

  return { post, extracted, commute, isScheduled: false, geocodedCoord };
}

/** 4개 게시판 병렬 조회 → 스냅샷 */
export async function fetchSnapshot(
  repo: string,
  pat: string,
  destination: string,
): Promise<Snapshot> {
  const states = await Promise.all(BOARD_MIDS.map((mid) => fetchBoardState(repo, mid, pat)));

  let effectiveDefault = FALLBACK_DESTINATION;
  for (const s of states) {
    const d = (s.default_destination ?? '').trim();
    if (d) {
      effectiveDefault = d;
      break;
    }
  }
  const target = destination.trim() || effectiveDefault;

  // destinations 합집합 (순서 유지, trim, 중복 제거)
  const destList: string[] = [];
  const seen = new Set<string>();
  const addDest = (d: string) => {
    const t = d.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      destList.push(t);
    }
  };
  for (const s of states) {
    for (const d of s.destinations ?? []) addDest(d);
    for (const sp of s.posts ?? []) {
      for (const k of Object.keys(sp.commutes ?? {})) addDest(k);
      if (sp.commute) addDest((s.default_destination ?? '').trim() || effectiveDefault);
    }
  }

  const jobs: MatchedJob[] = [];
  for (const s of states) {
    const boardDefault = (s.default_destination ?? '').trim() || effectiveDefault;
    for (const sp of s.posts ?? []) {
      const job = mapStoredPost(sp, target, boardDefault);
      if (job) jobs.push(job);
    }
  }

  return { jobs, destinations: destList, defaultDestination: effectiveDefault };
}

/** 크롤 워크플로 실행 (목적지 백필 or 강제 전체 크롤) */
export async function dispatchCrawl(
  repo: string,
  pat: string,
  destination?: string,
): Promise<void> {
  const [owner, name] = parseRepo(repo);
  const url = `${API_BASE}/repos/${owner}/${name}/actions/workflows/crawl.yml/dispatches`;
  const body: Record<string, unknown> = { ref: 'main' };
  const dest = (destination ?? '').trim();
  if (dest) body['inputs'] = { destination: dest };
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { ...headers(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`네트워크 오류: ${(e as Error).message}`);
  }
  if (!res.ok) throw httpError(res.status);
  // 204 = 정상 접수
}

interface WorkflowRun {
  head_branch: string;
  event: string;
  created_at: string;
  status: string;
  conclusion: string | null;
}

/** dispatch 이후 run 완료까지 폴링 (15초 간격, 기본 10분) */
export async function waitForRunCompletion(
  repo: string,
  pat: string,
  timeoutSeconds = 600,
): Promise<boolean> {
  const [owner, name] = parseRepo(repo);
  const waitStart = Date.now();
  const deadline = waitStart + timeoutSeconds * 1000;
  const url = `${API_BASE}/repos/${owner}/${name}/actions/runs?per_page=5`;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { headers: headers(pat) });
      if (res.ok) {
        const data = (await res.json()) as { workflow_runs: WorkflowRun[] };
        const run = data.workflow_runs.find(
          (r) =>
            r.head_branch === 'main' &&
            (r.event === 'workflow_dispatch' || r.event === 'schedule') &&
            new Date(r.created_at).getTime() > waitStart - 300_000,
        );
        if (run && run.status === 'completed') {
          return run.conclusion === 'success';
        }
      }
    } catch {
      // 일시적 오류 무시하고 재시도
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  return false;
}
