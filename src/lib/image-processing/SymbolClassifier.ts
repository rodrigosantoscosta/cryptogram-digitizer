/**
 * SymbolClassifier - Classificação e Agrupamento de Símbolos
 *
 * Agrupa símbolos similares usando características visuais (Hu Moments)
 * e análise de frequência.
 */

import type {
  ExtractedSymbol,
  SymbolFeatures,
  CellPosition,
  UniqueSymbol,
  SymbolCluster
} from '@/types/symbol';
import type { CellNumberMap } from '@/lib/ocr/CellNumberReader';

export class SymbolClassifier {

  /**
   * Compara dois símbolos calculando similaridade (0-1)
   */
  static compareSymbols(
    symbol1: ExtractedSymbol,
    symbol2: ExtractedSymbol
  ): number {
    const distance = this.calculateFeatureDistance(
      symbol1.features,
      symbol2.features
    );

    return 1 / (1 + distance);
  }

  /**
   * Calcula distância entre características de dois símbolos.
   */
  static calculateFeatureDistance(
    features1: SymbolFeatures,
    features2: SymbolFeatures
  ): number {
    let distance = 0;

    // 1. Distância de área (peso: 0.2)
    const maxArea = Math.max(features1.area, features2.area);
    if (maxArea > 0) {
      const areaDist = Math.abs(features1.area - features2.area) / maxArea;
      distance += areaDist * 0.2;
    }

    // 2. Distância de aspect ratio (peso: 0.3)
    const aspectDist = Math.abs(features1.aspectRatio - features2.aspectRatio);
    distance += aspectDist * 0.3;

    // 3. Distância de Hu Moments (peso: 0.5)
    let momentsDist = 0;
    for (let i = 0; i < 7; i++) {
      momentsDist += Math.abs(features1.moments[i] - features2.moments[i]);
    }
    distance += (momentsDist / 7) * 0.5;

    return distance;
  }

  /**
   * Agrupa símbolos similares em clusters com refinamento via Lloyd's step.
   */
  static clusterSymbols(
    symbols: ExtractedSymbol[],
    threshold: number = 0.85
  ): SymbolCluster[] {
    if (symbols.length === 0) return [];

    console.log(`[SymbolClassifier] Agrupando ${symbols.length} símbolos (threshold: ${threshold})...`);

    const clusters: SymbolCluster[] = [];
    const assigned = new Set<string>();

    for (const symbol of symbols) {
      if (assigned.has(symbol.id)) continue;

      const cluster: SymbolCluster = {
        id: `cluster_${clusters.length}`,
        representativeSymbol: symbol,
        members: [symbol],
        avgFeatures: { ...symbol.features },
        count: 1
      };

      assigned.add(symbol.id);

      for (const other of symbols) {
        if (assigned.has(other.id)) continue;

        const similarity = this.compareSymbols(symbol, other);
        if (similarity >= threshold) {
          cluster.members.push(other);
          cluster.count++;
          assigned.add(other.id);
        }
      }

      this.updateAverageFeatures(cluster);
      clusters.push(cluster);
    }

    const reassigned = clusters.map(c => ({
      ...c,
      members: [] as ExtractedSymbol[],
      count: 0
    }));

    for (const symbol of symbols) {
      let bestClusterIdx = 0;
      let bestDist = Infinity;

      for (let i = 0; i < clusters.length; i++) {
        const dist = this.calculateFeatureDistance(
          symbol.features,
          clusters[i].avgFeatures
        );
        if (dist < bestDist) {
          bestDist = dist;
          bestClusterIdx = i;
        }
      }

      reassigned[bestClusterIdx].members.push(symbol);
      reassigned[bestClusterIdx].count++;
    }

    const finalClusters: SymbolCluster[] = [];
    for (let idx = 0; idx < reassigned.length; idx++) {
      const c = reassigned[idx];
      if (c.count > 0) {
        let bestMember = c.members[0];
        let bestDist = Infinity;
        for (const m of c.members) {
          const d = this.calculateFeatureDistance(m.features, clusters[idx < clusters.length ? idx : 0].avgFeatures);
          if (d < bestDist) {
            bestDist = d;
            bestMember = m;
          }
        }
        const cluster: SymbolCluster = {
          id: `cluster_${finalClusters.length}`,
          representativeSymbol: bestMember,
          members: c.members,
          avgFeatures: clusters[0].avgFeatures, // placeholder
          count: c.count
        };
        this.updateAverageFeatures(cluster);
        finalClusters.push(cluster);
      }
    }

    return finalClusters;
  }

