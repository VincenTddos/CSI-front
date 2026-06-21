import { describe, expect, it } from 'vitest';
import { recommendSensitivity } from './feedback';

describe('recommendSensitivity', () => {
  it('誤報率高（已處理≥2 且≥50%）→ 調低', () => {
    expect(recommendSensitivity(0, 3).rec).toBe('lower'); // 3 件全誤報
    expect(recommendSensitivity(1, 3).rec).toBe('lower'); // 75% 誤報
    expect(recommendSensitivity(1, 1).rec).toBe('lower'); // 剛好 50%、已處理 2
  });
  it('皆確認且零誤報（≥2）→ 略升', () => {
    expect(recommendSensitivity(2, 0).rec).toBe('raise');
    expect(recommendSensitivity(3, 0).rec).toBe('raise');
  });
  it('資料不足或誤報率合理 → 維持', () => {
    expect(recommendSensitivity(0, 0).rec).toBe('keep'); // 無資料
    expect(recommendSensitivity(1, 0).rec).toBe('keep'); // 只有 1 件確認
    expect(recommendSensitivity(2, 1).rec).toBe('keep'); // 33% 誤報
  });
});
