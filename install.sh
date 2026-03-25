#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_EXAMPLE="$ROOT_DIR/.env.example"
ENV_FILE="$ROOT_DIR/.env"
INSTALL_ACTION='configure'

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required but was not found in PATH.\n' >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  printf 'Docker Compose v2 is required (`docker compose`).\n' >&2
  exit 1
fi

if [ ! -f "$ENV_EXAMPLE" ]; then
  printf '.env.example is missing. Cannot continue.\n' >&2
  exit 1
fi

random_hex() {
  local bytes="$1"
  od -An -N"$bytes" -tx1 /dev/urandom | tr -d ' \n'
}

random_base64url() {
  local bytes="$1"
  dd if=/dev/urandom bs="$bytes" count=1 status=none | base64 | tr '+/' '-_' | tr -d '=\n'
}

prompt() {
  local message="$1"
  local default_value="${2:-}"
  local answer
  if [ -n "$default_value" ]; then
    read -r -p "$message [$default_value]: " answer
    printf '%s' "${answer:-$default_value}"
  else
    read -r -p "$message: " answer
    printf '%s' "$answer"
  fi
}

prompt_secret() {
  local message="$1"
  local first second
  while true; do
    read -r -s -p "$message: " first
    printf '\n'
    read -r -s -p "Confirm password: " second
    printf '\n'
    if [ -n "$first" ] && [ "$first" = "$second" ]; then
      printf '%s' "$first"
      return
    fi
    printf 'Passwords did not match. Try again.\n'
  done
}

choose_mode() {
  local default_choice="${1:-1}"
  printf 'Where will you open Mcraftr?\n' >&2
  printf '  1. This machine only\n' >&2
  printf '  2. Private network (Tailscale, WireGuard, VPN, private IP)\n' >&2
  printf '  3. Local network\n' >&2
  printf '  4. Public domain\n' >&2
  while true; do
    local choice
    read -r -p "Choose 1-4 [$default_choice]: " choice
    case "${choice:-$default_choice}" in
      1) printf 'local'; return ;;
      2) printf 'private'; return ;;
      3) printf 'lan'; return ;;
      4) printf 'public'; return ;;
    esac
  done
}

infer_mode() {
  local site_domain bind_host
  site_domain="$(env_value SITE_DOMAIN)"
  bind_host="$(env_value MCRAFTR_BIND_HOST)"

  if [ -n "$site_domain" ]; then
    printf 'public'
  elif [ "$bind_host" = '0.0.0.0' ]; then
    printf 'lan'
  elif [ -n "$bind_host" ] && [ "$bind_host" != '127.0.0.1' ]; then
    printf 'private'
  else
    printf 'local'
  fi
}

mode_label() {
  case "$1" in
    local) printf 'This machine only' ;;
    private) printf 'Private network' ;;
    lan) printf 'My local network' ;;
    public) printf 'Public domain' ;;
  esac
}

print_existing_summary() {
  local current_mode current_url current_host current_port
  current_mode="$(infer_mode)"
  current_url="$(env_value NEXTAUTH_URL)"
  current_host="$(env_value MCRAFTR_BIND_HOST)"
  current_port="$(env_value MCRAFTR_BIND_PORT)"

  printf 'Existing .env detected.\n'
  printf 'Current mode: %s\n' "$(mode_label "$current_mode")"
  printf 'Current URL: %s\n' "${current_url:-not set}"
  printf 'Bind host: %s\n' "${current_host:-not set}"
  printf 'Bind port: %s\n' "${current_port:-not set}"
}

set_key() {
  local key="$1"
  local value="$2"
  local temp_file
  temp_file="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      replaced = 1
      next
    }
    { print }
    END {
      if (!replaced) print key "=" value
    }
  ' "$ENV_FILE" > "$temp_file"

  mv "$temp_file" "$ENV_FILE"
}

