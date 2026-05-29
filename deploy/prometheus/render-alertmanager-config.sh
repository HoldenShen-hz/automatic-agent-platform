#!/bin/sh
set -eu

TEMPLATE_PATH="${ALERTMANAGER_TEMPLATE_PATH:-/etc/alertmanager/alertmanager.yml.tmpl}"
OUTPUT_PATH="${ALERTMANAGER_RENDERED_PATH:-/tmp/alertmanager.yml}"

: "${SLACK_WEBHOOK_URL:?SLACK_WEBHOOK_URL is required}"
: "${PAGERDUTY_SERVICE_KEY:?PAGERDUTY_SERVICE_KEY is required}"

sed \
  -e "s|__SLACK_WEBHOOK_URL__|${SLACK_WEBHOOK_URL}|g" \
  -e "s|__PAGERDUTY_SERVICE_KEY__|${PAGERDUTY_SERVICE_KEY}|g" \
  "${TEMPLATE_PATH}" > "${OUTPUT_PATH}"

exec /bin/alertmanager --config.file="${OUTPUT_PATH}"
