import { useMemo, useState } from 'react';
import { BOARD_MIDS, BOARD_NAMES } from '../lib/types';
import type { MatchedJob } from '../lib/types';
import type { Settings } from '../lib/store';
import {
  applyCommuteFilter,
  availableSidos,
  filterByBoards,
  filterByRegions,
  pruneSelectedRegions,
  sigunguKey,
  sigungusFor,
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
  const [selectedSidos, setSelectedSidos] = useState<Set<string>>(new Set());
  const [selectedSigungus, setSelectedSigungus] = useState<Set<string>>(new Set());

  const matchedJobs = useMemo(() => applyCommuteFilter(jobs, settings), [jobs, settings]);
  const sidos = useMemo(() => availableSidos(jobs), [jobs]);

  // base list by tab
  const base = filterOnlyCommute ? matchedJobs : jobs;
  const byBoard = useMemo(() => filterByBoards(base, settings), [base, settings]);
  const displayed = useMemo(
    () => filterByRegions(byBoard, selectedSidos, selectedSigungus),
    [byBoard, selectedSidos, selectedSigungus],
  );

  const toggleSido = (sido: string) => {
    if (selectedSidos.has(sido)) {
      setSelectedSidos((prev) => {
        const next = new Set(prev);
        next.delete(sido);
        return next;
      });
      // 해제 시 하위 시군구 선택도 함께 제거
      setSelectedSigungus((prev) => new Set([...prev].filter((k) => !k.startsWith(sido + ' '))));
    } else {
      setSelectedSidos((prev) => new Set(prev).add(sido));
    }
  };

  const toggleSigungu = (sido: string, sigungu: string) => {
    const key = sigunguKey(sido, sigungu);
    if (selectedSigungus.has(key)) {
      setSelectedSigungus((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      setSelectedSigungus((prev) => new Set(prev).add(key));
      if (!selectedSidos.has(sido)) {
        setSelectedSidos((prev) => new Set(prev).add(sido));
      }
    }
  };

  const clearRegions = () => {
    setSelectedSidos(new Set());
    setSelectedSigungus(new Set());
  };

  // 지역 목록이 바뀌면 사라진 선택 정리
  const [prunedSidos, prunedSigungus] = pruneSelectedRegions(jobs, selectedSidos, selectedSigungus);
  if (prunedSidos.size !== selectedSidos.size || prunedSigungus.size !== selectedSigungus.size) {
    setSelectedSidos(prunedSidos);
    setSelectedSigungus(prunedSigungus);
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
          통근 가능 ({filterByRegions(filterByBoards(matchedJobs, settings), selectedSidos, selectedSigungus).length})
        </button>
        <button className={!filterOnlyCommute ? 'active' : ''} onClick={() => setFilterOnlyCommute(false)}>
          전체 공고 ({filterByRegions(filterByBoards(jobs, settings), selectedSidos, selectedSigungus).length})
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

      {sidos.length > 0 && (
        <div>
          {/* 1단계: 시도 */}
          <div className="chip-row">
            {sidos.map((sido) => (
              <button
                key={sido}
                className={`chip${selectedSidos.has(sido) ? ' active' : ''}`}
                onClick={() => toggleSido(sido)}
              >
                {sido}
              </button>
            ))}
            {(selectedSidos.size > 0 || selectedSigungus.size > 0) && (
              <button className="chip chip-clear" onClick={clearRegions}>
                전체
              </button>
            )}
          </div>
          {/* 2단계: 선택된 시도의 시군구 */}
          {[...selectedSidos]
            .sort((a, b) => a.localeCompare(b, 'ko'))
            .map((sido) => {
              const list = sigungusFor(jobs, sido);
              if (list.length === 0) return null;
              return (
                <div key={sido} className="sigungu-row">
                  <span className="sigungu-label">{sido}</span>
                  <div className="chip-row sigungu-chips">
                    {list.map((sigungu) => {
                      const key = sigunguKey(sido, sigungu);
                      return (
                        <button
                          key={key}
                          className={`chip chip-sm${selectedSigungus.has(key) ? ' active' : ''}`}
                          onClick={() => toggleSigungu(sido, sigungu)}
                        >
                          {sigungu}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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

