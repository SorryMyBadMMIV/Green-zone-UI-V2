import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PlotInfoBox from './PlotInfoBox.jsx';

const plot = { id: 'SL-001', areaM2: 350, isExample: true };
const analysis = {
  point: [100.64, 13.73],
  nearestPark: { id: 'park-1', name: 'สวนศรีพัฒน์ภิรมย์', distanceM: 1234 },
  circlesCovering: 0,
  withinPolicy: false,
  score: 82,
  level: { key: 'very-good', label: 'Very good for planting' },
  recommended: true,
};

describe('PlotInfoBox', () => {
  it('shows area, score, level, nearest park, the recommendation and the example tag', () => {
    render(<PlotInfoBox plot={plot} analysis={analysis} onClose={() => {}} />);
    expect(screen.getByText('Area : 350 m²')).toBeTruthy();
    expect(screen.getByText('Score : 82')).toBeTruthy();
    expect(screen.getByText('Very good for planting')).toBeTruthy();
    expect(screen.getByText('Nearest park : 1.2 km · สวนศรีพัฒน์ภิรมย์')).toBeTruthy();
    expect(screen.getByText('★ Recommended')).toBeTruthy();
    expect(screen.getByText('Example data')).toBeTruthy();
  });

  it('shows a dash when there is no park nearby and no recommendation line when not recommended', () => {
    render(<PlotInfoBox plot={{ ...plot, isExample: false }} analysis={{ ...analysis, nearestPark: null, recommended: false }} onClose={() => {}} />);
    expect(screen.getByText('Nearest park : —')).toBeTruthy();
    expect(screen.queryByText('★ Recommended')).toBeNull();
    expect(screen.queryByText('Example data')).toBeNull();
  });

  it('closes from the close button', () => {
    const onClose = vi.fn();
    render(<PlotInfoBox plot={plot} analysis={analysis} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close plot info' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
