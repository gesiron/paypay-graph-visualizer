window.gldHistory = [];
window.spxlHistory = [];
window.tradeMarkers = [];
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

window.addTradeMarker = function (event) {
  event.preventDefault();
  const date = document.getElementById("tradeDate").value;
  const type = document.getElementById("tradeType").value;
  const amount = parseFloat(document.getElementById("tradeAmount").value);

  if (!date || isNaN(amount)) return;

  const d = luxon.DateTime.fromISO(date);
  if (!d.isValid) return;

  window.tradeMarkers.push({
    x: d.toISODate(),
    y: null,
    type: type.toLowerCase(),
    amount
  });

  drawHistoryCharts();
};

function drawHistoryCharts() {
  if (window.gldChartInstance) window.gldChartInstance.destroy();
  if (window.spxlChartInstance) window.spxlChartInstance.destroy();

  const makeTradePoints = (history) => {
    return window.tradeMarkers
      .map(marker => {
        const match = history.find(p => p.x === marker.x);
        if (!match) return null;
        return {
          x: marker.x,
          y: match.y,
          backgroundColor: marker.type === "buy" ? "blue" : "red",
          radius: 5
        };
      })
      .filter(p => p !== null);
  };

  const config = (label, data, color, trades) => ({
    type: "line",
    data: {
      datasets: [
        {
          label,
          data,
          borderColor: color,
          backgroundColor: color + "33",
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: "売買ポイント",
          data: trades,
          type: "scatter",
          pointStyle: "circle",
          showLine: false
        }
      ]
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

  window.gldChartInstance = new Chart(
    document.getElementById("gldChart"),
    config("GLD履歴", window.gldHistory, "orange", makeTradePoints(window.gldHistory))
  );

  window.spxlChartInstance = new Chart(
    document.getElementById("spxlChart"),
    config("SPXL履歴", window.spxlHistory, "red", makeTradePoints(window.spxlHistory))
  );
}