  private static updateAverageFeatures(cluster: SymbolCluster): void {
    const count = cluster.members.length;

    cluster.avgFeatures = {
      area: 0,
      perimeter: 0,
      aspectRatio: 0,
      moments: new Array(7).fill(0),
      histogram: new Array(256).fill(0),
      centerOfMass: { x: 0, y: 0 },
      extent: 0
    };

    for (const member of cluster.members) {
      cluster.avgFeatures.area += member.features.area;
      cluster.avgFeatures.perimeter += member.features.perimeter;
      cluster.avgFeatures.aspectRatio += member.features.aspectRatio;

      if (cluster.avgFeatures.extent !== undefined && member.features.extent !== undefined) {
        cluster.avgFeatures.extent += member.features.extent;
      }

      cluster.avgFeatures.centerOfMass.x += member.features.centerOfMass.x;
      cluster.avgFeatures.centerOfMass.y += member.features.centerOfMass.y;

      for (let i = 0; i < 7; i++) {
        cluster.avgFeatures.moments[i] += member.features.moments[i];
      }

      for (let i = 0; i < 256; i++) {
        cluster.avgFeatures.histogram[i] += member.features.histogram[i];
      }
    }

    cluster.avgFeatures.area /= count;
    cluster.avgFeatures.perimeter /= count;
    cluster.avgFeatures.aspectRatio /= count;

    if (cluster.avgFeatures.extent !== undefined) {
      cluster.avgFeatures.extent /= count;
    }

    cluster.avgFeatures.centerOfMass.x /= count;
    cluster.avgFeatures.centerOfMass.y /= count;

    for (let i = 0; i < 7; i++) {
      cluster.avgFeatures.moments[i] /= count;
    }

    for (let i = 0; i < 256; i++) {
      cluster.avgFeatures.histogram[i] /= count;
    }
  }

  /**
   * Identifica símbolos únicos a partir de clusters
   */
  static identifyUniqueSymbols(
    symbols: ExtractedSymbol[],
    threshold: number = 0.85
  ): UniqueSymbol[] {
    const clusters = this.clusterSymbols(symbols, threshold);

    const uniqueSymbols: UniqueSymbol[] = clusters.map(cluster => ({
      symbolId: cluster.id,
      representative: cluster.representativeSymbol,
      occurrences: cluster.members.flatMap(m => m.positions),
      mappedLetter: null
    }));

    uniqueSymbols.sort((a, b) => b.occurrences.length - a.occurrences.length);
    return uniqueSymbols;
  }

  /**
   * Re-agrupa símbolos com threshold diferente
   */
  static recluster(
    symbols: UniqueSymbol[],
    newThreshold: number
  ): UniqueSymbol[] {
    const allSymbols: ExtractedSymbol[] = [];

    for (const uniqueSymbol of symbols) {
      for (const position of uniqueSymbol.occurrences) {
        allSymbols.push({
          id: `${uniqueSymbol.symbolId}_${position.row}_${position.col}`,
          imageData: uniqueSymbol.representative.imageData,
          features: uniqueSymbol.representative.features,
          positions: [position],
          hash: uniqueSymbol.representative.hash
        });
      }
    }

    return this.identifyUniqueSymbols(allSymbols, newThreshold);
  }

  /**
   * Mescla dois clusters manualmente
   */
  static mergeClusters(
    symbols: UniqueSymbol[],
    symbolId1: string,
    symbolId2: string
  ): UniqueSymbol[] {
    const cluster1 = symbols.find(s => s.symbolId === symbolId1);
    const cluster2 = symbols.find(s => s.symbolId === symbolId2);

    if (!cluster1 || !cluster2) {
      throw new Error('Clusters não encontrados');
    }

    const mergedCluster: UniqueSymbol = {
      symbolId: `${symbolId1}_merged`,
      representative: cluster1.representative,
      occurrences: [...cluster1.occurrences, ...cluster2.occurrences],
      mappedLetter: cluster1.mappedLetter || cluster2.mappedLetter
    };

    return [
      ...symbols.filter(
        s => s.symbolId !== symbolId1 && s.symbolId !== symbolId2
      ),
      mergedCluster
    ];
  }

