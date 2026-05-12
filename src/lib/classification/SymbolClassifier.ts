// src/lib/classification/SymbolClassifier.ts
import type { ExtractedSymbol, SymbolCluster, UniqueSymbol, SymbolFeatures } from '@/types';

export class SymbolClassifier {
  static compareSymbols(symbol1: ExtractedSymbol, symbol2: ExtractedSymbol): number {
    const distance = this.calculateFeatureDistance(
      symbol1.features,
      symbol2.features
    );
    const similarity = 1 / (1 + distance);
    return similarity;
  }

  private static calculateFeatureDistance(
    features1: SymbolFeatures,
    features2: SymbolFeatures
  ): number {
    let distance = 0;

    const maxArea = Math.max(features1.area, features2.area);
    const areaDist = Math.abs(features1.area - features2.area) / maxArea;
    distance += areaDist * 0.2;

    const aspectDist = Math.abs(features1.aspectRatio - features2.aspectRatio);
    distance += aspectDist * 0.3;

    let momentsDist = 0;
    for (let i = 0; i < 7; i++) {
      const m1 = features1.moments[i];
      const m2 = features2.moments[i];
      const logM1 = Math.sign(m1) * Math.log10(Math.abs(m1) + 1);
      const logM2 = Math.sign(m2) * Math.log10(Math.abs(m2) + 1);
      momentsDist += Math.abs(logM1 - logM2);
    }
    distance += (momentsDist / 7) * 0.5;

    return distance;
  }

  static clusterSymbols(
    symbols: ExtractedSymbol[],
    threshold: number = 0.85
  ): SymbolCluster[] {
    const clusters: SymbolCluster[] = [];
    const assigned = new Set<string>();

    for (const symbol of symbols) {
      if (assigned.has(symbol.id)) continue;

      const cluster: SymbolCluster = {
        id: `cluster_${clusters.length}`,
        representativeSymbol: symbol,
        members: [symbol],
        avgFeatures: { ...symbol.features },
        count: 1,
      };

      assigned.add(symbol.id);

      for (const otherSymbol of symbols) {
        if (assigned.has(otherSymbol.id)) continue;

        const similarity = this.compareSymbols(symbol, otherSymbol);

        if (similarity >= threshold) {
          cluster.members.push(otherSymbol);
          cluster.count++;
          assigned.add(otherSymbol.id);
        }
      }

      this.updateAverageFeatures(cluster);
      clusters.push(cluster);
    }

    return clusters;
  }

  static identifyUniqueSymbols(
    symbols: ExtractedSymbol[],
    threshold: number = 0.85
  ): UniqueSymbol[] {
    const clusters = this.clusterSymbols(symbols, threshold);

    const uniqueSymbols: UniqueSymbol[] = clusters.map((cluster, index) => ({
      symbolId: `symbol_${index}`,
      representative: cluster.representativeSymbol,
      occurrences: cluster.members.flatMap((m) => m.positions),
    }));

    uniqueSymbols.sort((a, b) => b.occurrences.length - a.occurrences.length);

    return uniqueSymbols;
  }

  private static updateAverageFeatures(cluster: SymbolCluster): void {
    const count = cluster.members.length;
    let totalArea = 0;
    let totalAspect = 0;
    const momentsSums = new Array(7).fill(0);

    for (const member of cluster.members) {
      totalArea += member.features.area;
      totalAspect += member.features.aspectRatio;
      for (let i = 0; i < 7; i++) {
        momentsSums[i] += member.features.moments[i];
      }
    }

    cluster.avgFeatures = {
      area: totalArea / count,
      aspectRatio: totalAspect / count,
      moments: momentsSums.map((sum) => sum / count),
    };
  }

  static splitCluster(
    uniqueSymbols: UniqueSymbol[],
    symbolId: string,
    _newThreshold: number
  ): UniqueSymbol[] {
    const targetSymbol = uniqueSymbols.find((s) => s.symbolId === symbolId);
    if (!targetSymbol) return uniqueSymbols;
    return uniqueSymbols;
  }

  static mergeClusters(
    uniqueSymbols: UniqueSymbol[],
    symbolId1: string,
    symbolId2: string
  ): UniqueSymbol[] {
    const index1 = uniqueSymbols.findIndex((s) => s.symbolId === symbolId1);
    const index2 = uniqueSymbols.findIndex((s) => s.symbolId === symbolId2);

    if (index1 === -1 || index2 === -1) return uniqueSymbols;

    const merged: UniqueSymbol = {
      symbolId: symbolId1,
      representative: uniqueSymbols[index1].representative,
      occurrences: [
        ...uniqueSymbols[index1].occurrences,
        ...uniqueSymbols[index2].occurrences,
      ],
    };

    const result = [...uniqueSymbols];
    result[index1] = merged;
    result.splice(index2, 1);

    return result;
  }

  static calculateFrequencyStats(symbols: UniqueSymbol[]): {
    symbolId: string;
    count: number;
    percentage: number;
  }[] {
    const total = symbols.reduce((sum, s) => sum + s.occurrences.length, 0);

    return symbols.map((s) => ({
      symbolId: s.symbolId,
      count: s.occurrences.length,
      percentage: (s.occurrences.length / total) * 100,
    }));
  }
}
