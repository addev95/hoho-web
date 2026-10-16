import { useEffect, useState } from 'react';
import type { TimetableItem } from '../lib/types';
import { newTimetableId } from '../lib/store';

interface Props {
  items: TimetableItem[];
  seed: Partial<TimetableItem> | null;
  onSeedConsumed: () => void;
  onAdd: (item: TimetableItem) => void;
  onDelete: (id: string) => void;
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const START_HOUR = 7;
const END_HOUR = 23;
const HOUR_PX = 40;

export default function Timetable({ items, seed, onSeedConsumed, onAdd, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');

  // 공고에서 "시간표 등록" → 폼을 미리 채워서 열기
  useEffect(() => {
    if (seed) {
      if (seed.title) setTitle(seed.title);
      setShowForm(true);
      onSeedConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  const addItem = () => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (!title.trim()) return;
    onAdd({
      id: newTimetableId(),
      title: title.trim(),
      weekday,
      startHour: sh,
      startMinute: sm,
      endHour: eh,
      endMinute: em,
      colorHex: '#4A90E2',
    });
    setTitle('');
    setShowForm(false);
  };

  const blockStyle = (it: TimetableItem): React.CSSProperties => {
    const top = (it.startHour * 60 + it.startMinute - START_HOUR * 60) * (HOUR_PX / 60);
    const height = Math.max(
      18,
      (it.endHour * 60 + it.endMinute - (it.startHour * 60 + it.startMinute)) * (HOUR_PX / 60),
    );
    return { top, height, background: it.colorHex };
  };

  return (
    <div>
      <div className="page-header">
        <h1>내 시간표</h1>
        <button className="icon-btn" onClick={() => setShowForm(!showForm)} aria-label="추가">
          ➕
        </button>
      </div>

      {showForm && (
        <div className="settings-group">
          <h3>일정 추가</h3>
          <input
            className="text-input"
            placeholder="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="setting-row">
            <span>요일</span>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}요일
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <span>시작</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="setting-row">
            <span>종료</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', margin: '8px 0' }} onClick={addItem}>
            추가
          </button>
        </div>
      )}

      <div className="timetable-grid">
        <div />
        {DAYS.map((d) => (
          <div key={d} className="th">
            {d}
          </div>
        ))}
        {hours.map((h) => (
          <>
            <div key={`h${h}`} className="hour-label">
              {h}:00
            </div>
            {DAYS.map((_, di) => (
              <div key={`${h}-${di}`} className="cell" />
            ))}
          </>
        ))}
        {/* 블록 오버레이: 각 요일 컬럼에 절대 배치 */}
        {DAYS.map((_, di) => (
          <div
            key={`col-${di}`}
            style={{
              gridColumn: di + 2,
              gridRow: '2',
              position: 'relative',
              height: hours.length * HOUR_PX,
              marginTop: -hours.length * HOUR_PX,
              pointerEvents: 'none',
            }}
          >
            {items
              .filter((it) => it.weekday === di + 1)
              .map((it) => (
                <div
                  key={it.id}
                  className="tt-block"
                  style={{ ...blockStyle(it), pointerEvents: 'auto' }}
                  onClick={() => {
                    if (window.confirm(`"${it.title}" 삭제할까요?`)) onDelete(it.id);
                  }}
                  title={`${it.title} (삭제: 클릭)`}
                >
                  {it.title}
                </div>
              ))}
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <p style={{ textAlign: 'center', color: '#6b6b70', fontSize: 13 }}>
          공고 카드의 "+ 시간표 등록"으로도 추가할 수 있어요.
        </p>
      )}
    </div>
  );
}
