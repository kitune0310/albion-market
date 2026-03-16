
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

function searchItem(){

let text=document.getElementById("search").value.toLowerCase()

let select=document.getElementById("items")

select.innerHTML=""

itemList.forEach(item=>{

if(item.LocalizedNames && item.LocalizedNames["JA-JP"]){

let name=item.LocalizedNames["JA-JP"].toLowerCase()

if(name.includes(text)){

let option=document.createElement("option")

option.value=item.UniqueName

option.text=item.LocalizedNames["JA-JP"]

select.appendChild(option)

}

}

})

}

function updateIcon(item){

document.getElementById("itemIcon").src=
"https://render.albiononline.com/v1/item/"+item+".png"

}

async function loadPrices(){

let item=document.getElementById("items").value

if(!item){

alert("アイテム選択")

return

}

updateIcon(item)

let weight=parseFloat(document.getElementById("weight").value)

if(!weight || weight<=0) weight=1

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

if(d.sell_price_min>0 && d.sell_price_min<market[d.city].sell){

market[d.city].sell=d.sell_price_min

}

if(d.buy_price_max>market[d.city].buy){

market[d.city].buy=d.buy_price_max

}

})

let priceTable=document.getElementById("priceTable")

priceTable.innerHTML="<tr><th>都市</th><th>最安購入</th><th>最高売却</th></tr>"

let chartCities=[]
let sellPrices=[]
let buyPrices=[]

Object.keys(market).forEach(city=>{

let sell=market[city].sell

let buy=market[city].buy

if(sell==999999999 && buy==0) return

priceTable.innerHTML+=`

<tr>
<td>${city}</td>
<td>${sell==999999999?"-":sell}</td>
<td>${buy==0?"-":buy}</td>
</tr>

`

chartCities.push(city)

sellPrices.push(sell==999999999?0:sell)

buyPrices.push(buy)

})

let trades=[]

for(let buyCity in market){

for(let sellCity in market){

if(buyCity===sellCity) continue

let buy=market[buyCity].sell

let sell=market[sellCity].buy

if(buy==999999999 || sell==0) continue

let profit=Math.floor(sell*0.935-buy)

if(profit>minProfit){

trades.push({

buyCity:buyCity,

sellCity:sellCity,

profit:profit,

ppkg:(profit/weight).toFixed(2),

roi:((profit/buy)*100).toFixed(1)

})

}

}

}

trades.sort((a,b)=>b.profit-a.profit)

let tradeTable=document.getElementById("tradeTable")

tradeTable.innerHTML="<tr><th>購入都市</th><th>販売都市</th><th>利益</th><th>利益/kg</th><th>利益率</th></tr>"

trades.slice(0,30).forEach(t=>{

let color="white"

if(t.profit>20000) color="lime"
else if(t.profit>10000) color="yellow"

tradeTable.innerHTML+=`

<tr>

<td>${t.buyCity}</td>

<td>${t.sellCity}</td>

<td style="color:${color}">+${t.profit}</td>

<td class="good">${t.ppkg}</td>

<td>${t.roi}%</td>

</tr>

`

})

if(trades.length>0){

let best=trades[0]

document.getElementById("bestTrade").innerHTML=

"🔥 BEST TRADE: "+best.buyCity+" → "+best.sellCity+" 利益 "+best.profit

}

let ctx=document.getElementById("priceChart").getContext("2d")

if(priceChart) priceChart.destroy()

priceChart=new Chart(ctx,{

type:"bar",

data:{

labels:chartCities,

datasets:[

{

label:"最安購入",

data:sellPrices,

backgroundColor:"#00eaff"

},

{

label:"最高売却",

data:buyPrices,

backgroundColor:"#ffd700"

}

]

},

options:{

responsive:true,

plugins:{

legend:{labels:{color:"white"}}

},

scales:{

x:{ticks:{color:"white"}},

y:{ticks:{color:"white"}}

}

}

})

document.getElementById("result").innerHTML="市場分析完了"

}

loadItems()

setInterval(loadPrices,30000)
