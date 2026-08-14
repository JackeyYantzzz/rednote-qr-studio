$ErrorActionPreference = "Stop"

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$cloudflaredDefault = Join-Path $env:LOCALAPPDATA "Programs\cloudflared\cloudflared.exe"
$cloudflaredCommand = Get-Command "cloudflared.exe" -ErrorAction SilentlyContinue
$cloudflared = if ($cloudflaredCommand) {
  $cloudflaredCommand.Source
} elseif (Test-Path -LiteralPath $cloudflaredDefault) {
  $cloudflaredDefault
} else {
  throw "没有找到 cloudflared。请先完成手机访问工具安装。"
}
$pnpmCommand = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
if (-not $pnpmCommand) {
  throw "没有找到 pnpm.cmd。请关闭并重新打开 PowerShell 后再试。"
}

$listeners = @(
  Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
)
if ($listeners.Count -gt 0) {
  throw "端口 3000 已被占用。请先在旧的开发服务器窗口按 Ctrl+C，再重新运行本脚本。"
}

$logKey = [guid]::NewGuid().ToString("N")
$stdoutLog = Join-Path $env:TEMP "rednote-phone-$logKey.stdout.log"
$stderrLog = Join-Path $env:TEMP "rednote-phone-$logKey.stderr.log"
$tunnelProcess = $null

try {
  Write-Host ""
  Write-Host "正在创建 iPhone 可访问的临时 HTTPS 地址…" -ForegroundColor Cyan
  $tunnelProcess = Start-Process `
    -FilePath $cloudflared `
    -ArgumentList @(
      "tunnel",
      "--url",
      "http://127.0.0.1:3000",
      "--no-autoupdate"
    ) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru

  $publicUrl = $null
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    Start-Sleep -Milliseconds 500
    $combinedLog = @(
      if (Test-Path -LiteralPath $stdoutLog) {
        Get-Content -Raw -LiteralPath $stdoutLog -ErrorAction SilentlyContinue
      }
      if (Test-Path -LiteralPath $stderrLog) {
        Get-Content -Raw -LiteralPath $stderrLog -ErrorAction SilentlyContinue
      }
    ) -join "`n"
    $match = [regex]::Match(
      $combinedLog,
      "https://[a-z0-9-]+\.trycloudflare\.com",
      [Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
    if ($match.Success) {
      $publicUrl = $match.Value
      break
    }
    if ($tunnelProcess.HasExited) {
      throw "HTTPS Tunnel 启动失败。请检查网络连接后再试。"
    }
  }

  if (-not $publicUrl) {
    throw "15 秒内没有取得 HTTPS 地址。请检查网络连接后再试。"
  }

  $publicHost = ([Uri]$publicUrl).DnsSafeHost
  if (-not $publicHost.EndsWith(".trycloudflare.com", [StringComparison]::OrdinalIgnoreCase)) {
    throw "HTTPS Tunnel 返回了无法识别的主机名：$publicHost"
  }

  $env:DEMO_MODE = "true"
  $env:NEXT_PUBLIC_SITE_URL = $publicUrl
  # Vite blocks unfamiliar Host headers by default. Allow only the exact,
  # randomly generated Cloudflare hostname for this preview session.
  $env:__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS = $publicHost
  Set-Location -LiteralPath $projectRoot

  Write-Host ""
  Write-Host "普通模式：" -ForegroundColor Green
  Write-Host "$publicUrl/p/soft-living" -ForegroundColor White
  Write-Host ""
  Write-Host "快发模式：" -ForegroundColor Green
  Write-Host "$publicUrl/fast/soft-living" -ForegroundColor White
  Write-Host ""
  Write-Host "网页服务正在启动，请先不要立即打开上面的地址。" -ForegroundColor Yellow
  Write-Host "看到下方出现 Local: http://127.0.0.1:3000/ 后，再在 iPhone Safari 打开。" -ForegroundColor Yellow
  Write-Host "如果手机已经显示 Bad Gateway，看到 Local 后刷新一次即可。" -ForegroundColor Yellow
  Write-Host "测试期间不要关闭本窗口；结束时按 Ctrl+C。" -ForegroundColor Yellow
  Write-Host "临时地址是公开测试地址，请勿填写真实账号、密码或敏感资料。" -ForegroundColor DarkYellow
  Write-Host ""

  # Keep Vinext and the Cloudflare tunnel on the same IPv4 address. On some
  # Windows systems, "localhost" resolves to IPv6 only, while the tunnel below
  # connects to 127.0.0.1 and would otherwise return Bad Gateway.
  & $pnpmCommand.Source exec vinext dev --hostname 127.0.0.1 --port 3000
} finally {
  if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($logPath in @($stdoutLog, $stderrLog)) {
    if (Test-Path -LiteralPath $logPath) {
      Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
    }
  }
}