env_value() {
  local key="$1"
  local line
  line="$(grep -m 1 "^${key}=" "$ENV_FILE" || true)"
  printf '%s' "${line#*=}"
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    INSTALL_ACTION='configure'
    return
  fi

  print_existing_summary
  printf '  1. Reuse existing config (recommended)\n'
  printf '  2. Update a few values\n'
  printf '  3. Replace it completely\n'

  local action
  while true; do
    read -r -p 'Choose 1-3 [1]: ' action
    case "${action:-1}" in
      1)
        INSTALL_ACTION='reuse'
        printf 'Reusing existing .env.\n'
        return
        ;;
      2)
        INSTALL_ACTION='update'
        printf 'Updating selected values in existing .env.\n'
        return
        ;;
      3)
        INSTALL_ACTION='replace'
        printf 'Replacing existing .env from .env.example.\n'
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        return
        ;;
    esac
  done
}

existing_or_default() {
  local key="$1"
  local fallback="$2"
  local current
  current="$(env_value "$key")"
  if [ -n "$current" ]; then
    printf '%s' "$current"
  else
    printf '%s' "$fallback"
  fi
}

host_from_url() {
  local raw="$1"
  raw="${raw#http://}"
  raw="${raw#https://}"
  raw="${raw%%/*}"
  printf '%s' "$raw"
}

private_host_hint() {
  printf 'Tip: use a private IP or VPN hostname already assigned to this machine.\n' >&2
}

ensure_secret() {
  local key="$1"
  local generator="$2"
  if [ -z "$(env_value "$key")" ] || [ "$(env_value "$key")" = 'replace-me' ]; then
    set_key "$key" "$($generator)"
  fi
}

choose_password_action() {
  local default_choice="${1:-1}"
  printf 'Admin password\n' >&2
  if [ "$default_choice" = '1' ]; then
    printf '  1. Keep the existing password\n' >&2
    printf '  2. Generate one for me\n' >&2
    printf '  3. I want to enter one\n' >&2
  else
    printf '  1. Generate one for me\n' >&2
    printf '  2. I want to enter one\n' >&2
  fi
  while true; do
    local choice
    if [ "$default_choice" = '1' ]; then
      read -r -p "Choose 1-3 [$default_choice]: " choice
      case "${choice:-$default_choice}" in
        1|2|3)
          printf '%s' "${choice:-$default_choice}"
          return
          ;;
      esac
    else
      read -r -p "Choose 1-2 [$default_choice]: " choice
      case "${choice:-$default_choice}" in
        1|2)
          printf '%s' "${choice:-$default_choice}"
          return
          ;;
      esac
    fi
  done
}

start_services() {
  local public_mode="$1"
  if [ "$public_mode" = 'true' ]; then
    docker compose -f docker-compose.yml -f deploy/compose/public-caddy.compose.yaml up -d --build
  else
    docker compose up -d --build
  fi
}

print_final_summary() {
  local browser_url="$1"
  local admin_email="$2"
  local generated_password="$3"

  printf '\nMcraftr is starting up.\n'
  printf 'Open: %s\n' "$browser_url"
  printf 'Admin email: %s\n' "$admin_email"
  if [ -n "$generated_password" ]; then
    printf 'Generated password: %s\n' "$generated_password"
  elif [ "$INSTALL_ACTION" = 'reuse' ]; then
    printf 'Admin password: unchanged from your existing .env\n'
  else
    printf 'Admin password: the custom password you entered\n'
  fi
  printf 'Next: log in, then use Quick Connect to add your Minecraft server.\n'
}

ensure_env_file

ensure_secret NEXTAUTH_SECRET "random_hex 32"
ensure_secret MCRAFTR_ENC_KEY "random_hex 32"
ensure_secret REDIS_PASSWORD "random_base64url 18"

set_key REDIS_URL "redis://:$(env_value REDIS_PASSWORD)@mcraftr-redis:6379"
set_key DATA_DIR '/app/data'
set_key ALLOW_REGISTRATION 'false'

if [ "$INSTALL_ACTION" = 'reuse' ]; then
  mode="$(infer_mode)"
  browser_url="$(env_value NEXTAUTH_URL)"
  admin_email="$(env_value MCRAFTR_ADMIN_USER)"
  public_mode='false'
  if [ "$mode" = 'public' ]; then
    public_mode='true'
  fi

  printf '\nStarting Mcraftr...\n'
  start_services "$public_mode"
  print_final_summary "$browser_url" "$admin_email" ''
  exit 0
