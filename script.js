// Firebase CDNモジュール読み込み
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Chart.jsとLuxonはグローバル読み込み済み
const ChartJS = window.Chart;
const luxon = window.luxon;

// Firebase設定
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

// Alpha Vantage APIからETF価格を取得
async function fetchETFPrice(symbol) {
  const apiKey = 'XYL4EVSMPCABG61C';
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log("Alpha Vantageレスポンス:", data); // ← 追加

    if (!data['Time Series (Daily)']) {
      console.error('データ取得失敗:', data);
      return null;
    }

    const timeSeries = data['Time Series (Daily)'];
    const latestDate = Object.keys(timeSeries).sort().pop();
    const latestClose = timeSeries[latestDate]['4. close'];

    return {
      symbol,
      date: latestDate,
      close: parseFloat(latestClose)
    };
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    return null;
  }
}

// ETF価格を表示
window.showPrice = async function showPrice() {
  const symbol = document.getElementById("symbolInput").value.trim().toUpperCase();
  const result = await fetchETFPrice(symbol);

  document.getElementById("priceResult").innerText = result
    ? `${result.symbol} の最新価格（${result.date}）: ${result.close} USD`
    : "価格の取得に失敗しました。";
};

// 売買ポイント管理
const tradePoints = { GLD: [], SPXL: [] };

window.addOrUpdateTradePoint = async function addOrUpdateTradePoint() {
  const course = document.getElementById("courseSelect").value;
  const date = document.getElementById("tradeDate").value;
  const type = document.getElementById("tradeType").value;
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

  console.log("保存するデータ:", { course, date, type, amount, price }); // ← 追加

  await setDoc(doc(tradesRef, docId), { course, date, type, amount, price });
  await loadTradePoints();
  drawCharts(document.getElementById("periodSelector").value);
};

window.deleteTradePoint = async function deleteTradePoint() {
  const course = document.getElementById("courseSelect").value;
  const date = document.getElementById("tradeDate").value;
  const docId = `${course}_${date}`;
  await deleteDoc(doc(tradesRef, docId));
  await loadTradePoints();
  drawCharts(document.getElementById("periodSelector").value);
};

async function loadTradePoints() {
  const snapshot = await getDocs(tradesRef);
  tradePoints.GLD = [];
  tradePoints.SPXL = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log("Firestoreデータ:", data); // ← 追加

    if (tradePoints[data.course]) {
      tradePoints[data.course].push({
        date: data.date.replace(/\//g, "-"), // Luxon対応
        type: data.type,
        amount: data.amount,
        price: data.price
      });
    }
  });
}

// グラフ描画（期間フィルタ付き）
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

  const gldData = tradePoints.GLD
    .filter(tp => tp.price !== null && luxon.DateTime.fromISO(tp.date) >= startDate)
    .map(tp => ({ x: tp.date, y: tp.price }));

  const spxlData = tradePoints.SPXL
    .filter(tp => tp.price !== null && luxon.DateTime.fromISO(tp.date) >= startDate)
    .map(tp => ({ x: tp.date, y: tp.price }));

  const config = (label, data, color) => ({
    type: 'line',
    data: {
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + '33',
        tension: 0.3
      }]
    },
    options: {
      parsing: false,
      responsive: true,
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day' },
          title: { display: true, text: '日付' }
        },
        y: {
          beginAtZero: false,
          title: { display: true, text: '価格（USD）' }
        }
      },
      plugins: { legend: { display: true } }
    }
  });

  if (window.gldChartInstance) window.gldChartInstance.destroy();
  if (window.spxlChartInstance) window.spxlChartInstance.destroy();

  window.gldChartInstance = new ChartJS(document.getElementById("gldChart"), config("GLD価格", gldData, "gold"));
  window.spxlChartInstance = new ChartJS(document.getElementById("spxlChart"), config("SPXL価格", spxlData, "red"));
}

// 表示期間変更時にグラフ更新
document.getElementById("periodSelector").addEventListener("change", (e) => {
  drawCharts(e.target.value);
});

// 初期読み込み
(async () => {
  await loadTradePoints();
  drawCharts("1m");
})();
