# PDF Generation Issues - Solusi

## Masalah
Data PDF tidak muncul meskipun status HTTP 200 dan data tersedia di log Vercel.

## Root Cause
1. **Timing Issue di Puppeteer Serverless**: Di environment Vercel, Puppeteer terlalu cepat melakukan PDF rendering sebelum DOM selesai di-render
2. **Font Loading Race Condition**: Font custom (PdfFont) tidak siap sebelum PDF generation dimulai
3. **Insufficient Wait Conditions**: `waitUntil: "networkidle0"` saja tidak cukup untuk memastikan semua content ter-render dengan proper

## Solusi yang Diterapkan

### 1. Enhanced `waitForPdfFonts()` Function
File: `lib/pdf-fonts.ts`

```typescript
// Menambahkan:
- DOM content check (memastikan table dan text ada)
- Extra delay 1000ms untuk serverless environment
- Better error handling dengan fallback
```

### 2. Improved `page.setContent()` Options
File: `app/api/generate-invoice/route.ts`

```typescript
// Menggunakan multiple wait conditions
await page.setContent(htmlContent, { 
  waitUntil: ["load", "networkidle0", "domcontentloaded"],
  timeout: 30000 
});
```

### 3. Additional Rendering Stability
- Force reflow dengan `document.body.offsetHeight`
- Extra 500ms setTimeout untuk async rendering
- Comprehensive logging untuk debugging

### 4. Debug Utilities
File: `lib/pdf-debug.ts`

Fungsi untuk mengecek:
- Content length dan visibility
- Element count (table, paragraph, div)
- Font family yang ter-load
- Specific section visibility

## Testing

Untuk verify masalah sudah teratasi:

1. **Check Logs di Vercel**
   ```
   "Setting page content for invoice: INV/S32/2026/02/0003"
   "Page content set, starting font wait..."
   "Font wait completed"
   "[PDF DEBUG] INV/S32/2026/02/0003: { ... }"
   "Starting PDF generation..."
   "PDF generated, size: XXXXX bytes"
   ```

2. **Verify PDF Content**
   - Download PDF dari endpoint
   - Pastikan semua data terlihat (customer, items, total)

3. **Check Debug Info di Console**
   - `bodyTextLength` harus > 500
   - `tableCount` harus > 0
   - `hasContent` harus true
   - `visibleElements.table` harus true

## Perubahan File

### Modified Files:
- ✅ `lib/pdf-fonts.ts` - Enhanced waitForPdfFonts()
- ✅ `app/api/generate-invoice/route.ts` - Better content setting & waiting
- ✅ Created `lib/pdf-debug.ts` - Debug utilities

### Next Steps (Optional):
1. Apply same fix ke endpoint lain:
   - `app/api/generate-receipt/route.ts`
   - `app/api/generate-sales-report/route.ts`
   - `app/api/generate-purchase-report/route.ts`
   - dll

2. Monitor Vercel logs untuk confirm PDF size reasonable
3. If issues persist, check Vercel environment variables
   - `PUPPETEER_EXEC_PATH`
   - `AWS_EXECUTION_ENV`

## Prevention
- Selalu gunakan multiple `waitUntil` options
- Tambahkan extra delay untuk serverless environment
- Implement proper error logging & debugging
- Test di Vercel environment, bukan hanya local
