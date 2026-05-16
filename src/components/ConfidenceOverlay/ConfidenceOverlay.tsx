/**
 * ConfidenceOverlay — Visual confidence feedback for OCR results
 * 
 * Color-codes cells by confidence level:
 * - Green: ≥80% confidence (high)
 * - Yellow: 50-79% confidence (medium)
 * - Red: <50% confidence (low)
 * 
 * Hover tooltip shows:
 * - Recognized number
 * - Confidence percentage
 * - Whether it was OCR or template matched
 */

import React, { useState } from 'react';

export interface CellConfidence {
  row: number;
  col: number;
  number: number | null;
  confidence: number;
  rawOcr: string;
}

interface ConfidenceOverlayProps {
  cells: CellConfidence[];
  gridRows: number;
  gridCols: number;
  gridWidth: number;
  gridHeight: number;
  offsetX: number;
  offsetY: number;
  visible: boolean;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'rgba(34, 197, 94, 0.3)'; // Green
  if (confidence >= 50) return 'rgba(234, 179, 8, 0.4)'; // Yellow
  return 'rgba(239, 68, 68, 0.5)'; // Red
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'High';
  if (confidence >= 50) return 'Medium';
  return 'Low';
}

export const ConfidenceOverlay: React.FC<ConfidenceOverlayProps> = ({
  cells,
  gridRows,
  gridCols,
  gridWidth,
  gridHeight,
  offsetX,
  offsetY,
  visible,
}) => {
  const [hoveredCell, setHoveredCell] = useState<CellConfidence | null>(null);

  if (!visible) return null;

  const cellWidth = gridWidth / gridCols;
  const cellHeight = gridHeight / gridRows;

  return (
    <>
      {/* Cell overlays */}
      {cells.map((cell) => {
        const x = offsetX + cell.col * cellWidth;
        const y = offsetY + cell.row * cellHeight;
        
        return (
          <div
            key={`${cell.row}-${cell.col}`}
            style={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${cellWidth}px`,
              height: `${cellHeight}px`,
              backgroundColor: getConfidenceColor(cell.confidence),
              border: cell.confidence < 50 ? '1px solid rgba(239, 68, 68, 0.8)' : 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={() => setHoveredCell(cell)}
            onMouseLeave={() => setHoveredCell(null)}
          />
        );
      })}

      {/* Tooltip */}
      {hoveredCell && (
        <div
          style={{
            position: 'absolute',
            left: `${offsetX + hoveredCell.col * cellWidth + cellWidth / 2}px`,
            top: `${offsetY + hoveredCell.row * cellHeight - 10}px`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            Cell ({hoveredCell.row},{hoveredCell.col}): {hoveredCell.number ?? 'null'}
          </div>
          <div>
            Confidence: <span style={{ 
              color: hoveredCell.confidence >= 80 ? '#22c55e' : 
                     hoveredCell.confidence >= 50 ? '#eab308' : '#ef4444' 
            }}>
              {Math.round(hoveredCell.confidence)}% ({getConfidenceLabel(hoveredCell.confidence)})
            </span>
          </div>
          <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
            Raw: "{hoveredCell.rawOcr}"
          </div>
        </div>
      )}
    </>
  );
};

// Legend component
export const ConfidenceLegend: React.FC = () => (
  <div style={{
    display: 'flex',
    gap: '16px',
    padding: '8px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#fff',
    alignItems: 'center',
  }}>
    <span style={{ fontWeight: 'bold' }}>Confidence:</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(34, 197, 94, 0.6)', borderRadius: '2px' }} />
      <span>High (≥80%)</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(234, 179, 8, 0.6)', borderRadius: '2px' }} />
      <span>Medium (50-79%)</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(239, 68, 68, 0.7)', borderRadius: '2px' }} />
      <span>{'Low (<50%)'}</span>
    </div>
  </div>
);
