import { useMemo, useState } from 'react';
import { BOARD_MIDS, BOARD_NAMES } from '../lib/types';
import type { MatchedJob } from '../lib/types';
import type { Settings } from '../lib/store';
import {
  applyCommuteFilter,
  availableRegions,
  filterByBoards,
  filterByRegions,
  normalizedRegion,
  pruneSelectedRegions,
} from '../lib/filters';
import JobCard from './JobCard';

interface Props {
  jobs: MatchedJob[];
  settings: Settings;
  loading: boolean;
  progressMsg: string;
  activeDestination: string;
  onRefresh: () => void;
  onOpenDestination: () => void;
  onToggleSchedule: (job: MatchedJob) => void;
  onToggleBoard: (mid: string) => void;
}

export default function JobFeed({
  jobs,
  settings,
  loading,
  progressMsg,
  activeDestination,
  onRefresh,
  onOpenDestination,
  onToggleSchedule,
  onToggleBoard,
}: Props) {
  const [filterOnlyCommute, setFilterOnlyCommute] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());

  const matchedJobs = useMemo(() => applyCommuteFilter(jobs, settings), [jobs, settings]);
  const regions = useMemo(() => availableRegions(jobs), [jobs]);

  // base list by tab
  const base = filterOnlyCommute ? matchedJobs : jobs;
  const byBoard = useMemo(() => filterByBoards(base, settings), [base, settings]);
  const displayed = useMemo(() => filterByRegions(byBoard, selectedRegions), [byBoard, selectedRegions]);

  const toggleRegion = (r: string) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  // 지역 목록이 바뀌면 사라진 선택 정리
  const pruned = pruneSelectedRegions(selectedRegions, regions);
  if (pruned.size !== selectedRegions.size) {
    setSelectedRegions(pruned);
  }

  const activeMids = BOARD_MIDS.filter((mid) => {
    switch (mid) {
      case 'job_yoga_kyongin':
        return settings.includeKyongin;
      case 'job_yoga_d':
        return settings.includeDaegang;
      case 'job_yoga':
        return settings.includeSeoul;
      case 'job_flying':
        return settings.includeFlying;
      default:
        return true;
    }
  });

  return (
    <div>
      <div className="page-header">
        <h1>호호요가 공고</h1>
        <button className="icon-btn" onClick={onRefresh} disabled={loading} aria-label="새로고침">
          {loading ? '⏳' : '🔄'}
        </button>
      </div>

      {loading && (
        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: '60%' }} />
          </div>
          <div className="progress-msg">{progressMsg}</div>
        </div>
      )}

      <div className="dest-bar">
        <span>📍</span>
        <span className="dest-name">{activeDestination}</span>
        <button onClick={onOpenDestination}>변경</button>
      </div>

      <div className="segment">
        <button className={filterOnlyCommute ? 'active' : ''} onClick={() => setFilterOnlyCommute(true)}>
          통근 가능 ({filterByRegions(filterByBoards(matchedJobs, settings), selectedRegions).length})
        </button>
        <button className={!filterOnlyCommute ? 'active' : ''} onClick={() => setFilterOnlyCommute(false)}>
          전체 공고 ({filterByRegions(filterByBoards(jobs, settings), selectedRegions).length})
        </button>
      </div>

      <div className="chip-row">
        {BOARD_MIDS.map((mid) => (
          <button
            key={mid}
            className={`chip${activeMids.includes(mid) ? ' active' : ''}`}
            onClick={() => onToggleBoard(mid)}
            title={BOARD_NAMES[mid]}
          >
            {BOARD_NAMES[mid]}
          </button>
        ))}
      </div>

      {regions.length > 0 && (
        <div className="chip-row">
          {regions.map((r) => (
            <button
              key={r}
              className={`chip${selectedRegions.has(r) ? ' active' : ''}`}
              onClick={() => toggleRegion(r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <div className="job-list">
        {displayed.length === 0 && !loading && (
          <div className="empty-state">
            <div className="big-icon">📭</div>
            <h2>공고가 없어요</h2>
            <p>
              {filterOnlyCommute && jobs.length > 0
                ? '통근 조건에 맞는 공고가 없어요. 전체 공고 탭을 확인해 보세요.'
                : '새로고침을 눌러 불러와 보세요.'}
            </p>
          </div>
        )}
        {displayed.map((job) => (
          <JobCard key={job.post.url} job={job} onToggleSchedule={onToggleSchedule} />
        ))}
      </div>
    </div>
  );
}

export { normalizedRegion };
