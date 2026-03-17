let itemList=[]
let priceChart=null

const cities=["Bridgewatch","Martlock","Lymhurst","Fort Sterling","Thetford","Caerleon","Black Market"]

const mounts=[
    {type:"Pack Horse",capacity:400},
    {type:"Ox",capacity:800},
    {type:"Donkey",capacity:200}
]

const cityZones={
    "Bridgewatch":"Safe",
    "Martlock":"Safe",
    "Lymhurst":"Safe",
    "Fort Sterling":"Safe",
    "Thetford":"Yellow",
    "Caerleon":"Red",
    "Black Market":"Red"
}

// =========================
// アイテム読み込み
// =========================
async function loadItems(){
    let res=await fetch("https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json")
    itemList=await res.json()
}

document.getElementById("search").addEventListener("input",searchItem)

// =========================
// アイテム検索
// =========================
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

// =========================
// アイコン
// =========================
function updateIcon(item){
    document.getElementById("itemIcon").src=
    "https://render.albiononline.com/v1/item/"+item+".png"
}

// =========================
// メイン分析
// =========================
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

        if(d.sell_price_min>0 && d.sell_price_min<market[d.city].sell){
            market[d.city].sell=d.sell_price_min
        }

        if(d.buy_price_max>market[d.city].buy){
            market[d.city].buy=d.buy_price_max
        }
    })

    drawChart(market)
    drawPriceTable(market)
    calculateTrades(market,weight,cargo)
}

// =========================
// 価格テーブル
// =========================
function drawPriceTable(market){

    let table=document.getElementById("priceTable")

    table.innerHTML="<tr><th>都市</th><th>最安購入</th><th>最高売却</th></tr>"

    for(let city in market){
        table.innerHTML+=`
        <tr>
            <td>${city}</td>
            <td>${market[city].sell}</td>
            <td>${market[city].buy}</td>
        </tr>`
    }
}

// =========================
// グラフ（棒＋折れ線＋利益）
// =========================
function drawChart(market){

    let labels=[],buy=[],sell=[],profit=[]

    for(let city in market){
        labels.push(city)

        let b=market[city].sell
        let s=market[city].buy

        buy.push(b)
        sell.push(s)
        profit.push(s - b)
    }

    let ctx=document.getElementById("priceChart")

    if(priceChart) priceChart.destroy()

    priceChart=new Chart(ctx,{
        data:{
            labels:labels,
            datasets:[
                {
                    type:"bar",
                    label:"最安購入",
                    data:buy,
                    backgroundColor:"rgba(0,255,255,0.5)"
                },
                {
                    type:"line",
                    label:"最高売却",
                    data:sell,
                    borderColor:"orange",
                    backgroundColor:"orange",
                    tension:0.3,
                    pointRadius:5
                },
                {
                    type:"line",
                    label:"都市差利益",
                    data:profit,
                    borderColor:"lime",
                    backgroundColor:"lime",
                    tension:0.3,
                    pointRadius:4
                }
            ]
        },
        options:{
            responsive:true,
            plugins:{
                legend:{
                    labels:{color:"white"}
                },
                tooltip:{
                    callbacks:{
                        label:function(ctx){
                            return ctx.dataset.label + ": " + ctx.raw.toLocaleString()
                        }
                    }
                }
            },
            scales:{
                x:{ticks:{color:"white"}},
                y:{ticks:{color:"white"}}
            }
        }
    })
}

// =========================
// トレード計算
// =========================
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
                buyCity,
                sellCity,
                profit,
                ppkg:(profit/weight).toFixed(2),
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
        table.innerHTML+=`
        <tr>
            <td>${t.buyCity}</td>
            <td>${t.sellCity}</td>
            <td>${t.profit}</td>
            <td>${t.ppkg}</td>
            <td style="color:gold">${t.cargoProfit}</td>
            <td>${t.roi}%</td>
        </tr>`
    })

    if(trades.length>0){
        let best=trades[0]
        document.getElementById("bestTrade").innerHTML=
        `🔥 BEST TRADE ${best.buyCity} → ${best.sellCity} 総利益 ${best.cargoProfit}`
    }

    document.getElementById("result").innerHTML="AI分析完了"
}

// =========================
// 初期化
// =========================
loadItems()

// リアルタイム更新
setInterval(()=>{
    if(document.getElementById("items").value){
        loadPrices()
    }
},5000)
