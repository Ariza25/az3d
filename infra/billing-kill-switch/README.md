# Billing kill switch

Cloud Run function triggered by a project-scoped Google Cloud Billing budget.
When the reported monthly cost reaches the configured budget amount, it removes
the billing account from that project. This stops billable services and can make
the application unavailable. Re-enabling billing is a manual operation.

Billing notifications and enforcement are delayed, so a small overage can still
be charged. The deployed budgets use BRL 20 with alerts at 50%, 80%, and 100%.

`safe-test-message.json` exercises the Pub/Sub trigger without disabling billing.
