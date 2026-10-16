import { useState } from 'react';
import { DESTINATION_PRESETS } from '../lib/types';

interface Props {
  open: boolean;
  destinations: string[]; // 서버 분석 완료된 목적지
  activeDestination: string;
  analyzing: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}

export default function DestinationSheet({
  open,
  destinations,
  activeDestination,
  analyzing,
  onClose,
  onSelect,
}: Props) {
  const [custom, setCustom] = useState('');

  if (!open) return null;

  const isServerAnalyzed = (preset: string) =>
    destinations.some((d) => d.includes(preset));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>목적지 변경</h2>
        <p style={{ fontSize: 13, color: '#6b6b70', margin: '0 0 8px' }}>
          서버에서 분석된 목적지는 바로 적용돼요. 그 외는 서버 분석을 요청해요 (수 분 소요).
        </p>
        {DESTINATION_PRESETS.map((preset) => (
          <div key={preset} className="preset-row" onClick={() => !analyzing && onSelect(preset)}>
            <span>
              {activeDestination.includes(preset) ? '✓ ' : ''}
              {preset}
              {isServerAnalyzed(preset) && <span className="badge-server">서버</span>}
            </span>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <input
            className="text-input"
            placeholder="직접 입력 (예: 2호선 강남역)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={!custom.trim() || analyzing}
            onClick={() => onSelect(custom.trim())}
          >
            {analyzing ? '서버에서 분석 중...' : '이 목적지로 변경'}
          </button>
        </div>
        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
