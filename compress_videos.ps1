param(
    [string]$InputFolder = ".\videos_originais",
    [string]$OutputFolder = ".\videos_comprimidos"
)

# Verifica se o ffmpeg está instalado
$ffmpegPath = "ffmpeg"
if (Test-Path -Path ".\ffmpeg.exe") {
    $ffmpegPath = ".\ffmpeg.exe"
} elseif (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "FFmpeg não encontrado. Fazendo o download..." -ForegroundColor Yellow
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" -OutFile "ffmpeg.zip"
    Expand-Archive -Path "ffmpeg.zip" -DestinationPath "ffmpeg_temp" -Force
    Copy-Item "ffmpeg_temp\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe" -Destination ".\ffmpeg.exe"
    Remove-Item -Path "ffmpeg.zip", "ffmpeg_temp" -Recurse -Force
    $ffmpegPath = ".\ffmpeg.exe"
    Write-Host "FFmpeg baixado com sucesso!" -ForegroundColor Green
}

# Cria a pasta de saída se não existir
if (-not (Test-Path -Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder | Out-Null
}

Write-Host "Iniciando a compressão dos vídeos..." -ForegroundColor Cyan

# Pega todos os arquivos mp4 da pasta de entrada
$videos = Get-ChildItem -Path $InputFolder -Filter *.mp4

foreach ($video in $videos) {
    $inputFile = $video.FullName
    $outputFile = Join-Path -Path $OutputFolder -ChildPath $video.Name
    
    Write-Host "Comprimindo: $($video.Name)" -ForegroundColor Yellow
    
    # Comando ffmpeg:
    # -vcodec libx264: codec de vídeo compatível com qualquer dispositivo
    # -crf 28: Qualidade (menor é melhor, 28 é um bom balanço entre tamanho e qualidade para telas pequenas/netbooks)
    # -preset fast: velocidade de compressão
    # -vf scale=-2:720: reduz a resolução para 720p se for maior (mantendo proporção)
    # -acodec aac -b:a 128k: comprime o áudio para 128kbps
    $ffmpegArgs = "-i `"$inputFile`" -vcodec libx264 -crf 28 -preset fast -vf scale=-2:720 -acodec aac -b:a 128k `"$outputFile`""
    
    Start-Process -FilePath $ffmpegPath -ArgumentList $ffmpegArgs -Wait -NoNewWindow
    
    Write-Host "Concluído: $($video.Name)" -ForegroundColor Green
}

Write-Host "Todos os vídeos foram processados!" -ForegroundColor Cyan
