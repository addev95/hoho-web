import { useState } from 'react';

interface Props {
  onSave: (pat: string) => void;
}

export default function Onboarding({ onSave }: Props) {
  const [pat, setPat] = useState('');

  return (
    <div className="onboarding">
      <div className="big-icon">🔑</div>
      <h2>GitHub PAT가 필요해요</h2>
      <p>
        공고 데이터는 서버에서 분석해 git에 저장돼요.
        <br />
        아래 토큰을 입력하면 바로 볼 수 있어요.
      </p>
      <div className="key-option">
        <strong>필요 권한</strong>
        <br />
        Contents 읽기 + Actions 읽기·쓰기
        <br />
        (대상 repo: 아래 설정에서 변경 가능)
      </div>
      <input
        className="text-input"
        type="password"
        placeholder="ghp_... 또는 github_pat_..."
        value={pat}
        onChange={(e) => setPat(e.target.value)}
        autoComplete="off"
      />
      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        disabled={!pat.trim()}
        onClick={() => onSave(pat.trim())}
      >
        저장하고 시작하기
      </button>
      <p style={{ marginTop: 12, fontSize: 13 }}>
        토큰은 hohoparser 저장소 소유자만 발급할 수 있어요.
      </p>
      <div className="notice-box" style={{ textAlign: 'left', margin: '12px 0' }}>
        토큰은 이 브라우저에만 저장돼요. 공용 기기에서는 사용 후 설정에서 삭제해 주세요.
      </div>
    </div>
  );
}
