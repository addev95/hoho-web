// 카드 표시용 정규화 (Swift UI 헬퍼 포팅)

/** 위치 짧게 표시 */
export function displayLocation(raw: string | undefined): string {
  let s = (raw ?? '').trim();
  if (!s) return '위치 미기재';
  // 접두어 및 우편번호 제거
  s = s.replace(/^(위치|근무지|주소|근무지역|센터위치)\s*[:：]?\s*/, '');
  s = s.replace(/\b\d{5}\b/g, '').trim();

  const patterns: RegExp[] = [
    /(서울|경기|인천)\s*[가-힣]+\s*(구|시|군)\s*[가-힣0-9]+\s*(동|읍|면|로|길)/,
    /[가-힣]+\s*(구|시)\s*[가-힣0-9]+\s*(동|읍|면|역)/,
    /[가-힣0-9]+\s*역(\s*도보\s*\d+\s*분)?/,
    /(서울|경기|인천)\s*[가-힣]+\s*(구|시|군)/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[0].trim();
  }
  if (s.length > 22) return s.slice(0, 20) + '...';
  return s;
}

/** 급여 깔끔하게 표시 */
export function displayWage(raw: string | undefined): string {
  let s = (raw ?? '').trim();
  if (!s) return '급여 협의';
  s = s.replace(/^(급여|임금|시급|페이|강사료|수업료)\s*[:：]?\s*/, '');

  // 금액 패턴: 33,000원(~40,000원)
  const amt = s.match(/(타임당|시급|타임|기본급)?\s*\d{1,3}(,\d{3})+\s*원(\s*~\s*\d{1,3}(,\d{3})+\s*원)?/);
  if (amt) return amt[0].trim();
  // 만원 패턴: 3.5만원, 3~4만원
  const man = s.match(/\d+(\.\d+)?\s*~\s*\d+(\.\d+)?\s*만원|\d+(\.\d+)?\s*만원/);
  if (man) return man[0].trim();
  if (s.includes('협의')) return '급여 협의';
  if (s.includes('비율')) return '비율제 협의';
  if (s.length > 18) return s.slice(0, 18);
  return s;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const FALSE_POSITIVE_WORDS = ['수업', '수련', '수강', '일정', '매일', '월급'];

/** 시간표 요약 표시 */
export function displaySchedule(timetable: string | undefined): string {
  let s = (timetable ?? '').trim();
  if (!s) return '시간표 확인';

  // 시간 추출: 19:00, 오후 7시, 19시
  let timeStr = '';
  const hm = s.match(/\d{1,2}:\d{2}/);
  if (hm) {
    timeStr = hm[0];
  } else {
    const k = s.match(/(오전|오후|저녁|새벽|야간)\s*\d{1,2}\s*시/);
    if (k) {
      timeStr = k[0].replace(/\s+/g, ' ');
    } else {
      const h = s.match(/\d{1,2}\s*시/);
      if (h) timeStr = h[0].replace(/\s+/g, '');
      else {
        const tod = s.match(/오전|오후|저녁|새벽|야간/);
        if (tod) timeStr = tod[0];
      }
    }
  }

  // 요일 추출 (오탐 단어 제거 후)
  let work = s;
  for (const w of FALSE_POSITIVE_WORDS) work = work.split(w).join(' ');
  const found = new Set<string>();
  // [월, 수] 괄호 안
  for (const m of work.matchAll(/\[([^\]]+)\]/g)) {
    for (const ch of m[1]) if (WEEKDAYS.includes(ch)) found.add(ch);
  }
  // 연속 요일 (월수금) 및 X요일, 단독 요일
  for (const m of work.matchAll(/[월화수목금토일]+/g)) {
    for (const ch of m[0]) if (WEEKDAYS.includes(ch)) found.add(ch);
  }
  const days = WEEKDAYS.filter((d) => found.has(d));
  const dayStr = days.join('·');

  if (dayStr && timeStr) return `${dayStr} ${timeStr}`;
  if (dayStr) return `${dayStr} 수업`;
  if (timeStr) return `${timeStr} 시작`;
  return s.length > 20 ? s.slice(0, 20) : s;
}

/** 분 표시 */
export function formatMinutes(mins?: number): string {
  if (mins == null) return '-';
  return `${mins}분`;
}
