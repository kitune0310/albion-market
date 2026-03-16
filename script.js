let itemList = [];
let cityOrder = ["Bridgewatch","Martlock","Thetford","Fort Sterling","Lymhurst","Caerleon","Brecilien"];
let distances = {
  "Bridgewatch-Martlock":1, "Bridgewatch-Thetford":2, "Bridgewatch-Fort Sterling":3, "Bridgewatch-Lymhurst":2, "Bridgewatch-Caerleon":4,
  "Martlock-Thetford":1, "Martlock-Fort Sterling":2, "Martlock-Lymhurst":3, "Martlock-Caerleon":4,
  "Thetford-Fort Sterling":1, "Thetford-Lymhurst":2, "Thetford-Caerleon":3,
  "Fort Sterling-Lymhurst":1, "Fort Sterling-Caerleon":2,
  "Lymhurst-Caerleon":2
};

// アイテム読み込み
async function loadItems() {
  let res = await fetch("https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json");
  itemList = await res.json();
}
loadItems();

// アイテム検索
document.getElementById("search").addEventListener("input", ()=>{
  let text = document.getElementById("search").value.toLowerCase();
  let select = document.getElementById("items");
  select.innerHTML = "";
  itemList.forEach(item=>{
    if(item.LocalizedNames && item.LocalizedNames["JA-JP"]){
      let name = item.LocalizedNames["JA-JP"].toLowerCase();
      if(name.includes(text)){
        let option = document.createElement("option");
        option.value = item.UniqueName;
        option.text = item.LocalizedNames["JA-JP"];
        select.appendChild(option);
      }
    }
  });
});

// 市場分析ボタン
document.getElementById("analyzeBtn").addEventListener("click", ()=>{
  let item = document.getElementById("items").value;
  if(!item){ alert("アイテムを選択してください"); return; }
  let weight = parseFloat(document.getElementById("weight").value)||1;
  let server = document.getElementById("server").value;
  analyzeItem(item, weight, server);
});

// T4〜T8全スキャン
document.getElementById("scanAllBtn").addEventListener("click", async ()=>{
  document.getElementById("result").innerHTML='<div class="loading">全アイテムスキャン中...</div>';
  let tLevels = ["T4","T5","T6","T7","T8"];
  let server = document.getElementById("server").value;
  let topTrades = [];

  for(let t of tLevels){
    let items = itemList.filter(i=>i.UniqueName.includes(t));
    for(let it of items){
      let trade = await getTopTrade(it.UniqueName, 1, server);
      if(trade) topTrades.push(trade);
    }
  }

  topTrades.sort((a,b)=>b.profit - a.profit);
  let best5 = topTrades.slice(0,5);
  let html = "今日の上位5トレード:<br>";
  best5.forEach(t=>{
    html += `${t.name} | ${t.buyCity} → ${t.sellCity} | 利益 +${t.profit} | 効率 ${t.efficiency}<br>`;
  });
  document.getElementById("result").innerHTML = html;
});

// 市場分析
async function analyzeItem(item, weight, server){
  document.getElementById("result").innerHTML='<div class="loading">市場データ取得中...</div>';
  let trade = await getTopTrade(item, weight, server);
  displayTrade(trade, weight);
}

// トップトレード取得
async function getTopTrade(item, weight, server){
  let url = `https://${server}.albion-online-data.com/api/v2/stats/prices/${item}.json`;
  let res = await fetch(url);
  let data = await res.json();

  let cities = {};
  data.forEach(d=>{
    let city = d.city;
    if(!cities[city]) cities[city]={sell:999999999, buy:0};
    if(d.sell_price_min>0 && d.sell_price_min<cities[city].sell) cities[city].sell=d.sell_price_min;
    if(d.buy_price_max>cities[city].buy) cities[city].buy=d.buy_price_max;
  });

  // ブラックマーケット対応（Caerleon）
  let bm = data.filter(d=>d.city=="Caerleon" && d.city.includes("Black Market"));
  if(bm.length>0) cities["Caerleon BM"]={sell:bm[0].sell_price_min, buy:bm[0].buy_price_max};

  let trades=[];
  for(let buyCity in cities){
    for(let sellCity in cities){
      if(buyCity!==sellCity){
        let buy = cities[buyCity].sell;
        let sell = cities[sellCity].buy;
        let profit = Math.floor(sell*0.935 - buy);
        let key = `${buyCity}-${sellCity}`;
        let distance = distances[key]||1;
        let efficiency = (profit/weight/distance).toFixed(2);
        if(profit>0){
          trades.push({name:item, buyCity, sellCity, profit, ppkg:(profit/weight).toFixed(2), roi:((profit/buy)*100).toFixed(1), efficiency});
        }
      }
    }
  }
  trades.sort((a,b)=>b.profit-a.profit);
  return trades[0]||null;
}

// トレード表示
function displayTrade(trade, weight){
  if(!trade){ document.getElementById("result").innerHTML="有効なトレードが見つかりませんでした。"; return; }

  let tradeTable = document.getElementById("tradeTable");
  tradeTable.innerHTML="<tr><th>購入都市</th><th>販売都市</th><th>利益</th><th>利益/kg</th><th>効率</th><th>利益率%</th></tr>";
  let cls = trade.profit>10000?"high":trade.profit>5000?"medium":"low";
  tradeTable.innerHTML+=`
    <tr>
      <td>${trade.buyCity}</td>
      <td>${trade.sellCity}</td>
      <td class="profit ${cls}">+${trade.profit}</td>
      <td class="good">${trade.ppkg}</td>
      <td class="good">${trade.efficiency}</td>
      <td>${trade.roi}%</td>
    </tr>
  `;

  document.getElementById("result").innerHTML=`分析完了: ${trade.name} | ${trade.buyCity} → ${trade.sellCity} | 利益 +${trade.profit} | 効率 ${trade.efficiency}`;

  let ctx = document.getElementById("priceChart").getContext("2d");
  if(window.priceChart) window.priceChart.destroy();
  window.priceChart = new Chart(ctx,{
    type:"bar",
    data:{
      labels:[trade.buyCity, trade.sellCity],
      datasets:[
        {label:"購入価格", data:[0, trade.profit], backgroundColor:"#00eaff"},
        {label:"利益", data:[0, trade.profit], backgroundColor:"#ffd700"}
      ]
    },
    options:{
      plugins:{legend:{labels:{color:"white"}}},
      scales:{x:{ticks:{color:"white"}}, y:{ticks:{color:"white"}}}
    }
  });
}

// 自動更新
setInterval(()=>{
  let item = document.getElementById("items").value;
  if(item){
    let weight = parseFloat(document.getElementById("weight").value)||1;
    let server = document.getElementById("server").value;
    analyzeItem(item, weight, server);
  }
}, 30000);
