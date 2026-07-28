param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath,

  [string]$ProjectRef,

  [switch]$Local
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

if ($Local -and -not [string]::IsNullOrWhiteSpace($ProjectRef)) {
  throw "Use -Local sem -ProjectRef."
}

if (-not $Local -and [string]::IsNullOrWhiteSpace($ProjectRef)) {
  throw "Informe -ProjectRef para importação remota ou use -Local."
}

$booleanColumns = @{
  contratos_templates = @("ativo")
  notificacoes = @("lida")
  portal_acessos = @("ativo")
  processo_monitoramento = @("ativo")
  publicacoes = @("tarefa_gerada")
  tribunal_credenciais = @("ativo")
}

$integerColumns = @{
  contratos_templates = @("uso_count")
  email_send_state = @(
    "batch_size",
    "send_delay_ms",
    "auth_email_ttl_minutes",
    "transactional_email_ttl_minutes"
  )
  publicacoes = @("prazo_dias")
}

$decimalColumns = @{
  financeiro = @("valor")
}

$arrayColumns = @{
  contratos_templates = @("variaveis")
}

function Convert-ExportValue {
  param(
    [string]$Table,
    [string]$Column,
    [AllowNull()]
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $null
  }

  if ($booleanColumns[$Table] -contains $Column) {
    return $Value -in @("t", "true", "1")
  }

  if ($integerColumns[$Table] -contains $Column) {
    return [int64]$Value
  }

  if ($decimalColumns[$Table] -contains $Column) {
    return [decimal]::Parse($Value, [Globalization.CultureInfo]::InvariantCulture)
  }

  if ($arrayColumns[$Table] -contains $Column) {
    $inner = $Value.Trim()
    if ($inner.StartsWith("{") -and $inner.EndsWith("}")) {
      $inner = $inner.Substring(1, $inner.Length - 2)
    }
    if ([string]::IsNullOrWhiteSpace($inner)) {
      return @()
    }
    return @(
      $inner.Split(",") |
        ForEach-Object { $_.Trim().Trim('"') }
    )
  }

  return $Value
}

function Read-ZipCsv {
  param(
    [System.IO.Compression.ZipArchive]$Archive,
    [string]$FileName
  )

  $entry = $Archive.GetEntry($FileName)
  if (-not $entry) {
    throw "Arquivo ausente no export: $FileName"
  }

  $reader = [System.IO.StreamReader]::new($entry.Open())
  try {
    return @($reader.ReadToEnd() | ConvertFrom-Csv)
  } finally {
    $reader.Dispose()
  }
}

