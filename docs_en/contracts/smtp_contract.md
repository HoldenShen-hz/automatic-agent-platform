# SMTP Contract

## 1. Scope

This contract defines the SMTP email sending contract for the Automatic Agent platform.

## 2. Canonical Objects

- `SmtpConfig`
- `EmailMessage`
- `EmailDeliveryResult`
- `EmailBounceRecord`

## 3. `SmtpConfig` Minimum Fields

- `smtp_host`
- `smtp_port`
- `smtp_secure` (boolean)
- `smtp_user`
- `smtp_password_ref` (secret reference)
- `smtp_from_address`
- `smtp_from_name`
- `smtp_reply_to`
- `tenant_id`
- `enabled`

## 4. `EmailMessage` Minimum Fields

- `message_id`
- `to_addresses`
- `cc_addresses?`
- `bcc_addresses?`
- `subject`
- `body_html`
- `body_text`
- `attachments?`
- `headers`
- `tenant_id`
- `created_at`

## 5. `EmailDeliveryResult` Minimum Fields

- `message_id`
- `smtp_message_id`
- `status` (`sent | failed | bounced`)
- `sent_at`
- `error_detail?`

## 6. `EmailBounceRecord` Minimum Fields

- `bounce_id`
- `message_id`
- `bounce_type` (`hard | soft`)
- `bounce_reason`
- `bounced_at`
- `processed`

Rules:

- SMTP credentials must be stored in secret management, not in config files.
- Email sending must support tenant isolation.
- Bounce handling must be automated.
- Rate limiting must be per-tenant.