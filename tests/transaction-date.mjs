import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
function load(file, mocks) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: (id) => {
    assert.ok(id in mocks, `Unexpected import ${id}`);
    return mocks[id];
  }, console });
  return exports;
}
(async () => {
  const calls = [];
  let error = null;
  const service = load("app/services/penjualan.service.ts", {
    "@/app/lib/supabase": { supabase: { rpc: async (name, args) => {
      calls.push({ name, args });
      return { error };
    } } },
    "@/helper/format": {},
  });
  for (const value of ["", "2026-02-30", "2025-02-29", "invalid", "2026-1-01"]) {
    await assert.rejects(service.updateTanggalPenjualan("sale", value), /Tanggal transaksi tidak valid/);
  }
  assert.equal(calls.length, 0);
  await service.updateTanggalPenjualan("sale", "2024-02-29");
  assert.equal(calls[0].name, "update_tanggal_penjualan");
  assert.equal(calls[0].args.p_penjualan_id, "sale");
  assert.equal(calls[0].args.p_tanggal, "2024-02-29");
  error = { message: "Hanya admin" };
  await assert.rejects(service.updateTanggalPenjualan("sale", "2026-11-03"), /Hanya admin/);
  const pdf = load("lib/pdf/penjualan-data.ts", { "@/lib/supabase-admin": {} });
  const sale = { tanggal: "2024-02-29", no_invoice: "INV/S32/2026/11/0001", items: [] };
  const result = pdf.toDeliveryOrderPdfData(sale, { no_do: "DO/old", no_tanda_terima: "TT/old" });
  assert.equal(result.penjualan.tanggal, sale.tanggal);
  assert.equal(result.penjualan.no_invoice, sale.no_invoice);
  assert.equal(result.no_do, "DO/old");
  assert.equal(result.no_tanda_terima, "TT/old");
  console.log("Transaction date: validation, RPC errors, and DO/BAST date propagation passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
