import { useState } from 'react';
import type { Settings as SettingsState } from '../lib/store';

interface Props {
  settings: SettingsState;
  onSave: (s: SettingsState) => void;
  onRequestCrawl: () => void;
  crawlBusy: boolean;
}

const BOARD_LABELS: [keyof SettingsState, string][] = [
  ['includeKyongin', '정규 경인'],
  ['includeDaegang', '대강'],
  ['includeSeoul', '정규 서울'],
  ['includeFlying', '플라잉/키즈'],
];

export default function SettingsView({ settings, onSave, onRequestCrawl, crawlBusy }: Props) {
  const [draft, setDraft] = useState<SettingsState>(settings);
  const set = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const save = () => {
    onSave({
      ...draft,
      maxCommuteMins: Math.max(10, Math.min(180, draft.maxCommuteMins)),
      maxTransfers: Math.max(0, Math.min(5, draft.maxTransfers)),
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1>설정</h1>
      </div>

      <div className="notice-box">
        웹 버전은 GitHub PAT가 필수예요. 토큰은 이 브라우저에만 저장돼요.
      </div>

      <div className="settings-group">
        <h3>GitHub</h3>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span style={{ marginBottom: 4 }}>Personal Access Token</span>
          <input
            className="text-input"
            type="password"
            placeholder="ghp_... / github_pat_..."
            value={draft.pat}
            onChange={(e) => set('pat', e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span style={{ marginBottom: 4 }}>데이터 저장소 (owner/repo)</span>
          <input
            className="text-input"
            value={draft.repo}
            onChange={(e) => set('repo', e.target.value)}
          />
        </div>
      </div>

      <div className="settings-group">
        <h3>통근 필터</h3>
        <div className="setting-row">
          <span>최대 소요시간 (분)</span>
          <input
            type="number"
            min={10}
            max={180}
            value={draft.maxCommuteMins}
            onChange={(e) => set('maxCommuteMins', Number(e.target.value))}
          />
        </div>
        <div className="setting-row">
          <span>최대 환승 (회)</span>
          <input
            type="number"
            min={0}
            max={5}
            value={draft.maxTransfers}
            onChange={(e) => set('maxTransfers', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="settings-group">
        <h3>게시판 표시</h3>
        {BOARD_LABELS.map(([key, label]) => (
          <div className="setting-row" key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={draft[key] as boolean}
              onChange={(e) => set(key, e.target.checked as never)}
            />
          </div>
        ))}
      </div>

      <div className="settings-group">
        <h3>서버</h3>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#6b6b70' }}>
            시간별 자동 크롤 외에 지금 바로 크롤을 요청해요. 완료까지 수 분 걸려요.
          </span>
          <button className="btn btn-secondary" disabled={crawlBusy} onClick={onRequestCrawl}>
            {crawlBusy ? '요청 중...' : '서버 크롤 요청'}
          </button>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={save}>
          저장
        </button>
      </div>
    </div>
  );
}