fi

current_mode="$(infer_mode)"
default_mode_choice='1'
case "$current_mode" in
  local) default_mode_choice='1' ;;
  private) default_mode_choice='2' ;;
  lan) default_mode_choice='3' ;;
  public) default_mode_choice='4' ;;
esac

mode="$(choose_mode "$default_mode_choice")"
port="$(prompt 'Mcraftr port' "$(existing_or_default MCRAFTR_BIND_PORT 3054)")"
admin_email="$(prompt 'Admin email' "$(existing_or_default MCRAFTR_ADMIN_USER admin@example.com)")"

password_default='2'
if [ "$INSTALL_ACTION" = 'update' ] && [ -n "$(env_value MCRAFTR_ADMIN_PASS)" ] && [ "$(env_value MCRAFTR_ADMIN_PASS)" != 'replace-me' ]; then
  password_default='1'
fi

generated_password=''

password_mode="$(choose_password_action "$password_default")"

case "$password_mode" in
  1)
    if [ "$password_default" = '1' ]; then
      admin_password="$(env_value MCRAFTR_ADMIN_PASS)"
      generated_password=''
    else
      generated_password="$(random_base64url 18)"
      admin_password="$generated_password"
    fi
    ;;
  2)
    if [ "$password_default" = '1' ]; then
      generated_password="$(random_base64url 18)"
      admin_password="$generated_password"
    else
      admin_password="$(prompt_secret 'Admin password')"
      generated_password=''
    fi
    ;;
  3)
    admin_password="$(prompt_secret 'Admin password')"
    generated_password=''
    ;;
esac

set_key MCRAFTR_ADMIN_USER "$admin_email"
set_key MCRAFTR_ADMIN_PASS "$admin_password"
set_key MCRAFTR_BIND_PORT "$port"
set_key MCRAFTR_ALLOW_PRIVATE_RCON_HOSTS 'true'

public_mode='false'
browser_url=''

case "$mode" in
  local)
    set_key NEXTAUTH_URL "http://localhost:$port"
    set_key MCRAFTR_BIND_HOST '127.0.0.1'
    set_key SITE_DOMAIN ''
    set_key LETSENCRYPT_EMAIL ''
    browser_url="http://localhost:$port"
    ;;
  private)
    private_host_hint
    private_default_host="$(host_from_url "$(existing_or_default NEXTAUTH_URL "http://100.64.0.1:$port")")"
    private_default_host="${private_default_host%:$port}"
    private_host="$(prompt 'Private IP or hostname to open Mcraftr on' "$private_default_host")"
    set_key NEXTAUTH_URL "http://$private_host:$port"
    set_key MCRAFTR_BIND_HOST "$private_host"
    set_key SITE_DOMAIN ''
    set_key LETSENCRYPT_EMAIL ''
    browser_url="http://$private_host:$port"
    ;;
  lan)
    lan_default_host="$(host_from_url "$(existing_or_default NEXTAUTH_URL "http://192.168.1.50:$port")")"
    lan_default_host="${lan_default_host%:$port}"
    lan_host="$(prompt 'LAN IP or hostname to open Mcraftr on' "$lan_default_host")"
    set_key NEXTAUTH_URL "http://$lan_host:$port"
    set_key MCRAFTR_BIND_HOST '0.0.0.0'
    set_key SITE_DOMAIN ''
    set_key LETSENCRYPT_EMAIL ''
    browser_url="http://$lan_host:$port"
    ;;
  public)
    domain="$(prompt 'Public domain' "$(existing_or_default SITE_DOMAIN mcraftr.example.com)")"
    email="$(prompt "Let's Encrypt email" "$(existing_or_default LETSENCRYPT_EMAIL you@example.com)")"
    set_key NEXTAUTH_URL "https://$domain"
    set_key MCRAFTR_BIND_HOST '127.0.0.1'
    set_key SITE_DOMAIN "$domain"
    set_key LETSENCRYPT_EMAIL "$email"
    public_mode='true'
    browser_url="https://$domain"
    ;;
esac

printf '\nStarting Mcraftr...\n'
start_services "$public_mode"
print_final_summary "$browser_url" "$admin_email" "$generated_password"
