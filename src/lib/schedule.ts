// 공고 시간표 텍스트 → TimetableItem 후보 파싱
// Swift TimetableStore.parseScheduleCandidates (+ extractWeekdays/extractTimeSlots/parseDurationMinutes) 포팅
import type { MatchedJob, TimetableItem } from './types';
import { newTimetableId } from './store';

export const WEEKDAY_SHORT = ['월', '화', '수', '목', '금', '토', '일']; // 1(월)~7(일)

const PALETTE = [
  '#4A90E2', '#50E3C2', '#F5A623', '#E91E63',
  '#9C27B0', '#00BCD4', '#3F51B5', '#009688',
];

interface ParsedSlot {
  hour: number;
  minute: number;
  duration?: number;
}

/** 제목 해시 → 공고별 고정 컬러 (Swift hashValue 대신 djb2) */
function colorForTitle(title: string): string {
  let h = 5381;
  for (let i = 0; i < title.length; i++) h = ((h << 5) + h + title.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function parseDurationMinutes(text: string | undefined): number | undefined {
  if (!text) return undefined;
  if (text.includes('50분')) return 50;
  if (text.includes('60분') || text.includes('1시간')) return 60;
  if (text.includes('70분')) return 70;
  if (text.includes('80분')) return 80;
  if (text.includes('90분')) return 90;
  if (text.includes('40분')) return 40;
  const m = text.match(/(\d{2,3})\s*분/);
  if (m) {
    const v = Number(m[1]);
    if (v >= 20 && v <= 180) return v;
  }
  return undefined;
}

const DAY_CHARS = '월화수목금토일';

export function extractWeekdays(text: string): number[] {
  const days = new Set<number>();
  if (text.includes('평일')) [1, 2, 3, 4, 5].forEach((d) => days.add(d));
  if (text.includes('주말')) [6, 7].forEach((d) => days.add(d));

  const mapDay = (ch: string): number | undefined => {
    const i = DAY_CHARS.indexOf(ch);
    return i >= 0 ? i + 1 : undefined;
  };
  const addChars = (s: string) => {
    for (const ch of s) {
      const d = mapDay(ch);
      if (d) days.add(d);
    }
  };

  // 비요일 단어 정제 ('수업', '수련', '일정', '금액' 및 '2일 근무' 등 일수 제거)
  const cleaned = text
    .replace(/\d+\s*일/g, '')
    .replace(/(?:수업|수련|수강|일정|일자|매일|익일|당일|목동|금액|금전|월급)/g, '');

  // 1. 괄호 안 요일 e.g. [월, 수], [금 오후 7시], (화)
  for (const m of cleaned.matchAll(/[[(]([^)\]]*)[\])]/g)) addChars(m[1]);
  // 2. "X요일" 패턴
  for (const m of cleaned.matchAll(/([월화수목금토일])\s*요일/g)) {
    const d = mapDay(m[1]);
    if (d) days.add(d);
  }
  // 3. 연속 축약형: 화목, 월수금 등
  for (const m of cleaned.matchAll(/([월화수목금토일]{2,7})/g)) addChars(m[1]);
  // 4. 구분자 나열: 월,수,금 / 화/목 / 월·수 / 월~금
  for (const m of cleaned.matchAll(/[월화수목금토일](?:\s*[,/·~-]\s*[월화수목금토일])+/g)) addChars(m[0]);
  // 5. 독립 단독 요일
  for (const m of cleaned.matchAll(/(?<![가-힣])([월화수목금토일])(?![가-힣])/g)) {
    const d = mapDay(m[1]);
    if (d) days.add(d);
  }

  return [...days].sort((a, b) => a - b);
}

const PM_WORDS = ['오후', '저녁', '밤'];
const AM_WORDS = ['오전', '아침', '새벽'];

function adjustHour(h: number, ampm: string | undefined): number {
  if (ampm && (PM_WORDS.includes(ampm) || ampm === '저녁')) {
    if (h < 12) return h + 12;
  } else if (ampm === '오전' || ampm === '아침' || ampm === '새벽') {
    if (h === 12) return 0;
  } else if (ampm === undefined || ampm === null) {
    if (h >= 1 && h <= 6) return h + 12;
  }
  return h;
}

