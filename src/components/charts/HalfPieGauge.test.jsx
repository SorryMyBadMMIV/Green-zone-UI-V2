import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HalfPieGauge from './HalfPieGauge.jsx';

describe('HalfPieGauge', () => {
  it('fills the arc in proportion to the value and shows the number', () => {
    render(<HalfPieGauge fraction={0.25} color="#fab219" value="4.5" unit="m² per person" label="Gauge" />);
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('m² per person')).toBeTruthy();
    expect(screen.getByTestId('gauge-fill').getAttribute('stroke-dasharray')).toBe('25 100');
  });

  it('clamps values beyond the end of the scale', () => {
    render(<HalfPieGauge fraction={3} color="#0ca30c" value="54.0" unit="m² per person" label="Gauge" />);
    expect(screen.getByTestId('gauge-fill').getAttribute('stroke-dasharray')).toBe('100 100');
  });

  it('shows "No data" and an empty track when there is no value', () => {
    render(<HalfPieGauge fraction={null} color="#8a8983" value="—" unit="m² per person" label="Gauge" />);
    expect(screen.getByText('No data')).toBeTruthy();
    expect(screen.queryByTestId('gauge-fill')).toBeNull();
  });

  it('draws a labelled target tick', () => {
    render(<HalfPieGauge fraction={0.4} color="#fab219" value="7.49" unit="m²" tick={0.5} tickLabel="target 9" label="Gauge" />);
    expect(screen.getByText('target 9')).toBeTruthy();
  });

  it('uses a second color for the rest of the arc when given (two-part whole)', () => {
    render(<HalfPieGauge fraction={0.33} color="#22c55e" trackColor="#9ca3af" value="33%" unit="green" label="Gauge" />);
    expect(screen.getByTestId('gauge-track').getAttribute('stroke')).toBe('#9ca3af');
    expect(screen.getByTestId('gauge-fill').getAttribute('stroke')).toBe('#22c55e');
  });
});
