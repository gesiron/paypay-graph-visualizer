import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const ChartJS = window.Chart;
const luxon = window.luxon;

const firebaseConfig = {
  apiKey: "AIzaSyDQiJOZC1N3nVZpOqJyFv3pH1J9XSJpTFU",
  authDomain: "paypay-graph.firebaseapp.com",
  projectId: "paypay-graph",
  storageBucket: "paypay-graph.appspot.com",
  messagingSenderId: "887693248782",
  appId: "1:887693248782:web:f60f8fd487428905606f5f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const tradesRef = collection(db, "trades");

const tradePoints = { GLD: [], SPXL: [] };
const tradeLog = { GLD: [], SPXL: [] };
window.tradePoints = tradePoints; // Console確認用

async function fetchETFPrice(symbol) {
  const apiKey = "V5PSUW7YL5FCNL4R";
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data["Time Series (Daily)"]) return null;
    const ts = data["Time Series (Daily)"];
    const latestDate = Object.keys(ts).sort().pop();
    const latestClose = parseFloat(ts[latestDate]["4. close"]);
    return { symbol, date: latestDate, close: latestClose };
  } catch {
    return null;
  }
}

window.showPrice = async function showPrice() {
  const symbol = document.getElementById("symbolInput").value.trim().toUpperCase();
  const result = await fetchETFPrice(symbol);
  document.getElementById("priceResult").innerText =
    result ? `${result.symbol} の最新価格（${result.date}）: ${result.close} USD`
           : "価格の取得に失敗しました。";
};

window.addOrUpdateTradePoint = async function () {
  const course = document.getElementById("courseSelect").value;
  const date = document.getElementById("tradeDate").value;
  const type = document.getElementById("tradeType")?.value || "buy";
  const amount = parseFloat(document.getElementById("tradeAmount").value);
  if (!course || !date || !type || isNaN(amount)) return alert("すべての項目を正しく入力してください");

  const docId = `${course}_${date}`;
  const priceData = await fetchETFPrice(course);
  const price = priceData ? priceData.close : null;
  if (price === null) return alert("価格取得に失敗しました。");

  await setDoc(doc(tradesRef, docId), { course, date, type, amount, price });
  await loadTradePoints();
};

window.deleteTradePoint = async function () {
  const course = document.getElementById("courseSelect").value;
  const date = document.getElementById("tradeDate").value;
  const docId = `${course}_${date}`;
  await deleteDoc(doc(tradesRef, docId));
  await loadTradePoints();
};

async function loadTradePoints() {
  const snapshot = await getDocs(tradesRef);
  tradeLog.GLD = [];
  tradeLog.SPXL = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const normalizedDate = String(data.date).replace(/\//g, "-").substring(0, 10);
    if (tradeLog[data.course]) {
      tradeLog[data.course].push({
        date: normalizedDate,
        type: data.type,
        amount: Number(data.amount),
        price: Number(data.price)
      });
    }
  });
}

function drawCharts(period) {
  const gldFiltered = tradePoints.GLD;
  const spxlFiltered = tradePoints.SPXL;

  const gldData = gldFiltered.map(tp => ({ x: tp.date, y: Number(tp.price) }));
  const spxlData = spxlFiltered.map(tp => ({ x: tp.date, y: Number(tp.price) }));

  const config = (label, data, color) => ({
    type: "line",
    data: {
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + "33",
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: color,
        borderWidth: 3
      }]
    },
    options: {
      parsing: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: "time", time: { unit: "day" }, title: { display: true, text: "日付" } },
        y: { beginAtZero: false, title: { display: true, text: "価格（USD）" } }
      },
      plugins: { legend: { display: true } }
    }
  });

  if (window.gldChartInstance) window.gldChartInstance.destroy();
  if (window.spxlChartInstance) window.spxlChartInstance.destroy();

  window.gldChartInstance = new ChartJS(document.getElementById("gldChart"), config("GLD価格", gldData, "gold"));
  window.spxlChartInstance = new ChartJS(document.getElementById("spxlChart"), config("SPXL価格", spxlData, "red"));
}

document.getElementById("periodSelector").addEventListener("change", (e) => {
  drawCharts(e.target.value);
});

(async () => {
  await loadTradePoints();

  tradePoints.GLD = [
    { date: "2025-11-21", price: 195 },
    { date: "2025-11-22", price: 196 },
    { date: "2025-11-23", price: 197 },
    { date: "2025-11-24", price: 198 },
    { date: "2025-11-25", price: 199 },
    { date: "2025-11-26", price: 200 },
    { date: "2025-11-27", price: 201 },
    { date: "2025-11-28", price: 202 },
    { date: "2025-11-29", price: 203 },
    { date: "2025-11-30", price: 204 }
  ];
  tradePoints.SPXL = [
    { date: "2025-11-21", price: 105 },
    { date: "2025-11-22", price: 106 },
    { date: "2025-11-23", price: 107 },
    { date: "2025-11-24", price: 108 },
    { date: "2025-11-25", price: 109 },
    { date: "2025-11-26", price: 110 },
    { date: "2025-11-27", price: 111 },
    { date: "2025-11-28", price: 112 },
    { date: "2025-11-29", price: 113 },
    { date: "2025-11-30", price: 114 }
  ];

  drawCharts("1m");
})();
