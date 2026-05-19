#!/bin/bash
# run_pipeline.sh — Executa o pipeline completo de OCR Híbrido (Fases 2-4)
#
# Pipeline:
#   Fase 2: batch_extract_cells.py    — Extrai células das 43 fotos
#   Fase 3: generate_pseudo_labels.py — Pseudo-labeling via EasyOCR
#   Fase 4: hybrid_dataset.py         — Combina reais + sintéticos
#
# Uso:
#   ./run_pipeline.sh [--rebuild] [--phase N]
#
# Opções:
#   --rebuild   Rebuild do container Docker antes de executar
#   --phase N   Executa apenas a fase N (2, 3 ou 4)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuração
COMPOSE_FILE="docker-compose.ocr.yml"
CONTAINER_NAME="cryptogram-digitizer-ocr-service-1"
SERVICE_NAME="ocr-service"

# Parse argumentos
REBUILD=false
PHASE=0

while [[ $# -gt 0 ]]; do
    case $1 in
        --rebuild)
            REBUILD=true
            shift
            ;;
        --phase)
            PHASE=$2
            shift 2
            ;;
        *)
            echo -e "${RED}Opção desconhecida: $1${NC}"
            echo "Uso: $0 [--rebuild] [--phase N]"
            exit 1
            ;;
    esac
done

# Funções auxiliares
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker não está rodando. Inicie o Docker Desktop e tente novamente."
        exit 1
    fi
    log_success "Docker está rodando"
}

start_container() {
    log_info "Iniciando container OCR service..."
    
    if [ "$REBUILD" = true ]; then
        log_info "Rebuild solicitado — reconstruindo imagem..."
        docker compose -f "$COMPOSE_FILE" build --no-cache
    fi
    
    # Verificar se container já está rodando
    if docker compose -f "$COMPOSE_FILE" ps --services --filter "status=running" | grep -q "$SERVICE_NAME"; then
        log_success "Container já está rodando"
    else
        docker compose -f "$COMPOSE_FILE" up -d
        log_info "Aguardando container ficar saudável..."
        
        # Aguardar healthcheck
        local retries=0
        local max_retries=30
        while [ $retries -lt $max_retries ]; do
            if docker compose -f "$COMPOSE_FILE" ps --services --filter "status=healthy" | grep -q "$SERVICE_NAME"; then
                log_success "Container está saudável"
                return 0
            fi
            sleep 2
            retries=$((retries + 1))
            echo -n "."
        done
        echo ""
        log_warn "Container pode não estar totalmente saudável, mas continuando..."
    fi
}

run_phase_2() {
    log_info "========== FASE 2: Batch Extract Cells =========="
    log_info "Extraindo células das 43 fotos em samples/..."
    
    docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" \
        python training/batch_extract_cells.py \
        --samples-dir /app/samples \
        --output-dir /app/real_cells
    
    if [ $? -eq 0 ]; then
        log_success "Fase 2 concluída — células extraídas em real_cells/"
    else
        log_error "Fase 2 falhou!"
        exit 1
    fi
}

run_phase_3() {
    log_info "========== FASE 3: Generate Pseudo Labels =========="
    log_info "Executando pseudo-labeling com EasyOCR..."
    log_warn "Isso pode demorar vários minutos dependendo do número de células..."
    
    docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" \
        python training/generate_pseudo_labels.py \
        --input-dir /app/real_cells \
        --output-dir /app/pseudo_labeled
    
    if [ $? -eq 0 ]; then
        log_success "Fase 3 concluída — pseudo-labels gerados em pseudo_labeled/"
    else
        log_error "Fase 3 falhou!"
        exit 1
    fi
}

run_phase_4() {
    log_info "========== FASE 4: Hybrid Dataset =========="
    log_info "Combinando células reais com dados sintéticos..."
    
    docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" \
        python training/hybrid_dataset.py \
        --pseudo-dir /app/pseudo_labeled \
        --synthetic-dir /app/training/train_data \
        --output-dir /app/training/all_data
    
    if [ $? -eq 0 ]; then
        log_success "Fase 4 concluída — dataset híbrido gerado em training/all_data/"
    else
        log_error "Fase 4 falhou!"
        exit 1
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  PIPELINE CONCLUÍDO COM SUCESSO!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Outputs gerados:"
    echo "  real_cells/          — Células extraídas das fotos"
    echo "  pseudo_labeled/      — Células com pseudo-labels"
    echo "  training/all_data/   — Dataset híbrido para treino"
    echo ""
    echo "Próximo passo: Fase 5 — Treinamento do modelo"
    echo "  cd ocr-service/training"
    echo "  python train_hybrid.py --config config_hybrid.yaml"
    echo ""
}

# Main
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  OCR Híbrido — Pipeline de Treinamento${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

check_docker
start_container

if [ "$PHASE" -eq 0 ] || [ "$PHASE" -eq 2 ]; then
    run_phase_2
fi

if [ "$PHASE" -eq 0 ] || [ "$PHASE" -eq 3 ]; then
    run_phase_3
fi

if [ "$PHASE" -eq 0 ] || [ "$PHASE" -eq 4 ]; then
    run_phase_4
fi

if [ "$PHASE" -eq 0 ]; then
    print_summary
fi
