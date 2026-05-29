"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Search,
  X,
  History,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ArrowLeft,
  Receipt,
} from "lucide-react";

export default function HalamanRiwayatGlobal() {
  const supabase = createClient();

  // State Manajemen Data Utama (Riwayat Nota)
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cariId, setCariId] = useState("");

  // State Fitur Sorting
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  // State untuk Inspektur Detail Nota
  const [transaksiTerpilih, setTransaksiTerpilih] = useState(null);
  const [itemsNota, setItemsNota] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [bukaInspekturMobile, setBukaInspekturMobile] = useState(false);

  // State CUSTOM MODAL FORM RETUR (Pengganti window.prompt & alert)
  const [modalReturTerbuka, setModalReturTerbuka] = useState(false);
  const [itemMauDiretur, setItemMauDiretur] = useState(null);
  const [jumlahReturInput, setJumlahReturInput] = useState(1);
  const [alasanReturInput, setAlasanReturInput] = useState("");
  const [suksesNotif, setSuksesNotif] = useState(null);

  const muatSemuaRiwayat = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("transaksi").select(`
          id, created_at, total_harga, metode_pembayaran, uang_diterima, uang_kembalian
        `);
      if (!error && data) setRiwayat(data);
    } catch (err) {
      console.error("Gagal memuat riwayat transaksi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    muatSemuaRiwayat();
  }, []);

  const handleSort = (field) => {
    const order = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(order);
  };

  const cekDetailNota = async (trx) => {
    setTransaksiTerpilih(trx);
    setLoadingItems(true);
    setBukaInspekturMobile(true); // Aktifkan drawer geser di mobile

    try {
      const { data: dataDetail, error: errDetail } = await supabase
        .from("detail_transaksi")
        .select(
          `id, produk_id, jumlah, harga_satuan, subtotal, produk:produk_id ( nama_produk, stok )`,
        )
        .eq("transaksi_id", trx.id);

      const { data: dataRetur, error: errRetur } = await supabase
        .from("retur_transaksi")
        .select("produk_id, jumlah")
        .eq("transaksi_id", trx.id);

      if (!errDetail && dataDetail) {
        const itemTerintegrasi = dataDetail.map((item) => {
          const totalTerretur = dataRetur
            ? dataRetur
                .filter((r) => r.produk_id === item.produk_id)
                .reduce((acc, curr) => acc + curr.jumlah, 0)
            : 0;

          return {
            ...item,
            jumlah_retur_tercatat: totalTerretur,
            jumlah_bisa_diretur: item.jumlah - totalTerretur,
          };
        });
        setItemsNota(itemTerintegrasi);
      }
    } catch (err) {
      console.error("Gagal membaca isi nota:", err);
    } finally {
      setLoadingItems(false);
    }
  };

  // Trigger Modal Dialog Form Pengganti Prompt Browser
  const bukaFormReturCustom = (item) => {
    if (item.jumlah_bisa_diretur <= 0) return;
    setItemMauDiretur(item);
    setJumlahReturInput(1);
    setAlasanReturInput("");
    setModalReturTerbuka(true);
  };

  // Fungsi Final Submit Pemrosesan Retur ke Database Cloud
  const eksekusiSimpanRetur = async (e) => {
    e.preventDefault();
    if (
      jumlahReturInput < 1 ||
      jumlahReturInput > itemMauDiretur.jumlah_bisa_diretur
    )
      return;
    if (!alasanReturInput.trim()) return;

    setLoadingItems(true);
    setModalReturTerbuka(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 1. Tarik stok saat ini dari database
      const { data: produkSaatIni } = await supabase
        .from("produk")
        .select("stok")
        .eq("id", itemMauDiretur.produk_id)
        .single();

      // 2. Kembalikan kuantitas fisik barang ke inventory gudang
      const stokBaru =
        Number(produkSaatIni?.stok || 0) + Number(jumlahReturInput);
      await supabase
        .from("produk")
        .update({ stok: stokBaru })
        .eq("id", itemMauDiretur.produk_id);

      // 3. Kalkulasi total dana kembalian proporsional
      const uangDikembangkan =
        jumlahReturInput * Number(itemMauDiretur.harga_satuan);

      // 4. Inject ke log tabel pembukuan retur
      await supabase.from("retur_transaksi").insert([
        {
          transaksi_id: transaksiTerpilih.id,
          produk_id: itemMauDiretur.produk_id,
          jumlah: jumlahReturInput,
          subtotal_retur: uangDikembangkan,
          alasan: alasanReturInput,
          kasir_id: user?.id,
        },
      ]);

      // Munculkan Banner Notifikasi Sukses Custom di Sisi Atas Layar
      setSuksesNotif({
        nama: itemMauDiretur.produk?.nama_produk,
        qty: jumlahReturInput,
        nominal: uangDikembangkan,
      });

      setTransaksiTerpilih(null);
      setBukaInspekturMobile(false);
      muatSemuaRiwayat();
    } catch (err) {
      console.error(err);
      alert(`Gagal memproses retur: ${err.message}`);
    } finally {
      setLoadingItems(false);
    }
  };

  const riwayatDifilterDanDiurutkan = riwayat
    .filter((r) => r.id.toString().includes(cariId))
    .sort((a, b) => {
      if (!sortField) return 0;
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "id" || sortField === "total_harga") {
        valA = Number(valA);
        valB = Number(valB);
      } else if (sortField === "created_at") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
      }

      if (sortOrder === "asc") return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] w-full bg-slate-100 text-slate-800 font-sans p-4 md:p-6 overflow-hidden relative">
      {/* 🔔 CUSTOM HUD BANNER SUCCESS NOTIFICATION (PENGGANTI WINDOW ALERT) */}
      {suksesNotif && (
        <div className="fixed top-16 inset-x-4 lg:left-auto lg:right-6 lg:w-96 bg-slate-950 text-white p-4 rounded-xl shadow-2xl border border-slate-800 z-50 flex items-start space-x-3 animate-in slide-in-from-top-4 duration-200">
          <div className="p-1.5 bg-emerald-500 rounded-lg text-slate-950 flex-shrink-0">
            ✓
          </div>
          <div className="flex-1 text-xs">
            <p className="font-black uppercase tracking-wide text-emerald-400">
              Faktur Retur Diterbitkan
            </p>
            <p className="text-slate-300 mt-1 font-medium">
              Sukses memproses pengembalian{" "}
              <b>
                {suksesNotif.qty} pcs {suksesNotif.nama}
              </b>
              .
            </p>
            <p className="text-slate-400 mt-2 text-[11px]">
              Silakan serahkan dana pelanggan sebesar:{" "}
              <b className="text-white font-mono text-xs">
                Rp {suksesNotif.nominal.toLocaleString("id-ID")}
              </b>
            </p>
          </div>
          <button
            onClick={() => setSuksesNotif(null)}
            className="text-slate-500 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= SISI KIRI: TABEL JURNAL NOTA GLOBAL ================= */}
      <div className="flex-1 bg-white rounded-2xl shadow-3xs border border-slate-200 p-4 md:p-6 flex flex-col h-full overflow-hidden lg:mr-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 flex-shrink-0 gap-3">
          <div>
            <h1 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight">
              Riwayat Pembelian Global
            </h1>
          </div>
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Nomor ID Transaksi..."
              className="p-2.5 pl-9 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none w-full sm:w-56 bg-slate-50 shadow-3xs"
              value={cariId}
              onChange={(e) => setCariId(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-100">
          {loading ? (
            <p className="p-12 text-center text-xs font-bold text-slate-400">
              Menyelaraskan basis data riwayat transaksi...
            </p>
          ) : riwayatDifilterDanDiurutkan.length === 0 ? (
            <p className="p-12 text-center text-xs text-slate-400">
              Tidak ada log data transaksi ditemukan.
            </p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 font-bold text-[10px] uppercase text-slate-400 tracking-wider shadow-3xs z-10">
                <tr className="border-b border-slate-200">
                  <th
                    className="p-3.5 pl-4 cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("id")}
                  >
                    ID{" "}
                    {sortField === "id"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th
                    className="p-3.5 cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("created_at")}
                  >
                    Waktu{" "}
                    {sortField === "created_at"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th
                    className="p-3.5 text-right cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("total_harga")}
                  >
                    Total{" "}
                    {sortField === "total_harga"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th className="p-3.5 text-center hidden sm:table-cell">
                    Metode
                  </th>
                  <th className="p-3.5 text-center pr-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-700">
                {riwayatDifilterDanDiurutkan.map((trx) => (
                  <tr
                    key={trx.id}
                    className={`hover:bg-slate-50 transition-colors ${transaksiTerpilih?.id === trx.id ? "bg-slate-100/70" : ""}`}
                  >
                    <td className="p-3.5 pl-4 font-mono text-slate-900 font-bold">
                      #{trx.id}
                    </td>
                    <td className="p-3.5 text-slate-500 font-medium">
                      {new Date(trx.created_at).toLocaleDateString("id-ID")} -{" "}
                      {new Date(trx.created_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900">
                      Rp {trx.total_harga.toLocaleString("id-ID")}
                    </td>
                    <td className="p-3.5 text-center hidden sm:table-cell">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${trx.metode_pembayaran === "Tunai" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                      >
                        {trx.metode_pembayaran}
                      </span>
                    </td>
                    <td className="p-3.5 text-center pr-4">
                      <button
                        onClick={() => cekDetailNota(trx)}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] px-2.5 py-1.5 rounded-lg shadow-3xs transition-all cursor-pointer uppercase tracking-wider"
                      >
                        Periksa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ================= SISI KANAN: INSPEKTUR DETAIL NOTA (MOBILE FRIENDLY DRAWER STACK) ================= */}
      <div
        className={`fixed lg:static inset-y-0 right-0 z-40 w-5/6 sm:w-1/2 lg:w-80 bg-white border-l border-slate-200 p-4 md:p-5 flex flex-col h-full overflow-hidden shadow-2xl lg:shadow-3xs transition-transform duration-300 transform ${bukaInspekturMobile ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex items-center justify-between flex-shrink-0 mb-3 border-b border-slate-100 pb-2">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Receipt className="h-4 w-4" /> Inspektur Detail Nota
          </h2>
          {/* Tombol Back Hanya Muncul di HP/Mobile */}
          <button
            onClick={() => setBukaInspekturMobile(false)}
            className="lg:hidden p-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 font-bold text-xs flex items-center space-x-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali</span>
          </button>
        </div>

        {transaksiTerpilih ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white p-3.5 rounded-xl mb-3.5 text-xs font-semibold flex-shrink-0 shadow-md">
              <p className="text-[9px] text-slate-400 font-mono">
                ID INVOICE: #{transaksiTerpilih.id}
              </p>
              <p className="text-base font-black mt-0.5 text-emerald-400 font-mono">
                Rp{" "}
                {Number(transaksiTerpilih.total_harga).toLocaleString("id-ID")}
              </p>
            </div>

            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
              Item Terjual:
            </h3>

            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {loadingItems ? (
                <p className="text-center text-xs font-bold text-slate-400 py-8 animate-pulse">
                  Menghubungkan rekam akuntansi...
                </p>
              ) : (
                itemsNota.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-50 border border-slate-200/70 p-3 rounded-xl flex flex-col space-y-2 shadow-3xs"
                  >
                    <div className="flex justify-between text-xs font-bold">
                      <span
                        className="text-slate-900 truncate max-w-[130px]"
                        title={item.produk?.nama_produk}
                      >
                        {item.produk?.nama_produk || "Barang Terhapus"}
                      </span>
                      <span className="text-slate-950 font-mono">
                        Rp {Number(item.subtotal).toLocaleString("id-ID")}
                      </span>
                    </div>

                    <div className="flex justify-between items-end text-[10px]">
                      <div className="text-slate-400 font-semibold space-y-0.5">
                        <p>
                          {item.jumlah} pcs x Rp{" "}
                          {Number(item.harga_satuan).toLocaleString("id-ID")}
                        </p>
                        {item.jumlah_retur_tercatat > 0 && (
                          <p className="text-rose-600 font-black bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 inline-block mt-0.5">
                            ⚠️ Diretur: {item.jumlah_retur_tercatat} pcs
                          </p>
                        )}
                      </div>

                      {item.jumlah_bisa_diretur > 0 ? (
                        <button
                          onClick={() => bukaFormReturCustom(item)}
                          className="text-rose-600 hover:text-white border border-rose-200 hover:bg-rose-600 font-black text-[9px] px-2 py-1 rounded-md transition-all uppercase tracking-wide cursor-pointer"
                        >
                          Retur
                        </button>
                      ) : (
                        <span className="text-[9px] bg-rose-100 text-rose-700 font-black px-1.5 py-0.5 rounded border border-rose-200 uppercase">
                          Lunas Retur
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 border-2 border-dashed border-slate-200 rounded-xl flex flex-col justify-center items-center text-center p-4 text-slate-400 text-xs font-bold space-y-2 bg-slate-50/50">
            <p>🔍 Nota belum dipilih.</p>
            <p className="text-[9px] font-medium text-slate-300">
              Klik tombol "Periksa" pada salah satu baris riwayat di sebelah
              kiri.
            </p>
          </div>
        )}
      </div>

      {bukaInspekturMobile && (
        <div
          onClick={() => setBukaInspekturMobile(false)}
          className="lg:hidden fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-xs"
        />
      )}

      {/* ======================= 🛠️ MODAL POP-UP CUSTOM FORM DIALOG RETUR ======================= */}
      {modalReturTerbuka && itemMauDiretur && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={eksekusiSimpanRetur}
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Form Pengembalian Barang
                </h3>
                <p className="text-[9px] text-slate-400 font-bold truncate max-w-[220px]">
                  Item: {itemMauDiretur.produk?.nama_produk}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalReturTerbuka(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs font-semibold">
              {/* Counter Kuantitas Retur */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Jumlah yang diretur (Pcs):
                </label>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50 h-9">
                    <button
                      type="button"
                      onClick={() =>
                        setJumlahReturInput((prev) => Math.max(prev - 1, 1))
                      }
                      className="px-3 font-black text-sm text-slate-500 hover:bg-slate-100"
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-black text-sm text-slate-800">
                      {jumlahReturInput}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setJumlahReturInput((prev) =>
                          Math.min(
                            prev + 1,
                            itemMauDiretur.jumlah_bisa_diretur,
                          ),
                        )
                      }
                      className="px-3 font-black text-sm text-slate-500 hover:bg-slate-100"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Maksimal sisa beli: {itemMauDiretur.jumlah_bisa_diretur} pcs
                  </span>
                </div>
              </div>

              {/* Input Alasan */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Alasan Retur / Kerusakan *
                </label>
                <textarea
                  required
                  placeholder="Contoh: Barang cacat robek atau salah beli varian makanan..."
                  rows={2}
                  value={alasanReturInput}
                  onChange={(e) => setAlasanReturInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 text-xs bg-slate-50/50 font-medium"
                />
              </div>

              {/* Live Preview Dana Dikembalikan */}
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex justify-between items-center text-[10px] font-black text-rose-700">
                <span>DANA REFUND PELANGGAN:</span>
                <span className="font-mono text-xs">
                  Rp{" "}
                  {(
                    jumlahReturInput * Number(itemMauDiretur.harga_satuan)
                  ).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex space-x-2 flex-shrink-0 text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalReturTerbuka(false)}
                className="w-1/3 py-2 border border-slate-200 bg-white rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-2/3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md uppercase tracking-wider font-black text-[10px] cursor-pointer"
              >
                Konfirmasi Nota Retur
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
