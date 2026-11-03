# Incident Response Runbook

## 1. Severity

| Level    | Example                                                           | Target response         |
| -------- | ----------------------------------------------------------------- | ----------------------- |
| Critical | Admin compromise, database exfiltration, destructive access       | Immediate containment   |
| High     | Auth bypass, upload execution, exposed secret                     | Same day                |
| Medium   | Sustained spam/DoS, rate-limit failure, suspicious admin activity | Within one business day |
| Low      | Misconfiguration without confirmed impact                         | Normal maintenance      |

## 2. First actions

1. Record time, reporter, symptoms, affected URLs/accounts, and current scope.
2. Do not destroy evidence. Preserve relevant logs, audit rows, uploads, and snapshots.
3. If admin compromise is possible:
   - disable the affected admin account
   - revoke all admin sessions
   - rotate the admin password and MFA secret
   - review `/admin/audit`
4. If a secret is exposed:
   - rotate the affected key immediately
   - remove it from deployment history and restart services
   - check provider usage (Anthropic, Resend, exchange-rate, backup storage)
5. If data integrity is uncertain, stop writes and take a fresh backup before recovery.
6. If the application is unavailable or unsafe, put it behind maintenance/Cloudflare and notify the client.

## 3. Containment commands

```bash
# Stop the app
sudo systemctl stop golanka

# Inspect service and Caddy logs
sudo journalctl -u golanka --since "2 hours ago"
sudo journalctl -u caddy --since "2 hours ago"

# Revoke sessions from the admin UI or directly with an authorized admin account.
# Database access requires the migration/owner role; never paste credentials into chat.
```

## 4. Recovery

1. Deploy the last known-good release.
2. Restore the database and media from encrypted backups into an isolated environment first.
3. Verify schema, row counts, application health, admin login, booking access, and upload access.
4. Restore production only after verification.
5. Re-run the security checklist and affected tests.
6. Monitor failed logins, 5xx rates, queue/backups, and AI/email spend.

## 5. Notification

- Notify the client contact and site owner promptly.
- If personal data was affected, follow legal advice on user notification and regulatory obligations.
- Do not publicly speculate about scope; provide confirmed facts only.

## 6. Post-incident

Write a postmortem covering:

- timeline
- root cause
- affected data/systems
- detection gap
- containment and recovery times
- corrective actions with owners and dates
- new tests or monitoring

## 7. Contacts

Replace these before launch:

- Client owner: TODO
- Technical owner: TODO
- Hosting provider: Contabo
- DNS/WAF: Cloudflare
- Email provider: Resend
- Backup provider: TODO
- Legal/privacy adviser: TODO
