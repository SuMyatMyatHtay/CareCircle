# Email OTP password reset

The login page links to `/forgot-password`. Users enter their email at `/forgot-password`, verify the OTP at `/forgot-password/verify`, then choose a new password at `/forgot-password/new-password`. Password fields appear only after server verification. Refreshing a later page restarts recovery; the verification token stays only in memory. Resetting does not log them in automatically.

## Email delivery setup

1. Create a Resend account and an API key with sending permission.
2. Verify a sending domain in Resend and choose an address on that domain.
3. Add these settings to `server/.env` and restart the backend:

```dotenv
RESEND_API_KEY=re_your_key
PASSWORD_RESET_FROM="CareCircle <noreply@your-verified-domain.com>"
```

The existing `JWT_SECRET` must also be configured. Keep all credentials on the server. No frontend email API key is needed. No emails are sent until delivery is configured. Resend's test sender restricts recipients; use a verified domain for real users.

Provider reference: https://resend.com/docs/api-reference/emails/send-email

## Endpoints

- `POST /auth/forgot-password`: `{ "email": "user@example.com" }`. Returns the same success message for existing and unknown accounts. A provider delivery failure also returns this generic message to avoid revealing account existence; the server logs a message without the code, address or credentials. Missing provider configuration returns 503.
- `POST /auth/verify-reset-code`: `{ "email": "user@example.com", "code": "012345" }`. Consumes the OTP and returns a single-use `resetToken` valid for five minutes. It does not change the password.
- `POST /auth/reset-password`: `{ "email": "user@example.com", "resetToken": "token-from-verification", "password": "new-password", "confirmPassword": "new-password" }`. Invalid, expired, used and exhausted codes return 400. Password requirements match registration (8–128 characters).

Codes have six digits, expire after ten minutes and allow five verification attempts. Only a keyed hash is stored, excluded from normal user queries. Resending has a durable 60-second per-account cooldown and invalidates the prior code. Code consumption and password changes are atomic. Successful resets increment `tokenVersion`, revoking existing sessions. All three endpoints share an additional per-process IP limit of 30 requests per 15 minutes; a multi-instance deployment should also enforce a shared gateway rate limit.

## Verification

```sh
node --test tests/unit/password-reset.test.mjs
npm run test --prefix client -- src/features/auth/__tests__/ForgotPasswordView.spec.js
```

These tests mock delivery and storage; they do not send email. To test delivery after configuration, request a code for an existing account, check its inbox, reset the password, then verify the new password works and the old password/session no longer does.

If mail does not arrive, check the Resend email logs and domain verification. A sender mailbox does not need to exist, but you must own and verify its domain. For testing without a domain, `CareCircle <onboarding@resend.dev>` can send only to the email registered with your Resend account. Do not use `carecircle.com` unless you control it. Provider rejection status and category are logged without email addresses, codes or credentials.
