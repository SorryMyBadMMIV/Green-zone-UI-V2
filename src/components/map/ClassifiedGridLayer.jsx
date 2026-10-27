import { useMemo } from 'react';
import { COLORS } from '../../lib/constants.js';
import { CLASS } from '../../lib/grid.js';
import { hexToRgb, paintClasses } from '../../lib/raster.js';
import FrameImageLayer from './FrameImageLayer.jsx';

const ALPHA = 120; // ≈47% opacity
const PALETTE = [];
PALETTE[CLASS.unknown] = [0, 0, 0, 0];
PALETTE[CLASS.water] = [0, 0, 0, 0]; // not drawn: the basemap already shows the water
PALETTE[CLASS.grey] = [...hexToRgb(COLORS.gridGrey), ALPHA];
PALETTE[CLASS.green] = [...hexToRgb(COLORS.gridGreen), ALPHA];

/** The classified grid of a frame (green / grey cells), drawn from a one-pixel-per-cell image. */
export default function ClassifiedGridLayer({ frame, classified, pane }) {
  const canvas = useMemo(() => {
    const image = document.createElement('canvas');
    image.width = classified.cols;
    image.height = classified.rows;
    image.getContext('2d').putImageData(new ImageData(paintClasses(classified, PALETTE), classified.cols, classified.rows), 0, 0);
    return image;
  }, [classified]);
  return <FrameImageLayer corners={frame.corners} source={canvas} pane={pane} />;
}
