const ChartJS = window.Chart;

window.gldHistory = [];
window.spxlHistory = [];
window.gldChartInstance = null;
window.spxlChartInstance = null;

window.loadCSVData = async function (file, target) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      const data = results.data
        .map(row => {
          const date = window.luxon.DateTime.fromFormat(row.Date, "MMM DD, YYYY");
          const price = parseFloat(row["Price"]);
          return date.isValid && !isNaN(price)
            ? { x: date.toISODate(), y: price }
            : null;
        })
        .filter(p => p !== null);

      if (target === "GLD") window.gldHistory = data;
      if (target === "SPXL") window.spxlHistory = data;

      drawHistoryCharts();
    }
  });
};

function drawHistoryCharts() {
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