export function extractTimeSlots(text: string, defaultAmPm?: string): ParsedSlot[] {
  const slots: ParsedSlot[] = [];

  // 0. 숫자 간 공백 정규화 및 쉼표 연강 확장
  const cleaned = text
    .replace(/(\d)\s+(?=\d)/g, '$1')
    .replace(/(\d)\s+(시|분)/g, '$1$2')
    .replace(/(\d{1,2})\s*,\s*(\d{1,2})\s*시/g, '$1시, $2시');

  let contextAmPm = defaultAmPm;
  if (AM_WORDS.some((w) => cleaned.includes(w))) contextAmPm = '오전';
  else if (['오후', '저녁', '밤'].some((w) => cleaned.includes(w))) contextAmPm = '오후';

  // 1) 범위: "19:00~20:00", "18:30 - 19:30", "오후 8시30~9시30분"
  const rangeRe = /(오전|오후|저녁|아침|밤)?\s*(\d{1,2})[:시](\d{2})?\s*(?:분)?\s*[-~]\s*(\d{1,2})[:시](\d{2})?(?:분)?/g;
  for (const m of cleaned.matchAll(rangeRe)) {
    const ampm = m[1] ?? contextAmPm;
    const sH = adjustHour(Number(m[2]), ampm);
    const sM = Number(m[3] ?? '0');
    const eH = adjustHour(Number(m[4]), ampm);
    const eM = Number(m[5] ?? '0');
    if (sH >= 6 && sH <= 23 && sM >= 0 && sM <= 59) {
      const dur = Math.max(20, eH * 60 + eM - (sH * 60 + sM));
      slots.push({ hour: sH, minute: sM, duration: dur > 0 ? dur : undefined });
    }
  }

  // 범위 매칭이 있었다면 충분히 정밀하므로 반환
  if (slots.length > 0) return slots;

  // 2) 단일/연속 시간: "오후 7:00", "19시/20시", "10:30", "저녁 6시반", "7시, 8시"
  const singleRe = /(오전|오후|저녁|아침|밤)?\s*(\d{1,2})[:시](\d{2})?(?:분)?/g;
  let lastWasPm = contextAmPm === '오후';
  for (const m of cleaned.matchAll(singleRe)) {
    const matchedAmPm = m[1];
    const ampm = matchedAmPm ?? (lastWasPm ? '오후' : contextAmPm);
    let hour = Number(m[2]);
    const minute = Number(m[3] ?? '0');

    if (matchedAmPm && PM_WORDS.includes(matchedAmPm) && hour < 12) {
      hour += 12;
      lastWasPm = true;
    } else if (matchedAmPm === '오전' && hour === 12) {
      hour = 0;
      lastWasPm = false;
    } else if (matchedAmPm && AM_WORDS.includes(matchedAmPm)) {
      if (hour === 12) hour = 0;
      lastWasPm = false;
    } else if (!matchedAmPm && ampm === '오후' && hour < 12) {
      hour += 12;
      lastWasPm = true;
    } else if (ampm === undefined || ampm === null) {
      // 오후 문맥 추론: 1~6시는 오후 타임
      if (hour >= 1 && hour <= 6) {
        hour += 12;
        lastWasPm = true;
      }
    }

    if (hour >= 6 && hour <= 23 && minute >= 0 && minute <= 59) {
      slots.push({ hour, minute });
    }
  }

  return slots;
}

/** 공고의 추출된 시간표 텍스트로부터 TimetableItem 후보군 자동 생성 (Swift 포팅) */
export function parseScheduleCandidates(job: MatchedJob): TimetableItem[] {
  const timetableText = job.extracted.timetable?.value ?? '';
  const durationMinutes =
    parseDurationMinutes(job.extracted.classDuration?.value) ??
    parseDurationMinutes(timetableText) ??
    60;
  const location = job.extracted.location?.value ?? job.post.region;
  const wage = job.extracted.wage?.value;
  const colorHex = colorForTitle(job.post.title);

  const makeItem = (weekday: number, slot: ParsedSlot, notes: string): TimetableItem => {
    const dur = slot.duration ?? durationMinutes;
    const totalStart = slot.hour * 60 + slot.minute;
    const totalEnd = Math.min(23 * 60 + 59, totalStart + dur);
    return {
      id: newTimetableId(),
      title: job.post.title,
      weekday,
      startHour: slot.hour,
      startMinute: slot.minute,
      endHour: Math.floor(totalEnd / 60),
      endMinute: totalEnd % 60,
      location,
      wage,
      notes,
      originalJobUrl: job.post.url,
      colorHex,
    };
  };

  let candidates: TimetableItem[] = [];

  // 1단계: 청크/라인 단위 문맥 기반 파싱
  const rawChunks = timetableText
    .split('|')
    .flatMap((c) => c.split('\n'))
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const extractedFromTt = extractWeekdays(timetableText);
  const globalDays = extractedFromTt.length > 0 ? extractedFromTt : extractWeekdays(job.post.title);
  let activeWeekdays: number[] = globalDays;
  let activeAmPm: string | undefined;

  for (const chunk of rawChunks) {
    const chunkDays = extractWeekdays(chunk);
    if (chunkDays.length > 0) activeWeekdays = chunkDays;

    if (chunk.includes('오전') || chunk.includes('아침') || chunk.includes('새벽')) activeAmPm = '오전';
    else if (chunk.includes('오후') || chunk.includes('저녁') || chunk.includes('밤')) activeAmPm = '오후';

    const slots = extractTimeSlots(chunk, activeAmPm);
    const targetDays = chunkDays.length > 0 ? chunkDays : activeWeekdays;

    if (targetDays.length > 0 && slots.length > 0) {
      for (const wd of targetDays) {
        for (const slot of slots) {
          candidates.push(makeItem(wd, slot, `자동 추출: ${chunk}`));
        }
      }
    }
  }

  // 2단계: 청크 파싱 실패 시 Global Matcher Fallback
  if (candidates.length === 0) {
    let globalSlots = extractTimeSlots(timetableText);
    if (globalSlots.length === 0) globalSlots = extractTimeSlots(job.post.title);

    if (globalDays.length > 0 && globalSlots.length > 0) {
      for (const wd of globalDays) {
        for (const slot of globalSlots) {
          candidates.push(makeItem(wd, slot, `통합 추출: ${timetableText}`));
        }
      }
    }
  }

  // 3단계: 동일 요일 + 시작 시간 중복 제거 후 정렬
  const seen = new Set<string>();
  candidates = candidates.filter((c) => {
    const key = `${c.weekday}_${c.startHour}_${c.startMinute}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  candidates.sort(
    (a, b) => a.weekday - b.weekday || a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute),
  );

  return candidates;
}

/** 후보를 "화 18:00~19:00" 형식 한 줄로 */
export function candidateLine(c: TimetableItem): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${WEEKDAY_SHORT[c.weekday - 1]} ${p(c.startHour)}:${p(c.startMinute)}~${p(c.endHour)}:${p(c.endMinute)}`;
}
