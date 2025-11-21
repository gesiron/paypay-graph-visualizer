const ChartJS = window.Chart;

// グローバル状態
window.gldHistory = [];
window.spxlHistory = [];
window.gldChartInstance = null;
window.spxlChartInstance = null;

// CSV読み込み → 整形 → 描画
window.loadCSVData = async function (file, target) {
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const rows = results.data;
      if (!rows || rows.length === 0) {
        alert("CSVにデータがありません。");
        return;
      }

      // 列名の自動検出（代表的な候補）
      const sample = rows[0] || {};
      const dateCandidates = ["Date", "日付", "date", "日時"];
      const priceCandidates = ["Price", "Close", "終値", "Adj Close", "price", "close"];

      const dateKey = dateCandidates.find(k => k in sample) || "Date";
      const priceKey = priceCandidates.find(k => k in sample) || "Price";

      // 日付の柔軟パース
      const parseDateFlexible = (raw) => {
        if (raw === undefined || raw === null) return window.luxon.DateTime.invalid("empty");
        let s = String(raw).trim();
        if (s.length === 0) return window.luxon.DateTime.invalid("empty");

        // 和暦風「2020年11月01日」→ ISO風に正規化
        if (/[年月日]/.test(s)) {
          s = s.replace(/年|\/|\.|年/g, "-").replace(/月/g, "-").replace(/日/g, "");
        }

        // トライ: 英語月表記
        let d = window.luxon.DateTime.fromFormat(s, "MMM dd, yyyy");
        if (!d.isValid) d = window.luxon.DateTime.fromFormat(s, "MMM d, yyyy");

        // トライ: 数字フォーマット
        if (!d.isValid) d = window.luxon.DateTime.fromFormat(s, "yyyy-MM-dd");
        if (!d.isValid) d = window.luxon.DateTime.fromFormat(s, "yyyy/M/d");
        if (!d.isValid) d = window.luxon.DateTime.fromFormat(s, "M/d/yyyy");
        if (!d.isValid) d = window.luxon.DateTime.fromFormat(s, "M/d/yy");

        // 最後にISO全般
        if (!d.isValid) d = window.luxon.DateTime.fromISO(s);

        return d;
      };

      let skipped = 0;
      const data = rows
        .map(row => {
          const d = parseDateFlexible(row[dateKey]);
          const yRaw = row[priceKey];
          // 価格が「1,234.56」などの場合も考慮してカンマ除去
          const y = typeof yRaw === "string" ? parseFloat(yRaw.replace(/,/g, "")) : parseFloat(yRaw);

          if (!d.isValid || isNaN(y)) {
            skipped++;
            return null;
          }
          return { x: d.toISODate(), y };
        })
        .filter(p => p !== null)
        // 日付昇順に整列
        .sort((a, b) => (a.x < b.x ? -1 : a.x > b.x ? 1 : 0));

      if (data.length === 0) {
        alert("有効な行がありませんでした。CSVの列名（Date/PriceやClose）と日付形式をご確認ください。");
        return;
      }

      if (target === "GLD") window.gldHistory = data;
      if (target === "SPXL") window.spxlHistory = data;

      // 何行スキップしたか軽く通知（任意）
      if (skipped > 0) {
        console.warn(`パースできなかった行: ${skipped} 行`);
      }

      drawHistoryCharts();
    },
    error: (err) => {
      alert(`CSVの読み込みに失敗しました: ${err?.message || err}`);
    }
  });
};

// グラフ描画
function drawHistoryCharts() {
  const config = (label, data, color) => ({
    type: "line",
    data: {
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + "33",
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      parsing: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "time",
          time: { unit: chooseTimeUnit(data) },
          title: { display: true, text: "日付" }
        },
        y: {
          title: { display: true, text: "価格（USD）" },
          beginAtZero: false
        }
      },
      plugins: {
        legend: { display: true }
      }
    }
  });

  if (window.gldChartInstance) window.gldChartInstance.destroy();
  if (window.spxlChartInstance) window.spxlChartInstance.destroy();

  if (window.gldHistory.length > 0) {
    window.gldChartInstance = new ChartJS(
      document.getElementById("gldChart"),
      config("GLD履歴", window.gldHistory, "orange")
    );
  }
  if (window.spxlHistory.length > 0) {
    window.spxlChartInstance = new ChartJS(
      document.getElementById("spxlChart"),
      config("SPXL履歴", window.spxlHistory, "red")
    );
  }
}

// データ密度に応じて軸ユニットを選択
function chooseTimeUnit(data) {
  if (!data || data.length === 0) return "month";
  const a = window.luxon.DateTime.fromISO(data[0].x);
  const b = window.luxon.DateTime.fromISO(data[Math.min(1, data.length - 1)].x);
  if (!a.isValid || !b.isValid) return "month";
  const diffDays = Math.abs(b.diff(a, "days").days);
  if (diffDays <= 2) return "day";
  if (diffDays <= 15) return "week";
  return "month";
}
