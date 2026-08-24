---
title: What happens when a renewal payment fails
keywords: failed payment, payment fails, declined, retry, retries, dunning, overdue, past due
---

## Short answer
The renewal is retried three times over ten days before the subscription is suspended.

## What happens
1. The failed charge marks the subscription as overdue
2. The customer is emailed and asked to update their payment method
3. The charge is retried on day three, day seven, and day ten
4. If all three retries fail, the subscription is suspended and access stops

## Edge cases
- A successful retry clears the overdue state and the period continues unchanged
- Updating the payment method triggers an immediate retry rather than waiting for the next scheduled one
- A customer who cancels while overdue is cancelled at once, with no further retries
