// 구조화 시간표(timetable_slots) → TimetableItem 변환 + 표시
// Gemini가 직접 추출한 슬롯을 사용하므로 정규식 파서는 제거됨.
import type { MatchedJob, TimetableItem, TimetableSlot } from './types';
import { newTimetableId } from './store';

export const WEEKDAY_SHORT = ['월', '화', '수', '목', '금', '토', '일']; // 1(월)~7(일)

const PALETTE = [
  '#4A90E2', '#50E3C2', '#F5A623', '#E91E63',
  '#9C27B0', '#00BCD4', '#3F51B5', '#009688',
];

/** 제목 해시 → 공고별 고정 컬러 (djb2) */
function colorForTitle(title: string): string {
  let h = 5381;
  for (let i = 0; i < title.length; i++) h = ((h << 5) + h + title.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/** 구조화 슬롯 → TimetableItem (중복 제거·정렬·연속 병합) */
export function slotsToItems(job: MatchedJob): TimetableItem[] {
  const slots = job.extracted.timetableSlots;
  if (!slots || slots.length === 0) return [];

  const location = job.extracted.location?.value ?? job.post.region;
  const wage = job.extracted.wage?.value;
  const colorHex = colorForTitle(job.post.title);

  const toItem = (s: TimetableSlot): TimetableItem => {
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    return {
      id: newTimetableId(),
      title: job.post.title,
      weekday: WEEKDAY_SHORT.indexOf(s.day) + 1,
      startHour: sh,
      startMinute: sm,
      endHour: eh,
      endMinute: em,
      location,
      wage,
      notes: '서버 추출',
      originalJobUrl: job.post.url,
      colorHex,
    };
  };

  // 중복 제거 후 정렬
  const seen = new Set<string>();
  const items = slots
    .map(toItem)
    .filter((c) => {
      const key = `${c.weekday}_${c.startHour}_${c.startMinute}_${c.endHour}_${c.endMinute}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        a.weekday - b.weekday || a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute),
    );

  // 같은 요일의 연속/겹침 슬롯 병합 (수업 사이 30분 이내 휴식은 이어진 블록으로 취급)
  // (화 18:50~19:50 + 화 20:00~21:00 → 화 18:50~21:00 (2타임, 각 60분))
  const MERGE_GAP_MINUTES = 30;
  const merged: TimetableItem[] = [];
  const mergedMinutes: number[][] = [];
  for (const c of items) {
    const last = merged[merged.length - 1];
    const lastEnd = last ? last.endHour * 60 + last.endMinute : -1;
    const curStart = c.startHour * 60 + c.startMinute;
    const curEnd = c.endHour * 60 + c.endMinute;
    const curMin = curEnd - curStart;
    if (last && last.weekday === c.weekday && curStart - lastEnd <= MERGE_GAP_MINUTES) {
      if (curEnd > lastEnd) {
        last.endHour = Math.floor(curEnd / 60);
        last.endMinute = curEnd % 60;
      }
      const mins = mergedMinutes[mergedMinutes.length - 1];
      mins.push(curMin);
      last.mergedCount = mins.length;
      last.mergedSlotMinutes = mins.every((m) => m === mins[0]) ? mins[0] : undefined;
    } else {
      merged.push(c);
      mergedMinutes.push([curMin]);
    }
  }

  return merged;
}

/** 후보를 "화 18:50~21:00" 형식 한 줄로 (병합된 경우 "(2타임, 각 60분)" 표기) */
export function candidateLine(c: TimetableItem): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const base = `${WEEKDAY_SHORT[c.weekday - 1]} ${p(c.startHour)}:${p(c.startMinute)}~${p(c.endHour)}:${p(c.endMinute)}`;
  if (c.mergedCount && c.mergedCount > 1) {
    const each = c.mergedSlotMinutes ? `, 각 ${c.mergedSlotMinutes}분` : '';
    return `${base} (${c.mergedCount}타임${each})`;
  }
  return base;
}
