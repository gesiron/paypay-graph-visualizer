const ChartJS = window.Chart;
const luxon = window.luxon;

// Chart.js に Luxon adapter を明示的に登録
ChartJS.adapters._date.override({
  formats: { date: 'yyyy-MM-dd' },
  parse: (value) => {
    const dt = luxon.DateTime.fromISO(value);
    return dt.isValid ? dt.toMillis() : null;
  },
  format: (time, format) => {
    return luxon.DateTime.fromMillis(time).toFormat(format);
  }
});

window.gldHistory = [];
window.spxlHistory = [];
window.gldChartInstance = null;
window.spxlChartInstance = null;

window.loadCSVData = async function (file, target) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      const rows = results.data;
      const dateKeys = ["Date", "日付", "date"];
      const priceKeys = ["Price", "Close", "終値", "Adj Close"];

      const sample = rows[0] || {};
      const dateKey = dateKeys.find(k => k in sample) || "Date";
      const priceKey = priceKeys.find(k => k in sample) || "Price";

      const parseDateFlexible = (raw) => {
        if (!raw) return luxon.DateTime.invalid("empty");
        const s = String(raw).trim();
        if (s.length === 0) return luxon.DateTime.invalid("empty");

        let d = luxon.DateTime.fromFormat(s, "MMM dd, yyyy");
        if (!d.isValid) d = luxon.DateTime.fromFormat(s, "yyyy-MM-dd");
        if (!d.isValid) d = luxon.DateTime.fromFormat(s, "yyyy/M/d");
        if (!d.isValid) d = luxon.DateTime.fromFormat(s, "M/d/yyyy");
        if (!d.isValid) d = luxon.DateTime.fromISO(s);
        return d;
      };

      const data = rows
        .map(row => {
          const d = parseDateFlexible(row[dateKey]);
          const y = parseFloat(String(row[priceKey]).replace(/,/g, ""));
          return d.isValid && !isNaN(y) ? { x: d.toISODate(), y } : null;
        })
        .filter(p => p !== null)
        .sort((a, b) => a.x.localeCompare(b.x));

      if (target === "GLD") window.gldHistory = data;
      if (target === "SPXL") window.spxlHistory = data;

      drawHistoryCharts();
    }
  });
};

function drawHistoryCharts() {
  // 既存グラフを破棄（Canvas再利用エラー防止）
  if (window.gldChartInstance) {
    window.gldChartInstance.destroy();
    window.gldChartInstance = null;
  }
  if (window.spxlChartInstance) {
    window.spxlChartInstance.destroy();
    window.spxlChartInstance = null;
  }

  const config = (label, data, color) => ({
    type: "line",
    data: {
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + "33",
        tension: 0.3,
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
          time: { unit: "month" },
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
