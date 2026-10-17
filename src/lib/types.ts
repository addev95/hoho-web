// hohoparser data/*.json 스키마 + 클라이언트 모델 (Swift 앱 포팅)

export interface Coordinate {
  x: number; // 경도
  y: number; // 위도 (WGS84)
}

// ── 서버 JSON (snake_case) ──────────────────────────────

export interface ServerBoardState {
  board_mid: string;
  default_destination: string;
  destinations: string[];
  updated_at: number;
  posts: ServerStoredPost[];
}

export interface ServerPost {
  board_mid: string;
  title: string;
  url: string;
  region?: string | null;
  is_recruiting: boolean;
  updated_at?: string | null;
  detail_date?: string | null;
}

export interface ServerCommute {
  is_commutable?: boolean;
  total_time_mins?: number | null;
  transfers?: number | null;
  walk_to_station_mins?: number | null;
  walk_within_10min?: boolean;
  total_walk_mins?: number | null;
  route_type?: string | null;
  summary_guidance?: string | null;
  landing_url?: string | null;
  origin_coord?: Coordinate | null;
  dest_coord?: Coordinate | null;
  computed_at?: number | null;
}

export interface ServerStoredPost {
  id: string;
  post: ServerPost;
  extracted?: Record<string, unknown> | null;
  commutes?: Record<string, ServerCommute> | null;
  commute?: ServerCommute | null; // 레거시 단일 결과
  status: string;
  first_seen?: number | null;
  last_seen?: number | null;
  kakao_place_id?: string | null;
}

// ── 클라이언트 모델 (camelCase) ─────────────────────────

export interface ExtractedField {
  value: string;
  rawLine: string;
  confidence: number;
}

export interface ExtractedContact {
  email?: ExtractedField;
  phone?: ExtractedField;
}

export interface CommuteEvaluation {
  walkWithin10min: boolean;
  walkConfidence: number;
  transitWithin2Transfers: boolean;
  transitConfidence: number;
  destination: string; // 실제 계산된 목적지명
  totalTimeMins?: number;
  transfers?: number;
  walkToStationMins?: number;
  totalWalkMins?: number;
  summaryGuidance?: string;
  landingUrl?: string;
  destCoord?: Coordinate; // 목적지 좌표 (from/to 링크 조립용)
}

export interface TimetableSlot {
  day: string; // "월"~"일" 1자
  start: string; // "HH:MM" 24시간제
  end: string; // "HH:MM" 24시간제
}

export interface ExtractedJobPosting {
  studioName?: ExtractedField;
  location?: ExtractedField;
  wage?: ExtractedField;
  contact: ExtractedContact;
  timetable?: ExtractedField;
  classDuration?: ExtractedField;
  breakTime?: ExtractedField;
  /** Gemini 구조화 시간표. undefined = 구 데이터(서버 백필 전) */
  timetableSlots?: TimetableSlot[];
}

export interface BoardPost {
  boardMid: string;
  title: string;
  url: string; // id = url
  region?: string;
  isRecruiting: boolean;
  updatedAt?: string;
  detailDate?: string;
}

export interface MatchedJob {
  // id = post.url
  post: BoardPost;
  extracted: ExtractedJobPosting;
  commute?: CommuteEvaluation;
  isScheduled: boolean;
  geocodedCoord?: Coordinate;
  /** 카카오 장소 ID (place.map.kakao.com/{id} 링크용) */
  kakaoPlaceId?: string;
}

export interface Snapshot {
  jobs: MatchedJob[];
  destinations: string[];
  defaultDestination: string;
}

// ── 시간표 ──────────────────────────────────────────────

export interface TimetableItem {
  id: string;
  title: string;
  weekday: number; // 1(월)~7(일)
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  location?: string;
  wage?: string;
  notes?: string;
  originalJobUrl?: string;
  colorHex: string;
  mergedCount?: number; // 연속 슬롯 병합 시 합쳐진 타임 수 (표시용)
  mergedSlotMinutes?: number; // 병합된 슬롯들이 모두 같은 분일 때 각 슬롯 분 (표시용)
}

export const BOARD_NAMES: Record<string, string> = {
  job_yoga_kyongin: '정규 경인',
  job_yoga_d: '대강',
  job_yoga: '정규 서울',
  job_flying: '플라잉/키즈',
};

export const BOARD_MIDS = [
  'job_yoga_kyongin',
  'job_yoga_d',
  'job_yoga',
  'job_flying',
];

export const DESTINATION_PRESETS = [
  '진접역',
  '별내별가람역',
  '별내역',
  '상계역',
  '노원역',
  '창동역',
  '구리역',
  '강남역',
  '잠실역',
  '종로3가역',
];
