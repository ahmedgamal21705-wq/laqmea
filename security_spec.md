# LOKMA Firestore Security Specification

## 1. Data Invariants
1. **Role Escalation Prevention**: Users can only self-register as `student` or `provider`. Setting `role: 'admin'` or `role: 'delivery_partner'` directly, or mutating one's own `role` or `status`, is strictly forbidden.
2. **PII Isolation**: `/users/{uid}`, `/student_profiles/{uid}`, and `/delivery_partner_profiles/{uid}` can only be read by the document owner or a verified admin.
3. **Provider Ownership & Verification**: Providers cannot self-verify (`verification_status` must start as `'pending'`) and can only mutate their own `/meals/{mealId}` documents.
4. **Order Integrity & Trusted DB Pricing**:
   - Orders can only be created for `student_id == request.auth.uid`, with `status: 'pending'`, `payment_status: 'unpaid'`, `delivery_partner_id: null`.
   - Each line item in `/orders/{orderId}/items/{itemId}` MUST match the actual `price` and `provider_id` stored on `/meals/{meal_id}` in Firestore.
   - `delivery_fee` MUST match `0` (for pickup) or the trusted `/config/delivery_pricing` fee (default `15`).
   - `subtotal_amount` MUST equal the exact sum of the order's line items via `getAfter()`, and `total_amount == subtotal_amount + delivery_fee`.
5. **Order Isolation**:
   - Customers only read/list orders where `student_id == request.auth.uid`.
   - Providers only read/list orders where `provider_id == request.auth.uid`.
   - Delivery partners only read/list orders assigned to them (`delivery_partner_id == request.auth.uid`), and can only claim open offers if their `/delivery_partner_profiles/{uid}` has `verification_status == 'verified'`.
6. **Temporal Integrity**: `createdAt == request.time` on creation and `updatedAt == request.time` on updates.

## 2. Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Role Escalation on Create**: `{ "id": "u1", "role": "admin", "status": "active", ... }` -> Denied.
2. **Role Escalation on Update**: `{ "role": "admin" }` by `/users/u1` -> Denied.
3. **Self-Verification by Provider**: Creating `/provider_profiles/u1` with `verification_status: "verified"` -> Denied.
4. **Shadow/Ghost Field Injection**: Creating `/meals/m1` with extra `{ "featured_override": true }` -> Denied (`hasOnly`).
5. **Price Tampering on Order Item**: Submitting `/orders/o1/items/item_0` with `unit_price: 1` when `/meals/m1.price == 75` -> Denied.
6. **Total Tampering on Order**: Submitting `/orders/o1` with `total_amount: 10` when `subtotal_amount + delivery_fee == 90` -> Denied.
7. **Delivery Fee Tampering**: Submitting `fulfillment_type: "delivery"` with `delivery_fee: 0` -> Denied.
8. **Cross-Customer Order Read/List**: Listing `/orders` without `where('student_id', '==', auth.uid)` -> Denied.
9. **Cross-Provider Meal Modification**: Updating `/meals/m1` where `existing.provider_id != auth.uid` -> Denied.
10. **Unverified Delivery Partner Claiming Order**: Claiming `/orders/o1` when `delivery_partner_profiles/{uid}.verification_status != 'verified'` -> Denied.
11. **Terminal State Modification**: Updating an order whose existing `status` is `'delivered'` or `'cancelled'` by a non-admin -> Denied.
12. **Client Timestamp Spoofing**: Creating a document with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> Denied.
