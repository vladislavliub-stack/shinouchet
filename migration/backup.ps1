# ШиноУчёт: приватная резервная копия перед переездом

# Запускается на компьютере с установленными Supabase CLI и Docker.
# НЕ коммитить файлы *.sql, .env или пароли в GitHub.
# Документация: https://supabase.com/docs/guides/self-hosting/restore-from-platform

# В PowerShell задайте строку подключения к БД в текущем сеансе:
# $env:SUPABASE_DB_URL = 'postgresql://...'
# Строку берите из Supabase Dashboard -> Connect -> Session pooler.

$ErrorActionPreference = 'Stop'
if (-not $env:SUPABASE_DB_URL) { throw 'Не задана переменная SUPABASE_DB_URL' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$folder = Join-Path $PSScriptRoot "private-backup-$stamp"
New-Item -ItemType Directory -Path $folder -ErrorAction Stop | Out-Null

$steps = @(
    @{ Name='roles.sql'; Args=@('--role-only') },
    @{ Name='schema.sql'; Args=@() },
    @{ Name='data.sql'; Args=@('--use-copy','--data-only') }
)
foreach ($step in $steps) {
    $path = Join-Path $folder $step.Name
    & supabase db dump --db-url $env:SUPABASE_DB_URL -f $path @($step.Args)
    if ($LASTEXITCODE -ne 0) { throw "Ошибка резервного копирования: $($step.Name)" }
    if (-not (Test-Path $path)) { throw "Файл не создан: $path" }
}
$files = Get-ChildItem -Path $folder -File
$files | Get-FileHash -Algorithm SHA256 | Select-Object @{Name='File';Expression={$_.Path}},Hash |
    Export-Csv -Path (Join-Path $folder 'checksums.csv') -NoTypeInformation -Encoding UTF8
Write-Host "Архив подготовлен: $folder"
Write-Host 'Не загружайте его в публичный репозиторий. Проверка восстановления обязательна.'
