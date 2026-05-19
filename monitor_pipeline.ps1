# monitor_pipeline.ps1
# Monitora o progresso do pipeline de pseudo-labeling em tempo real

param(
    [int]$IntervalSeconds = 10,
    [string]$PipelineDir = "E:\code\cryptogram-digitizer\pseudo_labeled"
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Pipeline Monitor - Pseudo-Labeling" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Diretorio: $PipelineDir" -ForegroundColor Gray
Write-Host "Intervalo: ${IntervalSeconds}s" -ForegroundColor Gray
Write-Host "Pressione Ctrl+C para parar" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$totalCells = 4950
$startTime = Get-Date
$lastCount = 0
$lastTime = Get-Date

while ($true) {
    Clear-Host
    
    $now = Get-Date
    $elapsed = New-TimeSpan -Start $startTime -End $now
    $interval = New-TimeSpan -Start $lastTime -End $now
    
    # Contar arquivos
    $highCount = (Get-ChildItem -Path "$PipelineDir\high" -Recurse -File -Filter "*.png" -ErrorAction SilentlyContinue | Measure-Object).Count
    $medCount = (Get-ChildItem -Path "$PipelineDir\med" -Recurse -File -Filter "*.png" -ErrorAction SilentlyContinue | Measure-Object).Count
    $totalGenerated = $highCount + $medCount
    
    # Calcular estimativas
    $newFiles = $totalGenerated - $lastCount
    $rate = if ($interval.TotalSeconds -gt 0) { $newFiles / $interval.TotalSeconds } else { 0 }
    $estimatedTotal = if ($rate -gt 0) { ($totalGenerated / $rate) } else { 0 }
    $remaining = if ($rate -gt 0) { (4950 - $totalGenerated) / $rate } else { 0 }
    
    # Progresso
    $progress = if ($totalCells -gt 0) { [math]::Round(($totalGenerated / ($totalCells * 10)) * 100, 1) } else { 0 }
    # Cada célula gera ~10 augmentações (high) ou ~5 (med), então estimamos células processadas
    $estimatedCellsProcessed = [math]::Round($totalGenerated / 10)
    $cellProgress = if ($totalCells -gt 0) { [math]::Round(($estimatedCellsProcessed / $totalCells) * 100, 1) } else { 0 }
    
    # Barra de progresso
    $barWidth = 40
    $filled = [math]::Floor($cellProgress / 100 * $barWidth)
    $empty = $barWidth - $filled
    $bar = ("#" * $filled) + ("." * $empty)
    
    # Header
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  PIPELINE STATUS" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Progress bar
    Write-Host "Progresso: [$bar] ${cellProgress}%" -ForegroundColor White
    Write-Host ""
    
    # Stats
    Write-Host "Tempo decorrido:   $($elapsed.ToString('hh\:mm\:ss'))" -ForegroundColor Gray
    Write-Host "Celulas processadas: ~${estimatedCellsProcessed} / ${totalCells}" -ForegroundColor Gray
    Write-Host ""
    
    # Counts
    Write-Host "Imagens geradas:" -ForegroundColor White
    Write-Host "  High tier (>=0.95):  $highCount" -ForegroundColor Green
    Write-Host "  Med tier  (0.80-0.94): $medCount" -ForegroundColor Yellow
    Write-Host "  Total:               $totalGenerated" -ForegroundColor White
    Write-Host ""
    
    # Rate
    if ($rate -gt 0) {
        Write-Host "Taxa: $([math]::Round($rate, 1)) imagens/s" -ForegroundColor Cyan
        Write-Host "Tempo restante estimado: $([math]::Round($remaining / 60, 1)) minutos" -ForegroundColor Cyan
    } else {
        Write-Host "Taxa: Calculando..." -ForegroundColor Gray
    }
    Write-Host ""
    
    # Distribution by digit
    Write-Host "Distribuicao por digito (high tier):" -ForegroundColor White
    if (Test-Path "$PipelineDir\high") {
        $digits = Get-ChildItem -Path "$PipelineDir\high" -Directory | Sort-Object Name
        foreach ($digit in $digits) {
            $count = (Get-ChildItem -Path $digit.FullName -File -Filter "*.png" -ErrorAction SilentlyContinue | Measure-Object).Count
            if ($count -gt 0) {
                $barDigit = ("#" * ([math]::Floor($count / 10)))
                Write-Host "  ${digit.Name}: $count $barDigit" -ForegroundColor Gray
            }
        }
    }
    Write-Host ""
    
    # Footer
    Write-Host "Ultima atualizacao: $($now.ToString('HH:mm:ss'))" -ForegroundColor Gray
    Write-Host "Proxima atualizacao em ${IntervalSeconds}s..." -ForegroundColor Gray
    Write-Host ""
    
    # Update state
    $lastCount = $totalGenerated
    $lastTime = Get-Date
    
    # Wait
    Start-Sleep -Seconds $IntervalSeconds
}
