# Making Redbird FCU More Realistic

This project already has a strong simulation base (member/staff roles, account workflows, transaction ledger entries, mobile deposits, and audit logs). This checklist focuses on improvements that make behavior feel closer to a real credit union.

## 1) Add pending/posted transaction lifecycle
- Introduce states like `pending`, `posted`, `reversed`, and `returned` for ACH/card-style behavior.
- Keep **available balance** and **current balance** separate on accounts.
- Add nightly/batch posting logic to convert pending entries to posted entries.

Why: Real institutions rarely settle every movement instantly.

## 2) Add holds and release dates
- Add table/fields for holds (mobile deposit holds, large transfer holds, fraud holds).
- Include hold reason, amount, createdAt, releaseAt, and releasedBy.

Why: Funds availability windows are one of the biggest realism signals in retail banking.

## 3) Build statement periods and downloadable statements
- Add monthly statement snapshots (opening balance, debits, credits, ending balance).
- Create PDF (or simple HTML export) statements with account masking and disclosures.
- Let members filter transactions by statement period.

Why: Members expect statements, not just raw transaction history.

## 4) Strengthen account application underwriting
- Add debt-to-income and simple risk scoring before approving credit products.
- Add an underwriter decision reason and optional adverse action note.

Why: Realistic lending decisions need transparent rules and justification.

## 5) Add transfer rails and timing
- Distinguish internal transfer vs ACH vs wire vs card payment.
- Add rail-specific limits, fees, cut-off times, and settlement estimates.

Why: Different payment rails are central to realistic UX and operations.

## 6) Add fee engine and waivers
- Add configurable fee rules (overdraft, returned item, wire fee, expedited card).
- Support automatic waiver rules (student accounts, premium members, manual staff waiver).
- Log fee assessment + reversal as explicit transactions.

Why: Fee behavior drives many real-world transaction outcomes.

## 7) Add stronger fraud controls
- Add velocity checks (count/amount per period), device fingerprinting hints, and geolocation risk signals.
- Auto-flag suspicious activity for staff review queue.
- Add challenge step for high-risk actions.

Why: Real banks are risk engines as much as transaction processors.

## 8) Expand compliance/audit data model
- Add immutable event IDs, correlation IDs, actor type, and request metadata.
- Store KYC status (`pending`, `verified`, `rejected`) and verification timestamps.

Why: Better auditability improves both realism and maintainability.

## 9) Improve crypto realism (if kept in scope)
- Add spread/slippage and quote expiration (e.g., valid for 15 seconds).
- Add transfer network fee and confirmations for crypto sends.
- Mark unsupported jurisdictions/roles in policy rules.

Why: Fixed-price instant execution feels game-like; quote + slippage feels real.

## 10) Add customer communication events
- Trigger in-app/email notifications for postings, holds, reversals, and large transactions.
- Include staff action notices for approvals/rejections.

Why: Production systems are event-driven and communication-heavy.

---

## Suggested implementation order (high impact first)
1. Pending/posted lifecycle + available/current balances
2. Holds + funds availability rules
3. Fee engine + reversals/waivers
4. Statement generation
5. Transfer rails + settlement timing
6. Fraud checks and review queue

## Minimal schema additions to start
- `accounts`: add `availableBalance` (numeric), keep `balance` as current/ledger balance.
- `transactions`: add `rail`, `postedAt`, `effectiveDate`, `parentTransactionId`, `merchantName`, `counterparty`.
- New `holds` table: accountId, amount, reason, status, releaseAt.
- New `statements` table: accountId, periodStart, periodEnd, openingBalance, closingBalance, artifactUrl.
