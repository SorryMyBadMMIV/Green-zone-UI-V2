import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GaSiteInfoBox, GreenGroupInfoBox } from './SiteInfoBoxes.jsx';

const site = { id: 'r0_c0-1', zone: 'r0_c0', rank: 1, areaM2: 25991.5, distNearestOfficialM: 2287.7, zoneFitness: 1.4472, zoneKMax: 2 };
const group = { id: '1', kind: 'group', radiusM: 381, patchesInGroup: 34, patchesInCircle: 39, greenM2InGroup: 46489.8, greenM2InCircle: 53648.8 };

describe('GaSiteInfoBox', () => {
  it('shows the area, the rank in its 1 km square, the nearest official park and the candidate tag', () => {
    render(<GaSiteInfoBox site={site} sitesInSquare={2} onClose={() => {}} />);
    expect(screen.getByText('Area : 25,992 m²')).toBeTruthy();
    expect(screen.getByText('Rank : 1 of 2 in its 1 km square')).toBeTruthy();
    expect(screen.getByText('Nearest official park : 2.3 km')).toBeTruthy();
    expect(screen.getByText('Candidate · not verified public land')).toBeTruthy();
  });

  it('closes from its × button', () => {
    const onClose = vi.fn();
    render(<GaSiteInfoBox site={site} sitesInSquare={2} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close site info' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('GreenGroupInfoBox', () => {
  it('shows the green, the patches and the circle size', () => {
    render(<GreenGroupInfoBox group={group} onClose={() => {}} />);
    expect(screen.getByText('Green : 46,490 m²')).toBeTruthy();
    expect(screen.getByText('Patches : 34')).toBeTruthy();
    expect(screen.getByText('Circle : 381 m radius')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Green group 1' })).toBeTruthy();
  });

  it('names an isolated circle and closes from its × button', () => {
    const onClose = vi.fn();
    render(<GreenGroupInfoBox group={{ ...group, id: '171', kind: 'isolated' }} onClose={onClose} />);
    expect(screen.getByRole('region', { name: 'Isolated green 171' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close group info' }));
    expect(onClose).toHaveBeenCalled();
  });
});
