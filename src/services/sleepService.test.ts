// sleepService 與 python/sleep_quality.py 的「對拍」測試。
// 讀同一份 fixture（tests/fixtures/synthetic_night.jsonl），結果須等於由權威 Python
// 產生的 expected_sleep_report.json，確保 TS 與 Python 數字一致（全域規則 3 / 4）。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { analyzeRecordingText } from './sleepService';

const ROOT = process.cwd();
const FIXTURE = readFileSync(resolve(ROOT, 'tests/fixtures/synthetic_night.jsonl'), 'utf-8');
const EXPECTED = JSON.parse(
  readFileSync(resolve(ROOT, 'tests/fixtures/expected_sleep_report.json'), 'utf-8'),
) as Record<string, unknown>;

// 遞迴比對：數字容差 1e-6（吸收浮點/加總順序的最末位差異）、字串/null/布林精確、
// 物件鍵集合需完全一致。
function assertClose(actual: unknown, expected: unknown, path = 'root'): void {
  if (typeof expected === 'number') {
    expect(typeof actual, `${path} 型別`).toBe('number');
    expect(Math.abs((actual as number) - expected), `${path}: ${actual} vs ${expected}`)
      .toBeLessThan(1e-6);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `${path} 應為陣列`).toBe(true);
    const a = actual as unknown[];
    expect(a.length, `${path} 長度`).toBe(expected.length);
    expected.forEach((v, i) => assertClose(a[i], v, `${path}[${i}]`));
  } else if (expected !== null && typeof expected === 'object') {
    expect(actual !== null && typeof actual === 'object', `${path} 應為物件`).toBe(true);
    const eObj = expected as Record<string, unknown>;
    const aObj = actual as Record<string, unknown>;
    expect(Object.keys(aObj).sort(), `${path} 鍵集合`).toEqual(Object.keys(eObj).sort());
    for (const k of Object.keys(eObj)) assertClose(aObj[k], eObj[k], `${path}.${k}`);
  } else {
    expect(actual, path).toBe(expected);
  }
}

describe('sleepService TS↔Python 對拍', () => {
  it('共用 fixture 的睡眠報告與 expected_sleep_report.json 完全一致', () => {
    const report = analyzeRecordingText(FIXTURE);
    assertClose(report as unknown, EXPECTED);
  });

  it('資料時長不足 → confidence low + null 欄位 + reason（不捏造）', () => {
    const report = analyzeRecordingText(
      '{"ts":"2026-01-01T22:00:00Z","score":2}\n{"ts":"2026-01-01T22:05:00Z","score":2}\n',
    );
    expect(report.confidence).toBe('low');
    expect(report.sleep_onset).toBeNull();
    expect(report.sleep_score).toBeNull();
    expect(report.reason).not.toBeNull();
  });

  it('壞行會被略過，不影響解析', () => {
    const report = analyzeRecordingText(
      '{"ts":"2026-01-01T22:00:00Z","score":2}\nNOT JSON\n{"bad":true}\n{"ts":"2026-01-01T22:05:00Z","score":2}\n',
    );
    // 仍判定為時長不足（只有 5 分鐘），但不應丟例外
    expect(report.confidence).toBe('low');
  });
});
