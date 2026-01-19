# Script to fix unused variable warnings by prefixing with underscore
param([string]$FilePath)

if (-not $FilePath) {
    Write-Host "Usage: FixUnusedVars.ps1 -FilePath <file_path>"
    exit 1
}

if (-not (Test-Path $FilePath)) {
    Write-Host "File not found: $FilePath"
    exit 1
}

$content = Get-Content $FilePath -Raw

# Common unused variable patterns - function parameters
$patterns = @{
    'jobId: string' = '_jobId: string'
    'organizationId: string' = '_organizationId: string'
    'userId: number' = '_userId: number'
    'createdBy: string' = '_createdBy: string'
    'updatedBy: string' = '_updatedBy: string'
    'deletedBy: string' = '_deletedBy: string'
    'next: ' = '_next: '
    'error\) ' = '_error) '
    'table\) ' = '_table) '
}

$changesCount = 0
foreach ($pattern in $patterns.Keys) {
    $replacement = $patterns[$pattern]
    $newContent = $content -replace $pattern, $replacement
    if ($newContent -ne $content) {
        $changesCount++
        $content = $newContent
        Write-Host "Applied pattern: $pattern -> $replacement"
    }
}

if ($changesCount -gt 0) {
    Set-Content $FilePath $content -NoNewline
    Write-Host "Made $changesCount changes to $FilePath"
} else {
    Write-Host "No changes needed for $FilePath"
}
