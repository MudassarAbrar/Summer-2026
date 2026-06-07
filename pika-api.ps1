# Pika-API.ps1 - PowerShell wrapper for Pika MCP API calls
#
# Usage:
#   $env:PIKA_MCP_TOKEN = "<your-token>"
#   .\pika-api.ps1 -Action "skill:List"
#
# Or pipe JSON data:
#   "{'name':'test'}" | .\pika-api.ps1 -Action "app-sizzle"
#

param(
    [Parameter(Mandatory=$true)]
    [string]$Action,

    [Parameter(ValueFromPipeline=$true)]
    [string]$Data
)

$ErrorActionPreference = 'Stop'

$token = $env:PIKA_MCP_TOKEN
if (-not $token) {
    Write-Error 'PIKA_MCP_TOKEN environment variable is not set. Set it first: $env:PIKA_MCP_TOKEN = "<your-token>"'
    exit 1
}

$body = @{ action = $Action }
if ($Data) {
    try {
        $parsedData = $Data | ConvertFrom-Json -AsHashtable
        $parsedData.GetEnumerator() | ForEach-Object { $body[$_.Key] = $_.Value }
    } catch {
        # If not valid JSON, pass as raw string parameter
        $body['param'] = $Data
    }
}

$jsonBody = $body | ConvertTo-Json -Compress

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

try {
    $response = Invoke-RestMethod -Uri 'https://api.pika.me/pika' -Method Post -Headers $headers -Body $jsonBody
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Error "API call failed: $($_.Exception.Message)"
}