import os
import json
import base64
import requests
from datetime import datetime
from google.cloud import firestore
from google.oauth2 import service_account

# --- Firestore認証 ---
try:
    creds_json = base64.b64decode(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
    creds_dict = json.loads(creds_json)
    creds = service_account.Credentials.from_service_account_info(creds_dict)
    db = firestore.Client(credentials=creds)
except Exception as e:
    print(f"[Firestore認証エラー] {e}")
    exit(1)

# --- Alpha Vantage設定 ---
API_KEY = os.environ.get("ALPHA_VANTAGE_API_KEY")
ETFS = ["VOO", "VTI", "QQQ"]  # 監視対象のETFシンボル

def fetch_price(symbol):
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "TIME_SERIES_DAILY",  # ← 無料で使えるエンドポイントに変更
        "symbol": symbol,
        "apikey": API_KEY,
        "outputsize": "compact"
    }
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        # エラーメッセージの補足表示
        if "Error Message" in data:
            print(f"[{symbol}] APIエラー: {data['Error Message']}")
            return None
        if "Note" in data:
            print(f"[{symbol}] API制限: {data['Note']}")
            return None

        time_series = data.get("Time Series (Daily)", {})
        if not time_series:
            print(f"[{symbol}] データ取得失敗（APIレスポンスにデータなし）")
            return None

        latest_date = sorted(time_series.keys())[-1]
        close_price = float(time_series[latest_date]["4. close"])
        return latest_date, close_price
    except Exception as e:
        print(f"[{symbol}] データ取得エラー: {e}")
        return None

def save_to_firestore(symbol, date_str, price):
    try:
        doc_ref = db.collection(symbol).document(date_str)
        doc_ref.set({
            "date": date_str,
            "price": price,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        print(f"[{symbol}] {date_str} の価格 {price} を保存しました")
    except Exception as e:
        print(f"[{symbol}] Firestore保存エラー: {e}")

def main():
    for symbol in ETFS:
        result = fetch_price(symbol)
        if result:
            date_str, price = result
            save_to_firestore(symbol, date_str, price)
        else:
            print(f"[{symbol}] 処理スキップ（データ取得失敗）")

if __name__ == "__main__":
    main()