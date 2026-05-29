"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
  DollarSign,
  ShoppingBag,
  X,
  ArrowDownCircle,
  TrendingUp,
  Download,
  ChevronDown,
  ChevronUp,
  Trophy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function DashboardAdmin() {
  const [loading, setLoading] = useState(true);
  const [riwayatTransaksi, setRiwayatTransaksi] = useState([]);
  const [filterTanggal, setFilterTanggal] = useState("hari_ini");

  // State Fitur Sorting Tabel
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  // State Fitur Pagination (10 Data per Halaman)
  const [halamanAktif, setHalamanAktif] = useState(1);
  const [totalBarisData, setTotalBarisData] = useState(0);
  const itemPerHalaman = 10;

  // State untuk Modal Detail Item
  const [transaksiTerpilih, setTransaksiTerpilih] = useState(null);
  const [detailItem, setDetailItem] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // State UI Dropdown Produk Terlaris
  const [isDropdownTerbuka, setIsDropdownTerbuka] = useState(false);

  // State untuk Ringkasan Pembukuan Seimbang (Balance Book)
  const [ringkasan, setRingkasan] = useState({
    totalOmzetKotor: 0,
    totalRetur: 0,
    totalOmzetBersih: 0,
    totalTransaksi: 0,
    produkTerlaris: [],
  });

  // State untuk Input Rentang Tanggal Ekspor Kustom
  const [eksporMulai, setEksporMulai] = useState("");
  const [eksporSelesai, setEksporSelesai] = useState("");
  const [loadingEkspor, setLoadingEkspor] = useState(false);

  // Reset ke halaman 1 setiap kali filter tanggal diubah oleh admin
  useEffect(() => {
    setHalamanAktif(1);
    ambilDataDashboard(1);
  }, [filterTanggal]);

  // Muat ulang data ketika halaman aktif atau kolom pengurutan diubah
  useEffect(() => {
    ambilDataDashboard(halamanAktif);
  }, [halamanAktif, sortField, sortOrder]);

  const ambilDataDashboard = async (halaman) => {
    setLoading(true);
    try {
      // 1. Siapkan Filter Waktu Sinkron
      const sekarang = new Date();
      sekarang.setHours(0, 0, 0, 0);
      let batasanWaktu = null;

      if (filterTanggal === "hari_ini") {
        batasanWaktu = sekarang.toISOString();
      } else if (filterTanggal === "minggu_ini") {
        const semingguLalu = new Date(sekarang.setDate(sekarang.getDate() - 7));
        batasanWaktu = semingguLalu.toISOString();
      } else if (filterTanggal === "bulan_ini") {
        const sebulanLalu = new Date(
          sekarang.setMonth(sekarang.getMonth() - 1),
        );
        batasanWaktu = sebulanLalu.toISOString();
      }

      // 2. Hitung Batasan Indeks Range Kueri SQL (Pagination)
      const indeksMulai = (halaman - 1) * itemPerHalaman;
      const indeksSelesai = indeksMulai + itemPerHalaman - 1;

      // 3. Tarik Data Transaksi Berdasarkan Range dan Sort Terpilih
      let queryTx = supabase
        .from("transaksi")
        .select("*", { count: "exact" }) // { count: "exact" } mengembalikan total baris data asli di database
        .order(sortField, { ascending: sortOrder === "asc" })
        .range(indeksMulai, indeksSelesai);

      if (batasanWaktu) queryTx = queryTx.gte("created_at", batasanWaktu);

      const { data: dataTransaksi, error: errorTx, count } = await queryTx;
      if (errorTx) throw errorTx;

      setTotalBarisData(count || 0);

      // 4. Tarik Data Retur Transaksi untuk Menyeimbangkan Buku Rekap
      let queryRetur = supabase.from("retur_transaksi").select("*");
      if (batasanWaktu) queryRetur = queryRetur.gte("created_at", batasanWaktu);

      const { data: dataRetur, error: errorRetur } = await queryRetur;
      if (errorRetur) throw errorRetur;

      // 5. Gabungkan Data Profil Staf Kasir ke Baris Tabel
      let dataGabungan = [];
      if (dataTransaksi && dataTransaksi.length > 0) {
        const daftarKasirId = [
          ...new Set(dataTransaksi.map((t) => t.kasir_id).filter(Boolean)),
        ];
        const { data: dataProfil } = await supabase
          .from("profiles")
          .select("id, nama_lengkap")
          .in("id", daftarKasirId);

        const petaProfil = {};
        dataProfil?.forEach((p) => {
          petaProfil[p.id] = p;
        });

        dataGabungan = dataTransaksi.map((tx) => {
          const totalReturNota = dataRetur
            ? dataRetur
                .filter((r) => r.transaksi_id === tx.id)
                .reduce((acc, curr) => acc + Number(curr.subtotal_retur), 0)
            : 0;

          return {
            ...tx,
            nama_kasir:
              petaProfil[tx.kasir_id]?.nama_lengkap || "Tidak Diketahui",
            total_retur: totalReturNota,
            omzet_bersih: Number(tx.total_harga) - totalReturNota,
          };
        });
      }

      setRiwayatTransaksi(dataGabungan);

      // 6. Hitung Kalkulasi Jurnal Keuangan Global
      let queryTotalTx = supabase.from("transaksi").select("total_harga");
      if (batasanWaktu)
        queryTotalTx = queryTotalTx.gte("created_at", batasanWaktu);
      const { data: semuaTx } = await queryTotalTx;

      const omzetKotor = semuaTx
        ? semuaTx.reduce((acc, curr) => acc + Number(curr.total_harga), 0)
        : 0;
      const nilaiReturTotal = dataRetur
        ? dataRetur.reduce((acc, curr) => acc + Number(curr.subtotal_retur), 0)
        : 0;
      const omzetBersih = omzetKotor - nilaiReturTotal;
      const jumlahTransaksi = semuaTx ? semuaTx.length : 0;

      // =========================================================================
      // 🔥 FIX LANGKAH 7: HITUNG ALGORITMA PRODUK TERLARIS MENGGUNAKAN RELASI INNER JOIN
      // =========================================================================
      let top5Produk = [];

      // Menggunakan operator !inner untuk menyaring detail_transaksi berdasarkan waktu di tabel transaksi induk
      let queryTopSelling = supabase.from("detail_transaksi").select(`
          jumlah,
          transaksi!inner(created_at),
          produk:produk_id ( nama_produk )
        `);

      if (batasanWaktu) {
        queryTopSelling = queryTopSelling.gte(
          "transaksi.created_at",
          batasanWaktu,
        );
      }

      const { data: dataDetail, error: errTop } = await queryTopSelling;

      if (!errTop && dataDetail && dataDetail.length > 0) {
        const pemetaanProduk = {};

        dataDetail.forEach((item) => {
          const nama = item.produk?.nama_produk || "Produk Tidak Diketahui";
          pemetaanProduk[nama] = (pemetaanProduk[nama] || 0) + item.jumlah;
        });

        top5Produk = Object.entries(pemetaanProduk)
          .map(([nama, qty]) => ({ nama, qty }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5);
      }

      setRingkasan({
        totalOmzetKotor: omzetKotor,
        totalRetur: nilaiReturTotal,
        totalOmzetBersih: omzetBersih,
        totalTransaksi: jumlahTransaksi,
        produkTerlaris: top5Produk,
      });
    } catch (error) {
      console.error("Gagal memuat data dashboard:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler Pengurutan Kolom Tabel
  const handleSort = (field) => {
    const order = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(order);
    setHalamanAktif(1); // Balikkan ke halaman 1 jika urutan diubah
  };

  // Fungsi Ekspor Semua Data Berdasarkan Rentang Tanggal Kustom (Bypass Pagination)
  const eksporKeExcelKustom = async () => {
    if (!eksporMulai || !eksporSelesai) {
      alert(
        "❌ Harap tentukan tanggal 'Dari' dan 'Sampai' terlebih dahulu untuk ekspor global!",
      );
      return;
    }

    setLoadingEkspor(true);
    try {
      // Siasati jam: Mulai dari jam 00:00 WITA hari pertama sampai 23:59 WITA hari terakhir
      const startIso = `${eksporMulai}T00:00:00.000Z`;
      const endIso = `${eksporSelesai}T23:59:59.999Z`;

      // 1. Tarik SECORET-CORETNYA data transaksi pada rentang tersebut (Tanpa .range limit)
      let queryGlobal = supabase
        .from("transaksi")
        .select("id, created_at, kasir_id, metode_pembayaran, total_harga")
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .order("created_at", { ascending: true });

      const { data: dataSemuaTx, error: errGlobal } = await queryGlobal;
      if (errGlobal) throw errGlobal;

      if (!dataSemuaTx || dataSemuaTx.length === 0) {
        alert(
          "⚠️ Tidak ada data transaksi yang ditemukan pada rentang tanggal tersebut.",
        );
        return;
      }

      // 2. Tarik semua data retur pada rentang yang sama untuk penyeimbang laporan
      const { data: dataAllRetur } = await supabase
        .from("retur_transaksi")
        .select("transaksi_id, subtotal_retur")
        .gte("created_at", startIso)
        .lte("created_at", endIso);

      // 3. Tarik semua nama profil untuk mencocokkan id kasir
      const daftarKasirId = [
        ...new Set(dataSemuaTx.map((t) => t.kasir_id).filter(Boolean)),
      ];
      const { data: dataProfil } = await supabase
        .from("profiles")
        .select("id, nama_lengkap")
        .in("id", daftarKasirId);
      const petaProfil = {};
      dataProfil?.forEach((p) => {
        petaProfil[p.id] = p;
      });

      // 4. Susun Struktur Header File Excel
      let barisExcel =
        "ID Nota\tWaktu Transaksi\tPetugas Kasir\tMetode\tOmzet Kotor\tNilai Retur\tOmzet Bersih\n";

      // 5. Suntikkan Data Iterasi Satu Per Satu ke Baris Excel
      dataSemuaTx.forEach((tx) => {
        const waktu = new Date(tx.created_at).toLocaleString("id-ID");
        const namaKasir =
          petaProfil[tx.kasir_id]?.nama_lengkap || "Tidak Diketahui";

        const totalReturNota = dataAllRetur
          ? dataAllRetur
              .filter((r) => r.transaksi_id === tx.id)
              .reduce((acc, curr) => acc + Number(curr.subtotal_retur), 0)
          : 0;
        const bersihReal = Number(tx.total_harga) - totalReturNota;

        barisExcel += `#${tx.id}\t${waktu}\t${namaKasir}\t${tx.metode_pembayaran}\t${tx.total_harga}\t${totalReturNota}\t${bersihReal}\n`;
      });

      // 6. Jalankan Prosedur Download File Otomatis di Browser Customer
      const blob = new Blob([barisExcel], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Laporan_Jurnal_Global_${eksporMulai}_s_d_${eksporSelesai}.xls`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Gagal melakukan ekspor data global:", err.message);
      alert(`❌ Error saat menarik data ekspor: ${err.message}`);
    } finally {
      setLoadingEkspor(false); // Selesai
    }
  };

  // Fungsi melihat struk modal belanjaan
  const bukaDetailTransaksi = async (tx) => {
    setTransaksiTerpilih(tx);
    setLoadingDetail(true);
    try {
      const { data, error } = await supabase
        .from("detail_transaksi")
        .select("id, harga_satuan, jumlah, subtotal, produk(nama_produk)")
        .eq("transaksi_id", tx.id);
      if (error) throw error;
      setDetailItem(data || []);
    } catch (err) {
      console.error("Gagal memuat rincian item:", err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Hitung total halaman yang tersedia
  const totalHalaman = Math.ceil(totalBarisData / itemPerHalaman) || 1;
  const maksQty =
    ringkasan.produkTerlaris.length > 0 ? ringkasan.produkTerlaris[0].qty : 1;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans flex flex-col space-y-5">
      {/* ================= HEADER CONTROL BAR (SOLID & SATU BARIS) ================= */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-slate-200 gap-4 flex-shrink-0">
        {/* Sisi Kiri: Judul Utama Minimalis */}
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
            Dashboard Admin
          </h1>
        </div>

        {/* Sisi Kanan: Gabungan Filter Waktu & Ekspor Tanggal Kustom */}
        <div className="flex flex-wrap items-center gap-3">
          {/* A. Filter Tombol Waktu Cepat */}
          <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-3xs">
            {["hari_ini", "minggu_ini", "bulan_ini", "semua"].map((tipe) => (
              <button
                key={tipe}
                onClick={() => setFilterTanggal(tipe)}
                className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition-all capitalize ${
                  filterTanggal === tipe
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {tipe.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* B. Panel Input Kalender Ekspor Kustom */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 px-3 rounded-xl border border-slate-200/80 shadow-3xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                Dari:
              </span>
              <input
                type="date"
                value={eksporMulai}
                onChange={(e) => setEksporMulai(e.target.value)}
                className="p-1 border border-slate-200 rounded-md text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50/50"
              />
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                Sampai:
              </span>
              <input
                type="date"
                value={eksporSelesai}
                onChange={(e) => setEksporSelesai(e.target.value)}
                className="p-1 border border-slate-200 rounded-md text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50/50"
              />
            </div>

            {/* Tombol Download */}
            <button
              onClick={eksporKeExcelKustom}
              disabled={loadingEkspor}
              className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white px-2.5 py-1.5 rounded-lg transition-all cursor-pointer text-[10px] font-black uppercase tracking-wide ml-1"
            >
              <Download className="h-3 w-3" />
              <span>{loadingEkspor ? "Loading..." : "Ekspor"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= PANEL KARTU BALANCE BOOK UTAMA ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        {/* Omzet Kotor */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3.5">
          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
            <DollarSign className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Gross Revenue (Omzet Kotor)
            </p>
            <h3 className="text-base font-black text-slate-900 mt-0.5">
              Rp {ringkasan.totalOmzetKotor.toLocaleString("id-ID")}
            </h3>
          </div>
        </div>

        {/* Total Dana Retur Terbaca */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3.5">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
            <ArrowDownCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider">
              Total Refund (Retur)
            </p>
            <h3 className="text-base font-black text-rose-700 mt-0.5">
              Rp {ringkasan.totalRetur.toLocaleString("id-ID")}
            </h3>
          </div>
        </div>

        {/* Uang Bersih di Kasir */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-xl text-white shadow-xs flex items-center space-x-3.5">
          <div className="p-2.5 bg-white/10 text-white rounded-xl">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
              Net Revenue (Omzet Bersih Real)
            </p>
            <h3 className="text-lg font-black font-mono mt-0.5">
              Rp {ringkasan.totalOmzetBersih.toLocaleString("id-ID")}
            </h3>
          </div>
        </div>

        {/* Total Transaksi */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center space-x-3.5">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Total Sales (Invoice)
            </p>
            <h3 className="text-base font-black text-slate-900 mt-0.5">
              {ringkasan.totalTransaksi} Nota Keluar
            </h3>
          </div>
        </div>
      </div>

      {/* ================= COMPONENT DROPDOWN INTERAKTIF TOP 5 BEST SELLING ================= */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden transition-all duration-300 flex-shrink-0">
        <div
          onClick={() => setIsDropdownTerbuka(!isDropdownTerbuka)}
          className="p-3 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 select-none transition-colors"
        >
          <div className="flex items-center space-x-3 text-xs font-bold text-slate-900">
            <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span className="uppercase tracking-wide text-[11px]">
              Produk Paling Diminati Teratas:
            </span>
            {ringkasan.produkTerlaris.length > 0 ? (
              <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-black text-[10px]">
                🏆 #1 {ringkasan.produkTerlaris[0].nama} (
                {ringkasan.produkTerlaris[0].qty} Item)
              </span>
            ) : (
              <span className="text-slate-400 font-medium text-[11px]">
                Belum ada data penjualan
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
            <span>
              {isDropdownTerbuka ? "Sembunyikan Top 5" : "Lihat Analisis Top 5"}
            </span>
            {isDropdownTerbuka ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </div>
        </div>

        {isDropdownTerbuka && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2.5 animate-fadeIn">
            {ringkasan.produkTerlaris.map((item, indeks) => {
              const persentaseBar = (item.qty / maksQty) * 100;
              return (
                <div
                  key={indeks}
                  className="flex flex-col md:flex-row md:items-center justify-between text-xs font-semibold text-slate-700 gap-2"
                >
                  <div className="w-full md:w-1/3 flex items-center space-x-2">
                    <span
                      className={`w-4 h-4 flex items-center justify-center rounded font-black text-[9px] ${indeks === 0 ? "bg-amber-500 text-white" : indeks === 1 ? "bg-slate-400 text-white" : indeks === 2 ? "bg-amber-700 text-white" : "bg-slate-200 text-slate-600"}`}
                    >
                      {indeks + 1}
                    </span>
                    <span className="text-slate-900 font-bold truncate max-w-[140px]">
                      {item.nama}
                    </span>
                  </div>
                  <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden relative mx-0 md:mx-4">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${indeks === 0 ? "bg-amber-500" : "bg-slate-700"}`}
                      style={{ width: `${persentaseBar}%` }}
                    />
                  </div>
                  <span className="font-mono font-black text-slate-900 text-right w-20">
                    {item.qty} Pcs
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= TABEL JURNAL PENJUALAN DENGAN PAGINATION ================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-3xs overflow-hidden flex flex-col flex-1 min-h-[300px]">
        <div className="p-4 px-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-sm text-slate-900 uppercase tracking-tight">
            Buku Besar Jurnal Penjualan Toko
          </h2>
          <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-2.5 py-1 rounded-full uppercase">
            {riwayatTransaksi.length} dari {totalBarisData} Transaksi
          </span>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs font-bold">
              Memetakan transaksi keuangan...
            </div>
          ) : riwayatTransaksi.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Tidak ada transaksi tercatat pada periode ini.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-xs shadow-3xs z-10">
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th
                    className="p-3.5 px-4 cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("id")}
                  >
                    ID Nota{" "}
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
                    className="p-3.5 cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("kasir_id")}
                  >
                    Petugas Kasir{" "}
                    {sortField === "kasir_id"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th className="p-3.5">Metode</th>
                  <th
                    className="p-3.5 text-right cursor-pointer hover:bg-slate-100 select-none"
                    onClick={() => handleSort("total_harga")}
                  >
                    Kotor{" "}
                    {sortField === "total_harga"
                      ? sortOrder === "asc"
                        ? "🔼"
                        : "🔽"
                      : "↕️"}
                  </th>
                  <th className="p-3.5 text-right text-rose-600">Retur</th>
                  <th className="p-3.5 text-right text-emerald-700 px-5">
                    Bersih
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs font-semibold text-slate-700 divide-y divide-slate-50">
                {riwayatTransaksi.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => bukaDetailTransaksi(tx)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="p-3.5 px-4 font-mono font-bold text-slate-900">
                      #{tx.id}
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {new Date(tx.created_at).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}{" "}
                      WITA
                    </td>
                    <td className="p-3.5 text-slate-800 font-bold">
                      {tx.nama_kasir}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.metode_pembayaran === "Tunai" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}
                      >
                        {tx.metode_pembayaran}
                      </span>
                    </td>
                    <td className="p-3.5 text-right text-slate-400">
                      Rp {Number(tx.total_harga).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3.5 text-right text-rose-600 font-bold">
                      {tx.total_retur > 0
                        ? `-Rp ${tx.total_retur.toLocaleString("id-ID")}`
                        : "Rp 0"}
                    </td>
                    <td className="p-3.5 text-right text-slate-900 font-black text-sm px-5">
                      Rp {tx.omzet_bersih.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ================= PANEL FOOTER NAVIGASI PAGINATION INTERAKTIF ================= */}
        <div className="p-3.5 px-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-shrink-0 text-xs font-bold text-slate-500">
          <p>
            Halaman {halamanAktif} dari {totalHalaman}
          </p>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setHalamanAktif((prev) => Math.max(prev - 1, 1))}
              disabled={halamanAktif === 1 || loading}
              className="p-1.5 border border-slate-300 bg-white rounded-lg hover:bg-slate-100 transition-all disabled:opacity-40 disabled:hover:bg-white cursor-pointer flex items-center"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-1">
              {[...Array(totalHalaman)].map((_, indeksHalaman) => {
                const nomorHalaman = indeksHalaman + 1;
                if (
                  nomorHalaman === 1 ||
                  nomorHalaman === totalHalaman ||
                  Math.abs(nomorHalaman - halamanAktif) <= 1
                ) {
                  return (
                    <button
                      key={nomorHalaman}
                      onClick={() => setHalamanAktif(nomorHalaman)}
                      className={`px-2.5 py-1 rounded-md border text-[11px] transition-all cursor-pointer ${halamanAktif === nomorHalaman ? "bg-slate-900 text-white border-slate-900 shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                    >
                      {nomorHalaman}
                    </button>
                  );
                }
                if (nomorHalaman === 2 || nomorHalaman === totalHalaman - 1) {
                  return (
                    <span key={nomorHalaman} className="px-1 text-slate-300">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <button
              onClick={() =>
                setHalamanAktif((prev) => Math.min(prev + 1, totalHalaman))
              }
              disabled={halamanAktif === totalHalaman || loading}
              className="p-1.5 border border-slate-300 bg-white rounded-lg hover:bg-slate-100 transition-all disabled:opacity-40 disabled:hover:bg-white cursor-pointer flex items-center"
              title="Halaman Selanjutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* COMPONENT MODAL DETAIL ITEM */}
      {transaksiTerpilih && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 px-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                  Rincian Faktur #{transaksiTerpilih.id}
                </h3>
                <p className="text-xs text-slate-400">
                  Kasir Bertugas: <b>{transaksiTerpilih.nama_kasir}</b>
                </p>
              </div>
              <button
                onClick={() => setTransaksiTerpilih(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {loadingDetail ? (
                <div className="text-center text-xs py-8 text-slate-400 font-bold">
                  Membuka lemari arsip item...
                </div>
              ) : (
                <>
                  <div className="max-h-48 overflow-y-auto space-y-3 pr-1">
                    {detailItem.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-start text-xs font-semibold"
                      >
                        <div>
                          <p className="text-slate-900 font-bold">
                            {item.produk?.nama_produk || "Produk Dihapus"}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {item.jumlah} pcs x Rp{" "}
                            {Number(item.harga_satuan).toLocaleString("id-ID")}
                          </p>
                        </div>
                        <p className="text-slate-950 font-mono">
                          Rp {Number(item.subtotal).toLocaleString("id-ID")}
                        </p>
                      </div>
                    ))}
                  </div>

                  <hr className="border-dashed border-slate-200" />

                  <div className="space-y-1.5 text-xs font-semibold text-slate-500">
                    <div className="flex justify-between">
                      <span>Metode Pembayaran</span>
                      <span className="text-slate-900 uppercase font-black">
                        {transaksiTerpilih.metode_pembayaran}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uang Fisik Diterima</span>
                      <span className="text-slate-900">
                        Rp{" "}
                        {Number(transaksiTerpilih.uang_diterima).toLocaleString(
                          "id-ID",
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kembalian Kasir</span>
                      <span className="text-slate-900">
                        Rp{" "}
                        {Number(
                          transaksiTerpilih.uang_kembalian,
                        ).toLocaleString("id-ID")}
                      </span>
                    </div>

                    {transaksiTerpilih.total_retur > 0 && (
                      <div className="flex justify-between text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">
                        <span>Dana Hangus Retur</span>
                        <span>
                          -Rp{" "}
                          {transaksiTerpilih.total_retur.toLocaleString(
                            "id-ID",
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between pt-2 border-t border-slate-100 text-slate-900 font-black text-sm">
                      <span>Total Bersih Real</span>
                      <span className="text-emerald-600 font-mono text-base">
                        Rp{" "}
                        {transaksiTerpilih.omzet_bersih.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
