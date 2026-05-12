/**
 * SymbolClassifier - Classificação e Agrupamento de Símbolos
 *
 * Agrupa símbolos similares usando características visuais (Hu Moments)
 * e análise de frequência.
 */

import type {
  ExtractedSymbol,
  SymbolFeatures,
  CellPosition
} from '../../types/image';

export interface SymbolCluster {
  id: string;
  representativeSymbol: ExtractedSymbol;
  members: ExtractedSymbol[];
  avgFeatures: SymbolFeatures;
  count: number;
}

export interface UniqueSymbol {
  clusterId: string;
  symbol: ExtractedSymbol;
  occurrences: CellPosition[];
  mappedLetter: string | null;
}

export class SymbolClassifier {

  /**
   * Compara dois símbolos calculando similaridade (0-1)
   *
   * @param symbol1 - Primeiro símbolo
   * @param symbol2 - Segundo símbolo
   * @returns Similaridade (0 = diferente, 1 = idêntico)
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
   *
   * Fix: Os Hu Moments armazenados em `features.moments` já são
   * log-normalizados em `SymbolExtractor.extractFeatures`. A aplicação
   * anterior de log10 novamente aqui era uma dupla normalização que
   * distorcia a distância calculada. Agora usamos os valores diretamente.
   *
   * Pesos:
   *  - Área: 20%
   *  - Aspect Ratio: 30%
   *  - Hu Moments: 50% (mais importante)
   *
   * @param features1 - Características do primeiro símbolo
   * @param features2 - Características do segundo símbolo
   * @returns Distância normalizada (0 = idêntico, >0 = diferente)
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
    //    Fix: os momentos já estão log-normalizados — NÃO aplicar log novamente.
    let momentsDist = 0;
    for (let i = 0; i < 7; i++) {
      momentsDist += Math.abs(features1.moments[i] - features2.moments[i]);
    }
    distance += (momentsDist / 7) * 0.5;

    return distance;
  }

  /**
   * Agrupa símbolos similares em clusters com refinamento via Lloyd's step.
   *
   * Algoritmo:
   *  1. Greedy clustering: cada símbolo não atribuído inicia um cluster e
   *     absorve os vizinhos similares (threshold de similaridade).
   *  2. Lloyd's re-assignment: cada símbolo é re-atribuído ao cluster cujo
   *     centróide (avgFeatures) é mais próximo. Uma iteração é suficiente
   *     para corrigir os erros do representante greedy.
   *
   * @param symbols - Array de símbolos extraídos
   * @param threshold - Threshold de similaridade (0-1, padrão: 0.85)
   * @returns Array de clusters
   */
  static clusterSymbols(
    symbols: ExtractedSymbol[],
    threshold: number = 0.85
  ): SymbolCluster[] {
    if (symbols.length === 0) return [];

    console.log(`[SymbolClassifier] Agrupando ${symbols.length} símbolos (threshold: ${threshold})...`);

    // --- Fase 1: Greedy clustering inicial ---
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

    // --- Fase 2: Lloyd's re-assignment (uma iteração) ---
    // Cada símbolo é re-atribuído ao cluster mais próximo pelo centróide.
    // Isso corrige erros causados por representantes greedy não representativos.
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

    // Remover clusters vazios e atualizar centróides
    const finalClusters = reassigned
      .filter(c => c.count > 0)
      .map((c, idx) => {
        // Eleger novo representante: o membro mais próximo do centróide
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
          id: `cluster_${idx}`,
          representativeSymbol: bestMember,
          members: c.members,
          avgFeatures: clusters[0].avgFeatures, // placeholder
          count: c.count
        };
        this.updateAverageFeatures(cluster);
        return cluster;
      });

    console.log(`[SymbolClassifier] ✓ ${finalClusters.length} clusters (após Lloyd's re-assignment)`);

    const sorted = [...finalClusters].sort((a, b) => b.count - a.count);
    console.log('[SymbolClassifier] Top 5 clusters:');
    for (let i = 0; i < Math.min(5, sorted.length); i++) {
      console.log(`  ${sorted[i].id}: ${sorted[i].count} ocorrências`);
    }

