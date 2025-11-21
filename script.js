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

async function fetchETFPrice(symbol) {
  const apiKey = "XKSZLMWIKG9JRKBK";
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log("Alpha Vantageレスポンス:", data);
    if (!data["Time Series (Daily)"]) {
      console.error("データ取得失敗:", data);
      return null;
    }
    const ts = data["Time Series (Daily)"];
    const latestDate = Object.keys(ts).sort().pop();
    const latestClose = parseFloat(ts[latestDate]["4. close"]);
    return { symbol, date: latestDate, close: latestClose };
  } catch (error) {
    console.error("API呼び出しエラー:", error);
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

const tradePoints = { GLD: [], SPXL: [] };

window.addOrUpdateTradePoint = async function addOrUpdateTradePoint() {
  const course = document.getElementById("courseSelect").value;
  const date = document.getElementById("tradeDate").value;
  const type = document.getElementById("tradeType")?.value || "buy";
  const amount = parseFloat(document.getElementById("tradeAmount").value);

  if (!course || !date || !type || isNaN(amount)) {
    alert("すべての項目を正しく入力してください");
    return;
  }

  const docId = `${course}_${date}`;
  const priceData = await fetchETFPrice(course);
  const price = priceData ? priceData.close : null;

  if (price === null) {
    alert("価格取得に失敗しました。");
    return;
  }

  console.log("保存するデータ:", { course, date, type, amount, price });

  await setDoc(doc(tradesRef, docId), { course, date, type, amount, price });
  await loadTradePoints();
};

window.deleteTradePoint = async function deleteTradePoint() {
  const course = document.getElementById("courseSelect").value;
  const date = document.getElementById("tradeDate").value;
  const docId = `${course}_${date}`;
  await deleteDoc(doc(tradesRef, docId));
  await loadTradePoints();
};

async function loadTradePoints() {
  const snapshot = await getDocs(tradesRef);
  tradePoints.GLD = [];
  tradePoints.SPXL = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const normalizedDate = String(data.date).replace(/\//g, "-").substring(0, 10);
    if (tradePoints[data.course]) {
      tradePoints[data.course].push({
        date: normalizedDate,
        type: data.type,
        amount: Number(data.amount),
        price: Number(data.price)
      });
    }
  });
}

async function fetchHistory(symbol) {
  const apiKey = "XKSZLMWIKG9JRKBK";
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=full`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data["Time Series (Daily)"]) {
      console.error("履歴データ取得失敗:", data);
      return [];
    }

    const ts = data["Time Series (Daily)"];
    const fiveYearsAgo = luxon.DateTime.now().minus({ years: 5 });

    return Object.entries(ts)
      .map(([date, values]) => ({
        date,
        price: parseFloat(values["4. close"])
      }))
      .filter(d => luxon.DateTime.fromISO(d.date) >= fiveYearsAgo)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (error) {
    console.error("API呼び出しエラー:", error);
    return [];
  }
}

function drawCharts(period) {
  const now = luxon.DateTime.now();
  let startDate;
  switch (period) {
    case "1m": startDate = now.minus({ months: 1 }); break;
    case "3m": startDate = now.minus({ months: 3 }); break;
    case "1y": startDate = now.minus({ years: 1 }); break;
    case "3y": startDate = now.minus({ years: 3 }); break;
    case "5y": startDate = now.minus({ years: 5 }); break;
    default: startDate = now.minus({ months: 1 });
  }

  const gldFiltered = tradePoints.GLD.filter(tp => {
    const dt = luxon.DateTime.fromISO(tp.date);
    return tp.price !== null && dt.isValid && dt >= startDate;
  });
  const spxlFiltered = tradePoints.SPXL.filter(tp => {
    const dt = luxon.DateTime.fromISO(tp.date);
    return tp.price !== null && dt.isValid && dt >= startDate;
  });

  const gldData = gldFiltered.map(tp => ({ x: tp.date, y: tp.price }));
  const spxlData = spxlFiltered.map(tp => ({ x: tp.date, y: tp.price }));

  const config = (label, data, color) => ({
    type: "line",
    data: {
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + "33",
        tension: 0.3,
        pointRadius: 2,
        pointBackgroundColor: color,
        borderWidth: 2
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
  const gldHistory = await fetchHistory("GLD");
  const spxlHistory = await fetchHistory("SPXL");
  await loadTradePoints();
  tradePoints.GLD = gldHistory;
  tradePoints.SPXL = spxlHistory;
  drawCharts("5y");
})();
