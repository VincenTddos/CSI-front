import { describe, expect, it } from 'vitest';
import type { Patient } from '../types';
import type { FallEventRow } from './database.types';
import { computeResidentRisk, rankResidentsByRisk } from './riskService';

function patient(over: Partial<Patient> = {}): Patient {
  return {
    id: 'p1', name: 'A', gender: '男', birthDate: '1950/01/01', age: 76,
    roomNumber: '101', contactName: '', contactPhone: '',
    medications: [], medicalHistory: [], notes: '', ...over,
  };
}
function alert(over: Partial<FallEventRow> = {}): FallEventRow {
  return {
    id: Math.random().toString(36).slice(2), device_id: null, resident_id: 'p1',
    movement_score: 90, location_x: null, location_y: null, event_type: '跌倒風險',
    confidence: 90, status: 'confirmed', feedback_note: null, acknowledged_by: null,
    detected_at: new Date().toISOString(), ...over,
  };
}

describe('computeResidentRisk', () => {
  it('無事件 + 健康年輕 → 低風險', () => {
    const r = computeResidentRisk(patient({ age: 70, medicalHistory: [] }), []);
    expect(r.level).toBe('低');
    expect(r.score).toBeLessThan(30);
  });
  it('近期確認跌倒 → 風險升至中以上', () => {
    const r = computeResidentRisk(patient(), [alert({ status: 'confirmed' })]);
    expect(r.confirmedFalls).toBe(1);
    expect(r.score).toBeGreaterThanOrEqual(30);
  });
  it('誤報不計入確認跌倒', () => {
    const r = computeResidentRisk(patient(), [alert({ status: 'false_alarm' })]);
    expect(r.confirmedFalls).toBe(0);
    expect(r.falseAlarms).toBe(1);
  });
  it('14 天前的事件不納入近期統計', () => {
    const old = new Date(Date.now() - 20 * 86400000).toISOString();
    const r = computeResidentRisk(patient(), [alert({ status: 'confirmed', detected_at: old })]);
    expect(r.confirmedFalls).toBe(0);
  });
});

describe('rankResidentsByRisk', () => {
  it('依分數由高到低排序', () => {
    const high = patient({ id: 'h', age: 85, medicalHistory: ['心臟病', '高血壓'] });
    const low = patient({ id: 'l', age: 68, medicalHistory: [] });
    const alerts = [
      alert({ resident_id: 'h', status: 'confirmed' }),
      alert({ resident_id: 'h', status: 'confirmed' }),
    ];
    const ranked = rankResidentsByRisk([low, high], alerts);
    expect(ranked[0].resident.id).toBe('h');
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });
});
