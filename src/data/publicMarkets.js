// Public Markets static data — extracted from Resum Financer Espai 2026_vClaudeRoberto.xlsx
// and Bankinter/Andbank reports (Mar 2026).
//
// DATA PROVENANCE
// caixaRV  — confirmed monthly from TWR sheets, Dec 2023–Mar 2026, zero interpolation
// caixaRF  — confirmed 2024; held flat 3_992_338 for Jan–Nov 2025 (0.47% monthly vol);
//            Jan–Feb 2026 confirmed; Mar 2026 uses Feb value
// ubsRV    — confirmed Dec 2023–Jun 2024 and Jan–Jun 2025 and Dec 2025–Mar 2026;
//            Jul–Nov 2024 linearly interpolated (7_893_005 → 8_250_234);
//            Jul–Nov 2025 linearly interpolated (8_765_865 → 10_678_097)
// ubsRF    — confirmed Dec 2023–Jun 2024 and Dec 2025–Feb 2026;
//            Jul 2024–Nov 2025 linearly interpolated (2_716_639 → 2_228_738)
//            accounting for known ~986k redemption in Apr 2024;
//            Mar 2026 uses Feb value
// abelBK   — null before Apr 2025; Apr 2025–Mar 2026 confirmed from Bankinter report

export const PM_MONTHLY = [
  // ── Dec 2023 ────────────────────────────────────────────
  { date:"2023-12", label:"Des '23", caixaRV:6_260_222, caixaRF:4_013_654, ubsRV:10_236_736, ubsRF:3_690_362, abelBK:null },
  // ── 2024 ────────────────────────────────────────────────
  { date:"2024-01", label:"Gen '24", caixaRV:6_381_485, caixaRF:4_043_704, ubsRV:10_411_866, ubsRF:3_713_698, abelBK:null },
  { date:"2024-02", label:"Feb '24", caixaRV:5_744_139, caixaRF:4_081_998, ubsRV:8_700_807,  ubsRF:3_752_120, abelBK:null },
  { date:"2024-03", label:"Mar '24", caixaRV:5_918_881, caixaRF:4_053_262, ubsRV:7_814_136,  ubsRF:3_703_334, abelBK:null },
  { date:"2024-04", label:"Abr '24", caixaRV:5_775_461, caixaRF:3_739_274, ubsRV:7_509_165,  ubsRF:2_708_063, abelBK:null },
  { date:"2024-05", label:"Mai '24", caixaRV:6_843_652, caixaRF:3_762_474, ubsRV:7_722_095,  ubsRF:2_724_952, abelBK:null },
  { date:"2024-06", label:"Jun '24", caixaRV:6_946_413, caixaRF:3_775_540, ubsRV:7_893_005,  ubsRF:2_716_639, abelBK:null },
  { date:"2024-07", label:"Jul '24", caixaRV:7_036_117, caixaRF:3_901_727, ubsRV:7_952_543,  ubsRF:2_689_533, abelBK:null }, // ubsRV interp
  { date:"2024-08", label:"Ago '24", caixaRV:7_096_349, caixaRF:3_914_830, ubsRV:8_012_081,  ubsRF:2_662_427, abelBK:null }, // ubsRV interp
  { date:"2024-09", label:"Set '24", caixaRV:7_244_782, caixaRF:3_939_397, ubsRV:8_071_619,  ubsRF:2_635_321, abelBK:null }, // ubsRV interp
  { date:"2024-10", label:"Oct '24", caixaRV:7_216_196, caixaRF:3_980_125, ubsRV:8_131_157,  ubsRF:2_608_215, abelBK:null }, // ubsRV interp
  { date:"2024-11", label:"Nov '24", caixaRV:7_577_969, caixaRF:3_978_907, ubsRV:8_190_695,  ubsRF:2_581_109, abelBK:null }, // ubsRV interp
  { date:"2024-12", label:"Des '24", caixaRV:7_480_556, caixaRF:3_992_338, ubsRV:8_250_234,  ubsRF:2_554_003, abelBK:null },
  // ── 2025 ────────────────────────────────────────────────
  { date:"2025-01", label:"Gen '25", caixaRV:7_768_451, caixaRF:3_992_338, ubsRV:8_541_892,  ubsRF:2_526_897, abelBK:null },
  { date:"2025-02", label:"Feb '25", caixaRV:7_718_892, caixaRF:3_992_338, ubsRV:8_352_934,  ubsRF:2_499_791, abelBK:null },
  { date:"2025-03", label:"Mar '25", caixaRV:7_291_453, caixaRF:3_992_338, ubsRV:7_827_909,  ubsRF:2_472_685, abelBK:null },
  { date:"2025-04", label:"Abr '25", caixaRV:7_467_258, caixaRF:3_992_338, ubsRV:8_088_432,  ubsRF:2_445_579, abelBK:12_550_766 },
  { date:"2025-05", label:"Mai '25", caixaRV:7_838_672, caixaRF:3_992_338, ubsRV:8_530_284,  ubsRF:2_418_473, abelBK:13_072_330 },
  { date:"2025-06", label:"Jun '25", caixaRV:7_934_352, caixaRF:3_992_338, ubsRV:8_765_865,  ubsRF:2_391_367, abelBK:13_213_868 },
  { date:"2025-07", label:"Jul '25", caixaRV:7_874_688, caixaRF:3_992_338, ubsRV:9_084_570,  ubsRF:2_364_261, abelBK:13_024_261 }, // ubsRV interp
  { date:"2025-08", label:"Ago '25", caixaRV:8_059_251, caixaRF:3_992_338, ubsRV:9_403_275,  ubsRF:2_337_155, abelBK:13_032_505 }, // ubsRV interp
  { date:"2025-09", label:"Set '25", caixaRV:8_211_556, caixaRF:3_992_338, ubsRV:9_721_980,  ubsRF:2_310_049, abelBK:13_325_104 }, // ubsRV interp
  { date:"2025-10", label:"Oct '25", caixaRV:8_160_595, caixaRF:3_992_338, ubsRV:10_040_685, ubsRF:2_282_943, abelBK:13_681_568 }, // ubsRV interp
  { date:"2025-11", label:"Nov '25", caixaRV:8_073_468, caixaRF:3_992_338, ubsRV:10_359_390, ubsRF:2_255_837, abelBK:13_587_323 }, // ubsRV interp
  { date:"2025-12", label:"Des '25", caixaRV:8_134_950, caixaRF:3_992_338, ubsRV:10_678_097, ubsRF:2_228_738, abelBK:13_570_385 },
  // ── 2026 ────────────────────────────────────────────────
  { date:"2026-01", label:"Gen '26", caixaRV:8_244_136, caixaRF:4_049_948, ubsRV:10_995_276, ubsRF:2_244_148, abelBK:13_577_708 },
  { date:"2026-02", label:"Feb '26", caixaRV:8_192_127, caixaRF:3_990_758, ubsRV:11_031_708, ubsRF:2_220_845, abelBK:13_544_782 },
  { date:"2026-03", label:"Mar '26", caixaRV:8_037_347, caixaRF:3_990_758, ubsRV:10_704_128, ubsRF:2_220_845, abelBK:16_676_391 },
];

