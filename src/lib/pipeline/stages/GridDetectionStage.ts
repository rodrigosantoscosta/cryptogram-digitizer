import type { PipelineStage, PipelineContext } from '../types';
import type { OpenCVAdapter } from '../adapters/OpenCVAdapter';
import { TableDetector } from '@/lib/image-processing/TableDetector';
import type { GridResult, TableStructure, Point } from '@/types/image';

function gridResultToTableStructure(grid: GridResult): TableStructure {
  const gridPoints: Point[][] = grid.rowPositions.map(y =>
    grid.colPositions.map(x => ({ x, y }))
  );

  const sortedWidths = [...grid.colWidths].sort((a, b) => a - b);
  const medianWidth = sortedWidths[Math.floor(sortedWidths.length / 2)] ?? 50;
  const sortedHeights = [...grid.rowHeights].sort((a, b) => a - b);
  const medianHeight = sortedHeights[Math.floor(sortedHeights.length / 2)] ?? 50;

  return {
    rows: grid.rows,
    cols: grid.cols,
    cellWidth: medianWidth,
    cellHeight: medianHeight,
    gridPoints,
    clueColumnWidth: grid.colWidths[0] ?? medianWidth,
    answerColumnWidth: grid.colWidths.length > 1
      ? ([...grid.colWidths.slice(1)].sort((a, b) => a - b)[Math.floor((grid.colWidths.length - 1) / 2)] ?? medianWidth)
      : medianWidth,
  };
}

function tableStructureToGridResult(ts: TableStructure): GridResult {
  const rowPositions = ts.gridPoints.map(row => row[0].y);
  const colPositions = ts.gridPoints[0].map(pt => pt.x);

  const colWidths: number[] = [];
  for (let c = 0; c < ts.cols; c++) {
    colWidths.push(colPositions[c + 1] - colPositions[c]);
  }

  const rowHeights: number[] = [];
  for (let r = 0; r < ts.rows; r++) {
    rowHeights.push(rowPositions[r + 1] - rowPositions[r]);
  }

  const roi = {
    x: colPositions[0],
    y: rowPositions[0],
    width: colPositions[ts.cols] - colPositions[0],
    height: rowPositions[ts.rows] - rowPositions[0],
  };

  return {
    roi,
    rowPositions,
    colPositions,
    colWidths,
    rowHeights,
    rows: ts.rows,
    cols: ts.cols,
  };
}

export class GridDetectionStage implements PipelineStage {
  readonly name = 'gridDetection' as const;

  constructor(private readonly cvAdapter: OpenCVAdapter) {}

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    let grid: GridResult;
    let tableStructure: TableStructure;
    let usedFallback = false;

    try {
      grid = this.cvAdapter.detectGrid(ctx.imageData);
      tableStructure = gridResultToTableStructure(grid);
    } catch {
      usedFallback = true;
      tableStructure = await TableDetector.detectTableStructure(ctx.imageData);
      grid = tableStructureToGridResult(tableStructure);
    }

    return { ...ctx, grid, tableStructure, usedFallback };
  }
}

export { gridResultToTableStructure, tableStructureToGridResult };
