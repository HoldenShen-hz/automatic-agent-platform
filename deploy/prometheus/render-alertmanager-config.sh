#!/bin/sh
set -eu

TEMPLATE_PATH="${ALERTMANAGER_TEMPLATE_PATH:-/etc/alertmanager/alertmanager.yml.tmpl}"
OUTPUT_PATH="${ALERTMANAGER_RENDERED_PATH:-/tmp/alertmanager.yml}"

: "${SLACK_WEBHOOK_URL:?SLACK_WEBHOOK_URL is required}"
: "${PAGERDUTY_SERVICE_KEY:?PAGERDUTY_SERVICE_KEY is required}"

escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[\/&|\\]/\\&/g'
}

SLACK_WEBHOOK_URL_ESCAPED="$(escape_sed_replacement "${SLACK_WEBHOOK_URL}")"
PAGERDUTY_SERVICE_KEY_ESCAPED="$(escape_sed_replacement "${PAGERDUTY_SERVICE_KEY}")"

sed \
  -e "s|__SLACK_WEBHOOK_URL__|${SLACK_WEBHOOK_URL_ESCAPED}|g" \
  -e "s|__PAGERDUTY_SERVICE_KEY__|${PAGERDUTY_SERVICE_KEY_ESCAPED}|g" \
  "${TEMPLATE_PATH}" > "${OUTPUT_PATH}"
chmod 600 "${OUTPUT_PATH}"

exec /bin/alertmanager --config.file="${OUTPUT_PATH}"
