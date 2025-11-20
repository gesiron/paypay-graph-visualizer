import os
import json
import base64
import requests
from datetime import datetime
from google.cloud import firestore
from google.oauth2 import service_account

# --- Firestore認証 ---
creds_json = base64.b64decode(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
creds_dict = json.loads(creds_json)
creds = service_account.Credentials.from_service_account_info(creds_dict)
db = firestore.Client(credentials=creds)

# --- Alpha Vantage設定 ---
API_KEY = os.environ["ALPHA_VANTAGE_API_KEY"]
ETFS = ["VOO", "VTI", "QQQ"]  # 監視対象のETFシンボル

def fetch_price(symbol):
    url = f"https://www.alphavantage.co/query"
    params = {
        "function": "TIME_SERIES_DAILY_ADJUSTED",
        "symbol": symbol,
        "apikey": API_KEY,
        "outputsize": "compact"
    }
    response = requests.get(url, params=params)
    data = response.json()
    time_series = data.get("Time Series (Daily)", {})
    if not time_series:
        print(f"[{symbol}] データ取得失敗")
        return None

    latest_date = sorted(time_series.keys())[-1]
    close_price = float(time_series[latest_date]["4. close"])
    return latest_date, close_price

def save_to_firestore(symbol, date_str, price):
    doc_ref = db.collection(symbol).document(date_str)
    doc_ref.set({
        "date": date_str,
        "price": price,
        "timestamp": firestore.SERVER_TIMESTAMP
    })
    print(f"[{symbol}] {date_str} の価格 {price} を保存しました")

def main():
    for symbol in ETFS:
        result = fetch_price(symbol)
        if result:
            date_str, price = result
            save_to_firestore(symbol, date_str, price)

if __name__ == "__main__":
    main()
