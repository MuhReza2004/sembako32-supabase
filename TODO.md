# TODO: Implement Piutang Feature

## Current Status

- Services: getPiutang and addPiutangPayment functions added to penjualan.service.ts
- Components: PiutangTable.tsx and DialogBayarPiutang.tsx created
- Page: app/dashboard/admin/transaksi/piutang/page.tsx updated to fetch and display piutang data

## Remaining Tasks

- [x] Update app/dashboard/admin/transaksi/piutang/page.tsx to fetch and display piutang data
- [x] Add state management for piutang data and refresh on payment success
- [ ] Ensure Firebase index is created for the query (status == "Belum Lunas", orderBy createdAt desc)
- [ ] Test the payment flow and status update logic
