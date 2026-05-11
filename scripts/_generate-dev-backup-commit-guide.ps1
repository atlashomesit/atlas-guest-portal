# Generates docs/dev-backup-pre-2b56-reset-commit-guide.md - run from scripts/ (repo root parent).
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$range = '2b56cef..origin/dev-backup-pre-2b56-reset'
git fetch origin 2>$null
$tipShort = git rev-parse --short origin/dev-backup-pre-2b56-reset
$tipFull = git rev-parse origin/dev-backup-pre-2b56-reset

$shas = @(git log --reverse --format='%H' $range)
$sb = New-Object System.Text.StringBuilder

function Add-Line([string]$s) { [void]$sb.AppendLine($s) }

Add-Line '# atlas-guest-portal: commits after `2b56cef` (backup replay queue)'
Add-Line ''
Add-Line 'This document lists every commit on branch **`dev-backup-pre-2b56-reset`** that is **not** an ancestor of **`2b56cef`** - i.e. the work that was removed when **`dev`** was reset to **`2b56cef`**.'
Add-Line ''
Add-Line '- **Repository:** `atlashomesit/atlas-guest-portal`'
Add-Line ('- **Base commit:** [`2b56cef`](https://github.com/atlashomesit/atlas-guest-portal/commit/2b56cef87261a16252b0e03bb58e3448c771a102) - Merge PR #151 (dependabot npm minor/patch)')
Add-Line ('- **Tip commit (backup branch):** [`' + $tipShort + '`](https://github.com/atlashomesit/atlas-guest-portal/commit/' + $tipFull + ')')
Add-Line ("- **Total commits:** $($shas.Count)")
Add-Line '- **Replay order:** oldest to newest (same order as this document). Command: `git log --reverse --oneline 2b56cef..origin/dev-backup-pre-2b56-reset`'
Add-Line ''
Add-Line 'For each entry: **name-status** shows add/modify/delete; **diff statistics** shows insert/delete counts per file.'
Add-Line ''
Add-Line 'To regenerate this file after fetching `origin`: run `scripts/_generate-dev-backup-commit-guide.ps1` from the repository root (script lives under `scripts/`).'
Add-Line ''
Add-Line '---'
Add-Line ''

$i = 0
foreach ($sha in $shas) {
  $i++
  $meta = git show -1 --no-patch --format='%h%x1f%H%x1f%s%x1f%aN%x1f%aE%x1f%cI' $sha
  $p = $meta -split [char]0x1f, 6
  $short = $p[0]
  $full = $p[1]
  $subj = $p[2]
  $an = $p[3]
  $ae = $p[4]
  $dt = $p[5]
  $body = (git show -1 --format='%b' --no-patch $sha).TrimEnd()

  Add-Line "## $i. ``$short`` $subj"
  Add-Line ''
  Add-Line '| Field | Value |'
  Add-Line '|-------|-------|'
  Add-Line "| Full SHA | ``$full`` |"
  Add-Line "| Author | $an <$ae> |"
  Add-Line "| Commit date | $dt |"
  Add-Line "| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/$full) |"
  Add-Line ''

  if ($body.Length -gt 0) {
    Add-Line '### Commit message (body)'
    Add-Line ''
    Add-Line '```'
    Add-Line $body
    Add-Line '```'
    Add-Line ''
  }

  Add-Line '### Files changed (name-status)'
  Add-Line ''
  Add-Line '```text'
  # -m splits merge commits so each parent diff lists paths (otherwise name-status can be empty).
  $namestat = @(git show -m -1 --name-status --format='' $sha | Where-Object { $_.Trim().Length -gt 0 })
  if ($namestat.Count -eq 0) { Add-Line '(no file list)' } else { foreach ($l in $namestat) { Add-Line $l } }
  Add-Line '```'
  Add-Line ''

  Add-Line '### Diff statistics'
  Add-Line ''
  Add-Line '```text'
  $statLines = git show -1 --stat --format='' $sha
  foreach ($l in $statLines) { Add-Line $l }
  Add-Line '```'
  Add-Line ''
  Add-Line '---'
  Add-Line ''
}

$outPath = Join-Path (Get-Location) 'docs\dev-backup-pre-2b56-reset-commit-guide.md'
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $outPath ($($shas.Count) commits)"
