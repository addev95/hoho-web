import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import type { MatchedJob, TimetableItem } from './lib/types';
import {
  isPatConfigured,
  loadSettings,
  loadTimetable,
  saveSettings,
  saveTimetable,
  isJobRegistered,
} from './lib/store';
import type { Settings } from './lib/store';
import { dispatchCrawl, fetchSnapshot, resolveDestination, waitForRunCompletion } from './lib/github';
import Onboarding from './components/Onboarding';
import JobFeed from './components/JobFeed';
import DestinationSheet from './components/DestinationSheet';
import Timetable from './components/Timetable';
import SettingsView from './components/Settings';
import { jobToTimetableSeed } from './components/JobCard';
import { candidateLine, slotsToItems } from './lib/schedule';

type Tab = 'feed' | 'timetable' | 'settings';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState<Tab>('feed');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState<MatchedJob[]>([]);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [activeDestination, setActiveDestination] = useState('');
  const [timetable, setTimetable] = useState<TimetableItem[]>(loadTimetable);
  const [destSheetOpen, setDestSheetOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [crawlBusy, setCrawlBusy] = useState(false);
  const [timetableSeed, setTimetableSeed] = useState<Partial<TimetableItem> | null>(null);
  const loadingRef = useRef(false);

  const markScheduled = useCallback(
    (list: MatchedJob[], items: TimetableItem[]) =>
      list.map((j) => ({ ...j, isScheduled: isJobRegistered(items, j.post.url) })),
    [],
  );

  const applySnapshot = useCallback(
    (
      snap: { jobs: MatchedJob[]; destinations: string[]; defaultDestination: string },
      items: TimetableItem[],
    ) => {
      setDestinations(snap.destinations);
      setJobs(markScheduled(snap.jobs, items));
    },
    [markScheduled],
  );

  /** 새로고침 (스펙 §2) */
  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    const s = loadSettings();
    if (!isPatConfigured(s)) {
      setError('공고를 보려면 GitHub PAT가 필요합니다.');
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      setProgressMsg('git에서 공고 불러오는 중...');
      const serverDest = s.destinationStation.trim();
      const items = loadTimetable();
      let snap = await fetchSnapshot(s.repo, s.pat, serverDest);
      // "진접역" → "4호선 진접역" 같은 호선 접두어 차이는 기존 분석을 재사용
      let resolved = resolveDestination(serverDest, snap.destinations);
      if (resolved && resolved !== serverDest) {
        snap = await fetchSnapshot(s.repo, s.pat, resolved);
      }
      let activeDest = resolved ?? serverDest ?? snap.defaultDestination;

      if (serverDest && !resolved) {
        setProgressMsg(`"${serverDest}" 서버에서 분석 중... (최대 10분 소요)`);
        await dispatchCrawl(s.repo, s.pat, serverDest);
        const ok = await waitForRunCompletion(s.repo, s.pat);
        if (ok) {
          setProgressMsg('분석 완료! 다시 불러오는 중...');
          snap = await fetchSnapshot(s.repo, s.pat, serverDest);
          resolved = resolveDestination(serverDest, snap.destinations);
          activeDest = resolved ?? serverDest;
        } else {
          setError('서버 분석 시간 초과 — 기본 목적지 데이터로 표시합니다.');
          activeDest = snap.defaultDestination;
        }
      }
      setActiveDestination(activeDest);
      applySnapshot(snap, items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setProgressMsg('');
    }
  }, [applySnapshot]);

  /** 목적지 변경 (스펙 §4) */
  const changeDestination = useCallback(
    async (name: string) => {
      const destName = name.trim();
      if (!destName || analyzing) return;
      const s = loadSettings();
      if (!isPatConfigured(s)) {
        setError('공고를 보려면 GitHub PAT가 필요합니다.');
        return;
      }
      setAnalyzing(true);
      setDestSheetOpen(false);
      setError('');
      try {
        // 호선 접두어 차이("진접역"→"4호선 진접역")는 기존 분석 재사용
        const canonical = resolveDestination(destName, destinations) ?? destName;
        if (!resolveDestination(destName, destinations)) {
          setProgressMsg(`"${destName}" 서버에서 분석 중... (최대 10분 소요)`);
          setLoading(true);
          await dispatchCrawl(s.repo, s.pat, destName);
          const ok = await waitForRunCompletion(s.repo, s.pat);
          setLoading(false);
          setProgressMsg('');
          if (!ok) {
            setError('서버 분석 시간 초과 — 기존 목적지를 유지합니다.');
            return;
          }
        }
        const items = loadTimetable();
        const snap = await fetchSnapshot(s.repo, s.pat, canonical);
        setActiveDestination(canonical);
        applySnapshot(snap, items);
        const ns = { ...s, destinationStation: canonical };
        saveSettings(ns);
        setSettings(ns);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setAnalyzing(false);
        setLoading(false);
        setProgressMsg('');
      }
    },
    [analyzing, applySnapshot, destinations],
  );

  /** 서버 크롤 강제 요청 (설정 탭) */
  const requestCrawl = useCallback(async () => {
    const s = loadSettings();
    if (!isPatConfigured(s) || crawlBusy) return;
    setCrawlBusy(true);
    setError('');
    try {
      await dispatchCrawl(s.repo, s.pat);
      setProgressMsg('서버 크롤 요청됨. 완료 후 새로고침해 주세요 (수 분 소요).');
      const ok = await waitForRunCompletion(s.repo, s.pat, 900);
      if (ok) {
        await refresh();
      } else {
        setError('크롤 완료 확인 시간 초과 — 잠시 후 새로고침해 보세요.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCrawlBusy(false);
      setProgressMsg('');
    }
  }, [crawlBusy, refresh]);

  const updateTimetable = (items: TimetableItem[]) => {
    setTimetable(items);
    saveTimetable(items);
    setJobs((prev) => markScheduled(prev, items));
  };

  const toggleSchedule = (job: MatchedJob) => {
    if (isJobRegistered(timetable, job.post.url)) {
      updateTimetable(timetable.filter((i) => i.originalJobUrl !== job.post.url));
    } else {
      // 구조화 슬롯 일괄 등록 (슬롯이 없으면 수동 입력 폼으로)
      const candidates = slotsToItems(job);
      if (candidates.length === 0) {
        setTimetableSeed(jobToTimetableSeed(job));
        setTab('timetable');
      } else {
        const lines = candidates.map(candidateLine).join('\n');
        if (window.confirm(`다음 ${candidates.length}개 일정을 등록할까요?\n\n${lines}`)) {
          updateTimetable([...timetable, ...candidates]);
        }
      }
    }
  };

  const toggleBoard = (mid: string) => {
    const key =
      mid === 'job_yoga_kyongin'
        ? 'includeKyongin'
        : mid === 'job_yoga_d'
          ? 'includeDaegang'
          : mid === 'job_yoga'
            ? 'includeSeoul'
            : 'includeFlying';
    const ns = { ...settings, [key]: !settings[key as keyof Settings] };
    saveSettings(ns);
    setSettings(ns);
  };

  // 부팅: PAT 있으면 자동 새로고침
  useEffect(() => {
    const s = loadSettings();
    setBooted(true);
    if (isPatConfigured(s)) {
      setActiveDestination(s.destinationStation.trim() || '4호선 진접역');
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!booted) return null;

  if (!isPatConfigured(settings)) {
    return (
      <Onboarding
        onSave={(pat) => {
          const ns = { ...settings, pat };
          saveSettings(ns);
          setSettings(ns);
          setActiveDestination(ns.destinationStation.trim() || '4호선 진접역');
          setTimeout(refresh, 0);
        }}
      />
    );
  }

  return (
    <div>
      {tab === 'feed' && (
        <JobFeed
          jobs={jobs}
          settings={settings}
          loading={loading}
          progressMsg={progressMsg}
          activeDestination={activeDestination}
          onRefresh={refresh}
          onOpenDestination={() => setDestSheetOpen(true)}
          onToggleSchedule={toggleSchedule}
          onToggleBoard={toggleBoard}
        />
      )}
      {tab === 'timetable' && (
        <Timetable
          items={timetable}
          seed={timetableSeed}
          onSeedConsumed={() => setTimetableSeed(null)}
          onAdd={(it) => updateTimetable([...timetable, it])}
          onDelete={(id) => updateTimetable(timetable.filter((i) => i.id !== id))}
        />
      )}
      {tab === 'settings' && (
        <SettingsView
          settings={settings}
          onSave={(s) => {
            saveSettings(s);
            setSettings(s);
          }}
          onRequestCrawl={requestCrawl}
          crawlBusy={crawlBusy}
        />
      )}

      {error && (
        <div className="error-box" onClick={() => setError('')}>
          {error} (탭하여 닫기)
        </div>
      )}

      <DestinationSheet
        open={destSheetOpen}
        destinations={destinations}
        activeDestination={activeDestination}
        analyzing={analyzing}
        onClose={() => setDestSheetOpen(false)}
        onSelect={changeDestination}
      />

      <nav className="tabbar">
        <button className={tab === 'feed' ? 'active' : ''} onClick={() => setTab('feed')}>
          <span className="tab-icon">📋</span>공고
        </button>
        <button className={tab === 'timetable' ? 'active' : ''} onClick={() => setTab('timetable')}>
          <span className="tab-icon">🗓️</span>시간표
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          <span className="tab-icon">⚙️</span>설정
        </button>
      </nav>
    </div>
  );
}
