# TODO: Fix Penjualan Invoice Duplicate Key Error (Production Race Condition)

## Status: [ ] In Progress

## Steps (Follow order):

### 1. [ ] Database Migration

- Edit `supabase-schema.sql`: Add sequence + trigger for atomic invoice numbering
- Run migration in Supabase dashboard

### 2. [ ] Update Service Layer `app/services/penjualan.service.ts`

- Replace `generateInvoiceNumber()` with atomic version
- Add retry logic (3 attempts) in `createPenjualan()`
- Auto-generate if `no_invoice` empty

### 3. [ ] Update Form `components/penjualan/PenjualanForm.tsx`

- Remove useEffect auto-generation (prevents race condition)
- Add manual "Generate" button option
- Improve error feedback

### 4. [ ] Testing

- [ ] Local: Open 3 tabs → create simultaneously → verify unique invoices
- [ ] Production: Deploy → test concurrent creation

### 5. [ ] Verification

- [ ] Check Supabase logs for 23505 errors
- [ ] Confirm works for multi-user

## Current Step: 1 - Database Migration