// Current manager snapshots — as of Mar 2026
// rendPct: since-inception TWR for WAM/Andbank; YTD for UBS; null for Abel (multi-sleeve)
//          Not rendered in this version — reserved for future "des de creació" display
// Abel ytd/r2025/r2024: Bankinter sleeve only (€16.7M of €20.9M total)
// Abel valorActual: Bankinter €16,676,391 + IB €4,256,627
export const PM_MANAGERS = [
  { id:"caixa-rv", nom:"Caixa RV",     gestor:"CaixaBank", tipus:"RV",    valorActual:8_037_347,  rendPct:7.44,  ytd:-1.20,  r2025:9.51,  r2024:17.02 },
  { id:"caixa-rf", nom:"Caixa RF",     gestor:"CaixaBank", tipus:"RF",    valorActual:3_990_758,  rendPct:-0.04, ytd:-0.004, r2025:4.96,  r2024:4.96  },
  { id:"ubs-rv",   nom:"UBS RV",       gestor:"UBS",       tipus:"RV",    valorActual:10_704_128, rendPct:0.37,  ytd:0.37,   r2025:null,  r2024:null  },
  { id:"ubs-rf",   nom:"UBS RF",       gestor:"UBS",       tipus:"RF",    valorActual:2_220_845,  rendPct:-0.35, ytd:-0.35,  r2025:null,  r2024:null  },
  { id:"wam",      nom:"WAM (Goyo)",   gestor:"WAM",       tipus:"RF",    valorActual:6_089_314,  rendPct:18.11, ytd:0.48,   r2025:null,  r2024:null  },
  { id:"abel",     nom:"Abel (BK+IB)", gestor:"Abel Font", tipus:"RV+RF", valorActual:20_933_017, rendPct:null,  ytd:-2.68,  r2025:-8.05, r2024:11.44 },
  { id:"andbank",  nom:"Andbank Bons", gestor:"Andbank",   tipus:"RF",    valorActual:6_088_661,  rendPct:17.76, ytd:0.60,   r2025:4.18,  r2024:6.32  },
];
