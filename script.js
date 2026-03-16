let itemList=[]
let priceChart=null

const cities=["Bridgewatch","Martlock","Lymhurst","Fort Sterling","Thetford","Caerleon","Black Market"]
const mounts=[{type:"Pack Horse",capacity:400},{type:"Ox",capacity:800},{type:"Donkey",capacity:200}]
const cityZones={"Bridgewatch":"Safe","Martlock":"Safe","Lymhurst":"Safe","Fort Sterling":"Safe","Thetford":"Yellow","Caerleon":"Red","Black Market":"Red"}

// アイテム読み込み
async function loadItems(){
    let res=await fetch("https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json")
    itemList=await res.json()
}
document.getElementById("search").addEventListener("input",searchItem)

// アイテム検索
function searchItem(){
    let text=document.getElementById("search").value.toLowerCase()
    let tier=document.getElementById("tier").value
    let select=document.getElementById("items")
    select.innerHTML=""
    itemList.forEach(item=>{
        if(!item.LocalizedNames) return
        let name=item.LocalizedNames["JA-JP"]||""
        if(tier && !item.UniqueName.startsWith(tier)) return
        if(name.toLowerCase().includes(text)){
            let option=document.createElement("option")
            option.value=item.UniqueName
            option.text=name
            select.appendChild(option)
        }
    })
}

// アイテムアイコン更新
function updateIcon(item){
    document.getElementById("itemIcon").src="https://render.albiononline.com/v1/item/"+item+".png"
}

// 市場価格取得・AI計算
async function loadPrices(){
    let item=document.getElementById("items").value
    if(!item) return
    updateIcon(item)
    let weight=parseFloat(document.getElementById("weight").value||1)
    let cargo=parseFloat(document.getElementById("cargo").value||800)
    let server=document.getElementById("server").value
    document.getElementById("result").innerHTML="AI分析中..."
    let url="https://"+server+".albion-online-data.com/api/v2/stats/prices/"+item+"?locations="+cities.join(",")
    let res=await fetch(url)
    let data=await res.json()
    let market={}
    cities.forEach(c=>{market[c]={sell:999999999,buy:0}})
    data.forEach(d=>{
        if(!market[d.city]) return
        if(d.sell_price_min>0 && d.sell_price_min<market[d.city].sell) market[d.city].sell=d.sell_price_min
        if(d.buy_price_max>market[d.city].buy) market[d.city].buy=d.buy_price_max
    })
    drawChart(market)
    drawPriceTable(market)
    calculateTrades(market,weight,cargo)
}

// 都市価格テーブル描画
function drawPriceTable(market){
    let table=document.getElementById("priceTable")
    table.innerHTML="<tr><th>都市</th><th>最安購入</th><th>最高売却</th></tr>"
    for(let city in market){
        table.innerHTML+=`<tr><td>${city}</td><td>${market[city].sell}</td><td>${market[city].buy}</td></tr>`
    }
}

// 価格チャート描画
function drawChart(market){
    let labels=[],buy=[],sell=[]
    for(let city in market){labels.push(city);buy.push(market[city].sell);sell.push(market[city].buy)}
    let ctx=document.getElementById("priceChart")
    if(priceChart) priceChart.destroy()
    priceChart=new Chart(ctx,{type:"bar",data:{labels:labels,datasets:[{label:"最安購入",data:buy,backgroundColor:"cyan"},{label:"最高売却",data:sell,backgroundColor:"orange"}]}})
}

// トレード計算（リアルタイムAI）
function calculateTrades(market,weight,cargo){
    let trades=[]
    for(let buyCity in market){
        for(let sellCity in market){
            if(buyCity===sellCity) continue
            let buy=market[buyCity].sell
            let sell=market[sellCity].buy
            if(buy==999999999||sell==0) continue
            let profit=Math.floor(sell*0.935-buy)
            let cargoProfit=Math.floor((cargo/weight)*profit)
            trades.push({
                buyCity,sellCity,profit,ppkg:(profit/weight).toFixed(2),
                cargoProfit,
                roi:((profit/buy)*100).toFixed(1),
                mount:mounts.find(m=>m.capacity>=cargo)?.type||"Custom",
                zone:cityZones[sellCity]||"Unknown"
            })
        }
    }
    trades.sort((a,b)=>b.cargoProfit-a.cargoProfit)
    let table=document.getElementById("tradeTable")
    table.innerHTML="<tr><th>購入都市</th><th>販売都市</th><th>利益</th><th>利益/kg</th><th>総利益</th><th>ROI</th></tr>"
    trades.slice(0,30).forEach(t=>{
        table.innerHTML+=`<tr>
            <td>${t.buyCity}</td><td>${t.sellCity}</td><td>${t.profit}</td><td>${t.ppkg}</td>
            <td style="color:gold">${t.cargoProfit}</td><td>${t.roi}%</td>
        </tr>`
    })
    if(trades.length>0){
        let best=trades[0]
        document.getElementById("bestTrade").innerHTML=`🔥 BEST TRADE ${best.buyCity} → ${best.sellCity} 総利益 ${best.cargoProfit}`
    }
    document.getElementById("result").innerHTML="AI分析完了"
}

