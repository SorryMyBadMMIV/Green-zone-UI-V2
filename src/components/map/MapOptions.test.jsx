import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MapOptions, { DEFAULT_OPTIONS } from './MapOptions.jsx';
import { DISTRICTS, getDistrict } from '../../data/districts.js';

const renderOptions = (props = {}) => {
  const handlers = { onDistrictChange: vi.fn(), onOptionChange: vi.fn(), onCollapsedChange: vi.fn() };
  render(
    <MapOptions
      district={getDistrict('suan-luang')}
      districts={DISTRICTS}
      options={DEFAULT_OPTIONS}
      collapsed={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

describe('MapOptions', () => {
  it('switches district from the drop-down', () => {
    const { onDistrictChange } = renderOptions();
    fireEvent.change(screen.getByLabelText('District'), { target: { value: 'don-mueang' } });
    expect(onDistrictChange).toHaveBeenCalledWith('don-mueang');
  });

  it('turns a park size class off', () => {
    const { onOptionChange } = renderOptions();
    fireEvent.click(screen.getByLabelText('S · 500 m'));
    expect(onOptionChange).toHaveBeenCalledWith('S', false);
  });

  it('turns Policy and the heat map on', () => {
    const { onOptionChange } = renderOptions();
    fireEvent.click(screen.getByLabelText('Policy · 400 m'));
    fireEvent.click(screen.getByLabelText('Heat map'));
    expect(onOptionChange).toHaveBeenCalledWith('policy', true);
    expect(onOptionChange).toHaveBeenCalledWith('heatmap', true);
  });

  it('offers the green/grey grid only where the district has one', () => {
    renderOptions();
    expect(screen.queryByLabelText('Green/grey grid')).toBeNull();
    screen.getByLabelText('Recommend'); // still there
  });

  it('shows the green/grey grid switch for Don Mueang', () => {
    renderOptions({ district: getDistrict('don-mueang') });
    expect(screen.getByLabelText('Green/grey grid')).toBeTruthy();
  });

  it('switches the base map to the street map', () => {
    const { onOptionChange } = renderOptions();
    fireEvent.change(screen.getByLabelText('Base map'), { target: { value: 'street' } });
    expect(onOptionChange).toHaveBeenCalledWith('basemap', 'street');
  });

  it('minimizes from the – button', () => {
    const { onCollapsedChange } = renderOptions();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize map options' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it('shows only a pill with the district when minimized, and opens again from it', () => {
    const { onCollapsedChange } = renderOptions({ collapsed: true });
    expect(screen.queryByLabelText('District')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '⚙ Map options · Suan Luang' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });
});