    return finalClusters;
  }

  /**
   * Atualiza características médias de um cluster
   */
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

      if (
        cluster.avgFeatures.extent !== undefined &&
        member.features.extent !== undefined
      ) {
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
   *
   * @param symbols - Array de símbolos extraídos
   * @param threshold - Threshold de clustering (padrão: 0.85)
   * @returns Array de símbolos únicos ordenados por frequência
   */
  static identifyUniqueSymbols(
    symbols: ExtractedSymbol[],
    threshold: number = 0.85
  ): UniqueSymbol[] {
    const clusters = this.clusterSymbols(symbols, threshold);

    const uniqueSymbols: UniqueSymbol[] = clusters.map(cluster => ({
      clusterId: cluster.id,
      symbol: cluster.representativeSymbol,
      occurrences: cluster.members.flatMap(m => m.positions),
      mappedLetter: null
    }));

    uniqueSymbols.sort((a, b) => b.occurrences.length - a.occurrences.length);

    console.log('[SymbolClassifier] Símbolos únicos identificados:');
    uniqueSymbols.forEach((symbol, index) => {
      console.log(`  ${index + 1}. ${symbol.clusterId}: ${symbol.occurrences.length} ocorrências`);
    });

    return uniqueSymbols;
  }

  /**
   * Calcula estatísticas de frequência dos símbolos
   */
  static calculateFrequencyStats(symbols: UniqueSymbol[]): {
    total: number;
    frequencies: Map<string, number>;
    percentages: Map<string, number>;
  } {
    const total = symbols.reduce((sum, s) => sum + s.occurrences.length, 0);
    const frequencies = new Map<string, number>();
    const percentages = new Map<string, number>();

    for (const symbol of symbols) {
      const count = symbol.occurrences.length;
      frequencies.set(symbol.clusterId, count);
      percentages.set(symbol.clusterId, (count / total) * 100);
    }

    return { total, frequencies, percentages };
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
          id: `${uniqueSymbol.clusterId}_${position.row}_${position.col}`,
          imageData: uniqueSymbol.symbol.imageData,
          features: uniqueSymbol.symbol.features,
          positions: [position],
          hash: uniqueSymbol.symbol.hash
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
    clusterId1: string,
    clusterId2: string
  ): UniqueSymbol[] {
    const cluster1 = symbols.find(s => s.clusterId === clusterId1);
    const cluster2 = symbols.find(s => s.clusterId === clusterId2);

    if (!cluster1 || !cluster2) {
      throw new Error('Clusters não encontrados');
    }

    const mergedCluster: UniqueSymbol = {
      clusterId: `${clusterId1}_merged`,
      symbol: cluster1.symbol,
      occurrences: [...cluster1.occurrences, ...cluster2.occurrences],
      mappedLetter: cluster1.mappedLetter || cluster2.mappedLetter
    };

    return [
      ...symbols.filter(
        s => s.clusterId !== clusterId1 && s.clusterId !== clusterId2
      ),
      mergedCluster
    ];
  }

  /**
   * Divide um cluster em dois baseado em sub-características
   */
  static splitCluster(
    symbols: UniqueSymbol[],
    clusterId: string,
    subThreshold: number = 0.75
  ): UniqueSymbol[] {
    const cluster = symbols.find(s => s.clusterId === clusterId);

    if (!cluster) {
      throw new Error('Cluster não encontrado');
    }

    if (cluster.occurrences.length < 2) {
      console.warn('[SymbolClassifier] Cluster muito pequeno para dividir');
      return symbols;
    }

    const individualSymbols: ExtractedSymbol[] = cluster.occurrences.map(
      (pos, i) => ({
        id: `${clusterId}_${i}`,
        imageData: cluster.symbol.imageData,
        features: cluster.symbol.features,
        positions: [pos],
        hash: cluster.symbol.hash
      })
    );

    const newClusters = this.clusterSymbols(individualSymbols, subThreshold);

    const newUniqueSymbols: UniqueSymbol[] = newClusters.map((c, i) => ({
      clusterId: `${clusterId}_split_${i}`,
      symbol: c.representativeSymbol,
      occurrences: c.members.flatMap(m => m.positions),
      mappedLetter: cluster.mappedLetter
    }));

    return [
      ...symbols.filter(s => s.clusterId !== clusterId),
      ...newUniqueSymbols
    ];
  }
}
