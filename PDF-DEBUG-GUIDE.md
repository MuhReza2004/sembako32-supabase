# PDF Generation Debugging Checklist

## After applying fixes, check Vercel logs for these patterns:

### Expected Log Flow:
```
[INVOICE] Processing: INV/S32/2026/02/0003
[INVOICE] HTML length: XXXXX characters
[INVOICE] Items count: 2
[INVOICE] Setting HTML content...
[INVOICE] HTML content set
[INVOICE] DOM ready check passed
[INVOICE] Waiting for fonts...
[INVOICE] Font wait completed
[INVOICE] Running debug checks...
[PDF DEBUG] INV/S32/2026/02/0003: { ... }
[INVOICE] Final stability check...
[INVOICE] Final check before PDF: { contentLength: XXXX, tableCount: 1, hasInvoiceElement: true }
[INVOICE] Starting PDF generation...
[INVOICE] Starting PDF generation... (after reflow)
[INVOICE] PDF generated successfully: XXXXX bytes
```

## Critical Debug Info to Check:

### 1. Debug Output Should Show:
- ✅ `contentLength: > 500`
- ✅ `tableCount: > 0`
- ✅ `tableRowsCount: 2` (matching items count)
- ✅ `visibleElements.table: true`
- ✅ `visibleElements.customerSection: true`
- ✅ `hasContent: true`

### 2. PDF Size Check:
- ✅ Should be > 10,000 bytes for a normal invoice
- ❌ If < 5,000 bytes → content is missing
- ❌ If 0 bytes → PDF generation completely failed

### 3. What to Look For If Still Broken:

**If Content Not Found:**
```
[INVOICE] CRITICAL: Content not found in rendered page!
[INVOICE] CRITICAL: No tables found in rendered HTML!
```
→ This means HTML is not being rendered into the page

**If Timeout Errors:**
```
Error: Failed to set page content: timeout...
```
→ Increase `timeout` value in `page.setContent()`

**If Font Errors:**
```
[INVOICE] Font wait had issues (continuing): ...
```
→ This is OK - fonts not critical, should continue to PDF

## Quick Test Commands:

### 1. Test via curl:
```bash
curl -X POST http://localhost:3000/api/generate-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "no_invoice": "INV/TEST/2026/02/0001",
    "namaPelanggan": "Test Customer",
    "items": [{"namaProduk": "Product 1", "qty": 1, "harga": 100000}],
    "total_akhir": 100000
  }' > test.pdf
```

### 2. Check PDF was created:
```bash
ls -lh test.pdf
file test.pdf
```

### 3. Open and verify content:
```bash
# Open in PDF viewer or online tool
# Check if data appears
```

## If Still Not Working:

1. Check browser DevTools → Network → inspect request/response
2. Download generated PDF → check with pdfinfo command
3. Compare PDF size before/after fixes
4. Check Vercel environment:
   - `PUPPETEER_EXEC_PATH` set correctly?
   - Memory limit sufficient?
   - Timeout not being hit?

## Recent Changes:
- ✅ Enhanced `waitForPdfFonts()` with DOM content checks
- ✅ Better `page.setContent()` with proper wait conditions
- ✅ Aggressive content verification before PDF generation
- ✅ Comprehensive logging at each step
- ✅ Improved error handling with detailed messages
- ✅ Added final PDF size validation