// Black Market分析
async function scanBlackMarket(){
    document.getElementById("result").innerHTML="Black Market AIスキャン中..."
    let best=[]
    let sample=itemList.slice(0,400)
    for(let item of sample){
        try{
            let res=await fetch("https://east.albion-online-data.com/api/v2/stats/prices/"+item.UniqueName+"?locations=Caerleon,Black Market")
            let data=await res.json()
            if(data.length<2) continue
            let buy=data[0].sell_price_min
            let sell=data[1].buy_price_max
            let profit=Math.floor(sell*0.935-buy)
            if(profit>0){
                let weight=item.Weight||1
                best.push({name:item.LocalizedNames?.["JA-JP"]||item.UniqueName,profit,ppkg:(profit/weight).toFixed(2)})
            }
        }catch(e){}
    }
    best.sort((a,b)=>b.ppkg-a.ppkg)
    let table=document.getElementById("bestItems")
    table.innerHTML="<tr><th>アイテム</th><th>利益</th><th>利益/kg</th></tr>"
    best.slice(0,20).forEach(b=>{
        table.innerHTML+=`<tr><td>${b.name}</td><td>${b.profit}</td><td>${b.ppkg}</td></tr>`
    })
    document.getElementById("result").innerHTML="Black Market AI完了"
}

// 全アイテムAIトレードルート生成
async function scanAllTrades(){
    document.getElementById("result").innerHTML="🌍 AI全アイテム分析中..."
    let cargo=parseFloat(document.getElementById("cargo").value||800)
    let best=[]
    let sample=itemList.slice(0,1500)
    for(let item of sample){
        try{
            let url="https://east.albion-online-data.com/api/v2/stats/prices/"+item.UniqueName+"?locations="+cities.join(",")
            let res=await fetch(url)
            let data=await res.json()
            let market={}
            cities.forEach(c=>{market[c]={sell:999999999,buy:0}})
            data.forEach(d=>{
                if(d.sell_price_min>0 && d.sell_price_min<market[d.city].sell) market[d.city].sell=d.sell_price_min
                if(d.buy_price_max>market[d.city].buy) market[d.city].buy=d.buy_price_max
            })
            for(let buyCity in market){
                for(let sellCity in market){
                    if(buyCity===sellCity) continue
                    let buy=market[buyCity].sell
                    let sell=market[sellCity].buy
                    if(buy==999999999||sell==0) continue
                    let profit=Math.floor(sell*0.935-buy)
                    let weight=item.Weight||1
                    let cargoProfit=Math.floor((cargo/weight)*profit)
                    if(cargoProfit>50000){
                        best.push({
                            item:item.LocalizedNames?.["JA-JP"]||item.UniqueName,
                            buyCity,sellCity,cargoProfit,
                            mount:mounts.find(m=>m.capacity>=cargo)?.type||"Custom",
                            zone:cityZones[sellCity]||"Unknown"
                        })
                    }
                }
            }
        }catch(e){}
    }
    best.sort((a,b)=>b.cargoProfit-a.cargoProfit)
    let table=document.getElementById("cargoTrades")
    table.innerHTML="<tr><th>アイテム</th><th>購入都市</th><th>販売都市</th><th>総利益</th><th>推奨マウント</th><th>危険ゾーン</th></tr>"
    best.slice(0,30).forEach(b=>{
        table.innerHTML+=`<tr>
            <td>${b.item}</td><td>${b.buyCity}</td><td>${b.sellCity}</td><td style="color:lime">${b.cargoProfit}</td>
            <td>${b.mount}</td><td>${b.zone}</td>
        </tr>`
    })
    document.getElementById("result").innerHTML="AI全アイテム分析完了"
}

// 初期読み込み
loadItems()

// 自動5秒毎リアルタイム更新
setInterval(()=>{
    if(document.getElementById("items").value) loadPrices()
},5000)