function ConvertTo-SqlLiteral {
  param([AllowNull()][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return "NULL"
  }

  return "'" + $Value.Replace("'", "''") + "'"
}

if ($Local) {
  $localStatus = npx supabase status --output json 2>$null |
    ConvertFrom-Json
  $serviceRoleKey = $localStatus.SERVICE_ROLE_KEY
  $apiBaseUrl = ([string]$localStatus.API_URL).TrimEnd("/")
} else {
  $apiKeyOutput = npx supabase projects api-keys `
    --project-ref $ProjectRef `
    --output-format json 2>$null | ConvertFrom-Json

  $serviceRoleKey = (
    $apiKeyOutput.keys |
      Where-Object { $_.name -eq "service_role" } |
      Select-Object -First 1
  ).api_key
  $apiBaseUrl = "https://$ProjectRef.supabase.co"
}

if (
  [string]::IsNullOrWhiteSpace($serviceRoleKey) -or
  [string]::IsNullOrWhiteSpace($apiBaseUrl)
) {
  throw "Não foi possível obter a configuração administrativa do Supabase."
}

$headers = @{
  apikey = $serviceRoleKey
  Authorization = "Bearer $serviceRoleKey"
  Prefer = "resolution=merge-duplicates,return=minimal"
}

$importOrder = @(
  @{ Table = "profiles"; File = "profiles.csv"; Conflict = "id" }
  @{ Table = "asaas_subscriptions"; File = "asaas_subscriptions.csv"; Conflict = "user_id" }
  @{ Table = "clientes"; File = "clientes.csv"; Conflict = "id" }
  @{ Table = "contratos_templates"; File = "contratos_templates.csv"; Conflict = "id" }
  @{ Table = "processos"; File = "processos.csv"; Conflict = "id" }
  @{ Table = "financeiro"; File = "financeiro.csv"; Conflict = "id" }
  @{ Table = "notificacoes"; File = "notificacoes.csv"; Conflict = "id" }
  @{ Table = "portal_acessos"; File = "portal_acessos.csv"; Conflict = "id" }
  @{ Table = "processo_monitoramento"; File = "processo_monitoramento.csv"; Conflict = "id" }
  @{ Table = "publicacoes"; File = "publicacoes.csv"; Conflict = "id" }
  @{ Table = "tarefas"; File = "tarefas.csv"; Conflict = "id" }
  @{ Table = "tribunal_credenciais"; File = "tribunal_credenciais.csv"; Conflict = "id" }
  @{ Table = "email_send_state"; File = "email_send_state.csv"; Conflict = "id" }
)

$archive = [System.IO.Compression.ZipFile]::OpenRead(
  (Resolve-Path -LiteralPath $ZipPath)
)

$results = @()

try {
  if ($Local) {
    $projectLine = Get-Content "supabase/config.toml" |
      Where-Object { $_ -match '^\s*project_id\s*=' } |
      Select-Object -First 1
    if (-not $projectLine -or $projectLine -notmatch '"([^"]+)"') {
      throw "Não foi possível resolver project_id em supabase/config.toml."
    }

    $localProjectRef = $Matches[1]
    $dbContainer = "supabase_db_$localProjectRef"
    $containerExists = docker ps --format "{{.Names}}" |
      Where-Object { $_ -eq $dbContainer }
    if (-not $containerExists) {
      throw "Container local não encontrado: $dbContainer"
    }

    $authUsers = Read-ZipCsv -Archive $archive -FileName "auth_users.csv"
    foreach ($authUser in $authUsers) {
      $userId = ConvertTo-SqlLiteral ([string]$authUser.uuid)
      $email = ConvertTo-SqlLiteral ([string]$authUser.email)
      $createdAt = ConvertTo-SqlLiteral ([string]$authUser.created_at)

      $sql = @"
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  ${userId}::uuid,
  'authenticated',
  'authenticated',
  $email,
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  coalesce(${createdAt}::timestamptz, now()),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do update set email = excluded.email;
"@

      $sql | docker exec -i $dbContainer `
        psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw "Falha ao criar usuário local $($authUser.uuid)."
      }
    }
  }

  foreach ($item in $importOrder) {
    $table = $item.Table
    $sourceRows = Read-ZipCsv -Archive $archive -FileName $item.File
    $payloadRows = @()

    foreach ($sourceRow in $sourceRows) {
      $payload = [ordered]@{}

      foreach ($property in $sourceRow.PSObject.Properties) {
        if (
          $table -eq "portal_acessos" -and
          $property.Name -eq "token" -and
          [string]::IsNullOrWhiteSpace([string]$property.Value)
        ) {
          continue
        }

        if ($table -eq "asaas_subscriptions" -and $property.Name -eq "id") {
          continue
        }

        $payload[$property.Name] = Convert-ExportValue `
          -Table $table `
          -Column $property.Name `
          -Value ([string]$property.Value)
      }

      $payloadRows += $payload
    }

    if ($payloadRows.Count -eq 0) {
      continue
    }

    $uri = "$apiBaseUrl/rest/v1/$table" +
      "?on_conflict=$($item.Conflict)"

    Invoke-RestMethod `
      -Method Post `
      -Uri $uri `
      -Headers $headers `
      -ContentType "application/json" `
      -Body ($payloadRows | ConvertTo-Json -Depth 20 -Compress) | Out-Null

    $results += [PSCustomObject]@{
      Table = $table
      Imported = $payloadRows.Count
    }
  }
} finally {
  $archive.Dispose()
  $serviceRoleKey = $null
  $headers = $null
}

$results | Format-Table -AutoSize
