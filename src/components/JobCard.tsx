import type { MatchedJob, TimetableItem } from '../lib/types';
import { displayLocation, displaySchedule, displayWage, formatMinutes } from '../lib/format';
import { BOARD_NAMES } from '../lib/types';

interface Props {
  job: MatchedJob;
  onToggleSchedule: (job: MatchedJob) => void;
}

export default function JobCard({ job, onToggleSchedule }: Props) {
  const { post, extracted, commute, isScheduled } = job;
  const loc = displayLocation(extracted.location?.value ?? post.region);
  const wage = displayWage(extracted.wage?.value);
  const schedule = displaySchedule(extracted.timetable?.value);

  return (
    <div className="job-card">
      <div className="job-loc">
        {loc} · {BOARD_NAMES[post.boardMid] ?? post.boardMid}
      </div>
      <div className="job-title">{post.title}</div>
      <div className="job-meta">
        <span className="mchip mchip-wage">₩ {wage}</span>
        <span className="mchip mchip-schedule">🕐 {schedule}</span>
      </div>
      {commute && commute.totalTimeMins != null && (
        <div className="commute-box">
          🚌 총 {formatMinutes(commute.totalTimeMins)}, 환승 {commute.transfers ?? '-'}회
          {commute.walkToStationMins != null && ` · 도보 ${formatMinutes(commute.walkToStationMins)}`}
          <div style={{ fontSize: 12, color: '#6b6b70' }}>{commute.destination} 기준</div>
          {commute.summaryGuidance && (
            <div style={{ fontSize: 12, marginTop: 4 }}>{commute.summaryGuidance}</div>
          )}
        </div>
      )}
      <div className="job-actions">
        <a
          className="btn btn-secondary"
          style={{ textDecoration: 'none', fontSize: 13, padding: '8px 14px' }}
          href={post.url}
          target="_blank"
          rel="noreferrer"
        >
          원문 보기
        </a>
        <button className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => onToggleSchedule(job)}>
          {isScheduled ? '✓ 시간표 등록됨' : '+ 시간표 등록'}
        </button>
      </div>
    </div>
  );
}

export function jobToTimetableSeed(job: MatchedJob): Partial<TimetableItem> {
  return {
    title: job.extracted.studioName?.value ?? job.post.title.slice(0, 20),
    location: job.extracted.location?.value,
    wage: job.extracted.wage?.value,
    originalJobUrl: job.post.url,
  };
}
