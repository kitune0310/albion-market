let itemList=[]
let priceChart=null

const cities=[
"Bridgewatch",
"Martlock",
"Lymhurst",
"Fort Sterling",
"Thetford",
"Caerleon",
"Black Market"
]

async function loadItems(){

let res=await fetch("https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json")

itemList=await res.json()

}

document.getElementById("search").addEventListener("input",searchItem)

document.getElementById("items").addEventListener("change",loadPrices)

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

function updateIcon(item){

document.getElementById("itemIcon").src=
"https://render.albiononline.com/v1/item/"+item+".png"

}

async function loadPrices(){

let item=document.getElementById("items").value
if(!item) return

updateIcon(item)

let weight=parseFloat(document.getElementById("weight").value||1)
let minProfit=parseInt(document.getElementById("minProfit").value||0)

let server=document.getElementById("server").value

document.getElementById("result").innerHTML='<div class="loading">市場データ取得中...</div>'

let url="https://"+server+".albion-online-data.com/api/v2/stats/prices/"+item+"?locations="+cities.join(",")

let res=await fetch(url)
let data=await res.json()

let market={}

cities.forEach(c=>{
market[c]={sell:999999999,buy:0}
})

data.forEach(d=>{

if(!market[d.city]) return

if(d.sell_price_min>0 && d.sell_price_min<market[d.city].sell)
market[d.city].sell=d.sell_price_min

if(d.buy_price_max>market[d.city].buy)
market[d.city].buy=d.buy_price_max

})

drawChart(market)
drawPriceTable(market)
calculateTrades(market,weight,minProfit)

}

function drawPriceTable(market){

let table=document.getElementById("priceTable")

table.innerHTML="<tr><th>都市</th><th>最安購入</th><th>最高売却</th></tr>"

for(let city in market){

table.innerHTML+=`

<tr>
<td>${city}</td>
<td>${market[city].sell}</td>
<td>${market[city].buy}</td>
</tr>
`

}

}

function drawChart(market){

let labels=[]
let buy=[]
let sell=[]

for(let city in market){

labels.push(city)
buy.push(market[city].sell)
sell.push(market[city].buy)

}

let ctx=document.getElementById("priceChart")

if(priceChart) priceChart.destroy()

priceChart=new Chart(ctx,{
type:"bar",
data:{
labels:labels,
datasets:[
{label:"最安購入",data:buy,backgroundColor:"cyan"},
{label:"最高売却",data:sell,backgroundColor:"orange"}
]
}
})

}

function calculateTrades(market,weight,minProfit){

let trades=[]

for(let buyCity in market){

for(let sellCity in market){

if(buyCity===sellCity) continue

let buy=market[buyCity].sell
let sell=market[sellCity].buy

if(buy==999999999||sell==0) continue

let profit=Math.floor(sell*0.935-buy)

if(profit>minProfit){

trades.push({
buyCity,
sellCity,
profit,
ppkg:(profit/weight).toFixed(2),
roi:((profit/buy)*100).toFixed(1)
})

}

}

}

trades.sort((a,b)=>b.profit-a.profit)

let table=document.getElementById("tradeTable")

table.innerHTML="<tr><th>購入都市</th><th>販売都市</th><th>利益</th><th>利益/kg</th><th>利益率</th></tr>"

trades.slice(0,30).forEach(t=>{

let color="orange"

if(t.profit>20000) color="lime"
else if(t.profit>5000) color="yellow"

table.innerHTML+=`

<tr>
<td>${t.buyCity}</td>
<td>${t.sellCity}</td>
<td style="color:${color}">+${t.profit}</td>
<td>${t.ppkg}</td>
<td>${t.roi}%</td>
</tr>`

})

if(trades.length>0){

let best=trades[0]

document.getElementById("bestTrade").innerHTML=
"🔥 BEST TRADE "+best.buyCity+" → "+best.sellCity+" 利益 "+best.profit

}

document.getElementById("result").innerHTML="分析完了"

}

async function scanBlackMarket(){

document.getElementById("result").innerHTML='<div class="loading">Black Market スキャン中...</div>'

let best=[]

let sample=itemList.slice(0,800)

await Promise.all(sample.map(async item=>{

try{

let res=await fetch("https://east.albion-online-data.com/api/v2/stats/prices/"+item.UniqueName+"?locations=Caerleon,Black Market")

let data=await res.json()

if(data.length<2) return

let buy=data[0].sell_price_min
let sell=data[1].buy_price_max

let profit=Math.floor(sell*0.935-buy)

if(profit>0){

let weight=item.Weight||1

best.push({

name:item.LocalizedNames?.["JA-JP"]||item.UniqueName,
profit,
ppkg:(profit/weight).toFixed(2)

})

}

}catch(e){}

}))

best.sort((a,b)=>b.profit-a.profit)

let table=document.getElementById("bestItems")

table.innerHTML="<tr><th>アイテム</th><th>利益</th><th>利益/kg</th></tr>"

best.slice(0,20).forEach(b=>{

table.innerHTML+=`

<tr>
<td>${b.name}</td>
<td style="color:lime">${b.profit}</td>
<td>${b.ppkg}</td>
</tr>`

})

document.getElementById("result").innerHTML="スキャン完了"

}

loadItems()

setInterval(loadPrices,30000)
