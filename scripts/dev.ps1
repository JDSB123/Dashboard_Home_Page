param(
  [int]$Port = 8080
)

$clientPath = Join-Path $PSScriptRoot '..' 'client'
if (-not (Test-Path $clientPath)) {
  Write-Error "Client folder not found at $clientPath"; exit 1
}

Write-Host "Serving $clientPath on http://localhost:$Port"
try {
  npx --yes http-server "$clientPath" -p $Port -c-1
} catch {
  Write-Warning "npx http-server not available. Falling back to .NET HttpListener."
  Add-Type -AssemblyName System.Net
  $listener = New-Object System.Net.HttpListener
  $prefix = "http://*:" + $Port + "/"
  $listener.Prefixes.Add($prefix)
  $listener.Start()
  Write-Host "Listening at $prefix"
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    $path = $req.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }
    $file = Join-Path $clientPath $path
    if (-not (Test-Path $file)) { $res.StatusCode = 404; $res.Close(); continue }
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes,0,$bytes.Length)
    $res.Close()
  }
} 