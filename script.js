// Firebase CDNモジュール読み込み
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Chart.js / Luxon は index.html の CDN でグローバル提供
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

// Alpha Vantage APIからETF価格を取得（レスポンスログ付き）
async function fetchETFPrice(symbol) {
  const apiKey = "XYL4EVSMPCABG61C";
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    // ★ APIレスポンスを必ず確認
    console.log("Alpha Vantageレスポンス:", data);

    if (!data["Time Series (Daily)"]) {
      console.error("データ取得失敗:", data);
      return null;
    }

    const timeSeries = data["Time Series (Daily)"];
    // もっとも新しい日付（キーをソートして末尾）
    const latestDate = Object.keys(timeSeries).sort().pop();
    const latestClose = parseFloat(timeSeries[latestDate]["4. close"]);

    return { symbol, date: latestDate, close: latestClose };
  } catch (error) {
    console.error("API呼び出しエラー:", error);
    return null;
  }
}

// 価格を表示（ボタン連動）
window.showPrice = async function showPrice() {
  const symbol = document.getElementById("symbolInput").value.trim().toUpperCase();
  const result = await fetchETFPrice(symbol);
  document.getElementById("priceResult").innerText =
    result ? `${result.symbol} の最新価格（${result.date}）: ${result.close} USD`
           : "価格の取得に失敗しました。";
};

// 売買ポイント管理（GLD/SPXL）
const tradePoints = { GLD: [], SPXL: [] };

// 追加/更新
window.addOrUpdateTradePoint = async function addOrUpdateTradePoint() {
  const course = document.getElementById("courseSelect").value;
  const date = document.getElementById("tradeDate").value; // yyyy-mm-dd or yyyy/mm/dd
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

  // ★ Firestore保存直前の確認ログ
  console.log("保存するデータ:", { course, date, type, amount, price });

  await setDoc(doc(tradesRef, docId), { course, date, type, amount, price });
  await loadTradePoints();
  drawCharts(document.getElementById("periodSelector").value);
};

// 削除
window.deleteTradePoint = async function deleteTradePoint() {
  const course = document.getElementById("courseSelect").value;
  const date = document.getElementById("tradeDate").value;
  const docId = `${course}_${date}`;
  await deleteDoc(doc(tradesRef, docId));
  await loadTradePoints();
  drawCharts(document.getElementById("periodSelector").value);
};

// ★ Firestore読み込みのログ付き（完全版）
async function loadTradePoints() {
  const snapshot = await getDocs(tradesRef);
  tradePoints.GLD = [];
  tradePoints.SPXL = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    // ★ 取得した生データを表示
    console.log("Firestoreデータ:", data);

    // ★ Luxon対応: yyyy/mm/dd → yyyy-mm-dd に正規化
    const normalizedDate = String(data.date).replace(/\//g, "-");

    if (tradePoints[data.course]) {
      tradePoints[data.course].push({
        date: normalizedDate,
        type: data.type,
        amount: data.amount,
        price: data.price
      });
    }
  });

  // ★ 読み込み件数の確認
  console.log("読み込み件数 GLD:", tradePoints.GLD.length, "SPXL:", tradePoints.SPXL.length);
}

// グラフ描画（期間フィルタ＆描画件数ログ付き）
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

  // ★ 描画対象件数の確認
  console.log("描画対象 GLD件数:", gldFiltered.length, "SPXL件数:", spxlFiltered.length);

  const gldData = gldFiltered.map(tp => ({ x: tp.date, y: tp.price }));
  const spxlData = spxlFiltered.map(tp => ({ x: tp.date, y: tp.price }));

  const config = (label, data, color) => ({
    type: "line",
    data: { datasets: [{ label, data, borderColor: color, backgroundColor: color + "33", tension: 0.3 }] },
    options: {
      parsing: false,
      responsive: true,
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

// 表示期間変更時にグラフ更新
document.getElementById("periodSelector").addEventListener("change", (e) => {
  drawCharts(e.target.value);
});

// 初期読み込み
(async () => {
  await loadTradePoints();
  drawCharts("1m");
})();