  /**
   * Divide um cluster em dois baseado em sub-características
   */
  static splitCluster(
    symbols: UniqueSymbol[],
    symbolId: string,
    subThreshold: number = 0.75
  ): UniqueSymbol[] {
    const cluster = symbols.find(s => s.symbolId === symbolId);

    if (!cluster) {
      throw new Error('Cluster não encontrado');
    }

    if (cluster.occurrences.length < 2) {
      console.warn('[SymbolClassifier] Cluster muito pequeno para dividir');
      return symbols;
    }

    const individualSymbols: ExtractedSymbol[] = cluster.occurrences.map(
      (pos, i) => ({
        id: `${symbolId}_${i}`,
        imageData: cluster.representative.imageData,
        features: cluster.representative.features,
        positions: [pos],
        hash: cluster.representative.hash
      })
    );

    const newClusters = this.clusterSymbols(individualSymbols, subThreshold);

    const newUniqueSymbols: UniqueSymbol[] = newClusters.map((c, i) => ({
      symbolId: `${symbolId}_split_${i}`,
      representative: c.representativeSymbol,
      occurrences: c.members.flatMap(m => m.positions),
      mappedLetter: cluster.mappedLetter
    }));

    return [
      ...symbols.filter(s => s.symbolId !== symbolId),
      ...newUniqueSymbols
    ];
  }

  // ─── Caminho numérico (criptogramas com números nas células) ───────────

  /**
   * Constrói UniqueSymbol[] diretamente a partir do CellNumberMap.
   *
   * Quando o CellNumberReader detectou números com sucesso, este método
   * substitui completamente o pipeline de clustering visual (pHash + Hu Moments).
   * O symbolId de cada UniqueSymbol é o próprio número como string ("1".."27"),
   * o que torna o mapeamento trivialmente correto e determinístico.
   *
   * O `representative` de cada UniqueSymbol é gerado com ImageData vazio (1×1)
   * porque a UI de mapeamento numérico usa o número diretamente — não a imagem.
   *
   * @param cellNumbers      - Resultado do CellNumberReader
   * @param extractedSymbols - Símbolos visuais extraídos (usados como fonte de
   *   `representative.imageData` quando disponíveis, para exibição na UI)
   */
  static buildFromNumbers(
    cellNumbers: CellNumberMap,
    extractedSymbols: ExtractedSymbol[] = []
  ): UniqueSymbol[] {
    // Construir índice de imageData por posição, para enriquecer o representative
    const imgByPos = new Map<string, ImageData>();
    for (const sym of extractedSymbols) {
      for (const pos of sym.positions) {
        imgByPos.set(`${pos.row}:${pos.col}`, sym.imageData);
      }
    }

    // Construir UniqueSymbol por número único, na ordem numérica
    const sortedKeys = Object.keys(cellNumbers.bySymbol).sort((a, b) => Number(a) - Number(b));

    return sortedKeys.map(numStr => {
      const positions = cellNumbers.bySymbol[numStr];

      // Tentar encontrar ImageData representativa de qualquer ocorrência
      let representativeImageData: ImageData = new ImageData(1, 1);
      const blankFeatures = makeBlankFeatures();

      for (const pos of positions) {
        const img = imgByPos.get(`${pos.row}:${pos.col}`);
        if (img) {
          representativeImageData = img;
          break;
        }
      }

      const representative: ExtractedSymbol = {
        id: numStr,
        imageData: representativeImageData,
        features: blankFeatures,
        positions: positions.map(p => ({ row: p.row, col: p.col })),
        hash: `num_${numStr.padStart(3, '0')}`,
      };

      return {
        symbolId: numStr,
        representative,
        // As posições do CellNumberReader já são baseadas em col real (startCol=1).
        // Não aplicar offset adicional para não deslocar o CellNumberOverlay.
        occurrences: positions.map(p => ({ row: p.row, col: p.col })),
        mappedLetter: null,
      } satisfies UniqueSymbol;
    });
  }
}

// ─── Helpers privados do módulo ─────────────────────────────────────────────────────

function makeBlankFeatures(): import('@/types/symbol').SymbolFeatures {
  return {
    area: 0,
    perimeter: 0,
    aspectRatio: 1,
    moments: new Array(7).fill(0),
    histogram: new Array(256).fill(0),
    centerOfMass: { x: 0, y: 0 },
    extent: 0,
  };
}
