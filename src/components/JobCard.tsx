import { useMemo } from 'react';
import type { MatchedJob, TimetableItem } from '../lib/types';
import { displayLocation, displaySchedule, displayWage, formatMinutes } from '../lib/format';
import { candidateLine, slotsToItems } from '../lib/schedule';
import { BOARD_NAMES } from '../lib/types';

interface Props {
  job: MatchedJob;
  onToggleSchedule: (job: MatchedJob) => void;
}

export default function JobCard({ job, onToggleSchedule }: Props) {
  const { post, extracted, commute, isScheduled } = job;
  // 지역 표시는 동 단위 post.region 우선
  const region = post.region?.trim() || displayLocation(extracted.location?.value);
  const studio = extracted.studioName?.value?.trim();
  const wage = displayWage(extracted.wage?.value);
  const schedule = displaySchedule(extracted.timetable?.value);
  const candidates = useMemo(() => slotsToItems(job), [job]);

  return (
    <div className="job-card">
      <div className="job-loc">
        📍 {region} · {BOARD_NAMES[post.boardMid] ?? post.boardMid}
      </div>
      <div className="job-title">{post.title}</div>
      <div className="job-meta">
        <span className="mchip mchip-wage">₩ {wage}</span>
        {studio && <span className="studio-subtle">{studio}</span>}
        {candidates.length === 0 && <span className="mchip mchip-schedule">🕐 {schedule}</span>}
      </div>
      {candidates.length > 0 && (
        <div className="schedule-lines">
          {candidates.slice(0, 4).map((c) => (
            <div key={c.id} className="schedule-line">
              🕐 {candidateLine(c)}
            </div>
          ))}
          {candidates.length > 4 && (
            <div className="schedule-line more">외 {candidates.length - 4}개</div>
          )}
        </div>
      )}
      {commute && commute.totalTimeMins != null && (
        <div className="commute-box">
          🚌 총 {formatMinutes(commute.totalTimeMins)}, 환승 {commute.transfers ?? '-'}회
          {commute.walkToStationMins != null && ` · 도보 ${formatMinutes(commute.walkToStationMins)}`}
          <div style={{ fontSize: 12, color: '#6b6b70' }}>{commute.destination} 기준</div>
          {commute.summaryGuidance && (
            <div style={{ fontSize: 12, marginTop: 4 }}>{commute.summaryGuidance}</div>
          )}
          {(() => {
            const oc = job.geocodedCoord;
            const dc = commute.destCoord;
            const fromName = extracted.studioName?.value?.trim() || post.region;
            // by/traffic: 대중교통 탭 고정. from은 장소 ID 우선 (없으면 상호명+좌표)
            const toSeg = dc && commute.destination
              ? `${encodeURIComponent(commute.destination)},${dc.y},${dc.x}`
              : null;
            let mapUrl = commute.landingUrl;
            if (toSeg) {
              const fromSeg = job.kakaoPlaceId
                ? job.kakaoPlaceId
                : (oc && fromName ? `${encodeURIComponent(fromName)},${oc.y},${oc.x}` : null);
              if (fromSeg) {
                mapUrl = `https://map.kakao.com/link/by/traffic/${fromSeg}/${toSeg}`;
              }
            }
            return mapUrl ? (
              <>
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: '#0066ff', display: 'inline-block', marginTop: 4 }}
                >
                  카카오맵에서 길찾기 열기 ↗
                </a>
                {job.kakaoPlaceId && (
                  <>
                    {' · '}
                    <a
                      href={`https://place.map.kakao.com/${job.kakaoPlaceId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: '#0066ff', display: 'inline-block', marginTop: 4 }}
                    >
                      장소 보기 ↗
                    </a>
                  </>
                )}
              </>
            ) : null;
          })()}
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
