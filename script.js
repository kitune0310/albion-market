let itemList=[];

async function loadItems(){

let res=await fetch("https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json");
itemList=await res.json();

}

document.getElementById("search").addEventListener("input",searchItem);

function searchItem(){

let text=document.getElementById("search").value.toLowerCase();
let select=document.getElementById("items");

select.innerHTML="";

itemList.forEach(item=>{

if(item.LocalizedNames && item.LocalizedNames["JA-JP"]){

let name=item.LocalizedNames["JA-JP"].toLowerCase();

if(name.includes(text)){

let option=document.createElement("option");
option.value=item.UniqueName;
option.text=item.LocalizedNames["JA-JP"];

select.appendChild(option);

}

}

});

}

async function loadPrices(){

let item=document.getElementById("items").value;

if(!item){
alert("アイテムを選択してください");
return;
}

let weight=parseFloat(document.getElementById("weight").value);

if(!weight || weight<=0){
weight=1;
}

let server=document.getElementById("server").value;

document.getElementById("result").innerHTML='<div class="loading">市場データ取得中...</div>';

let url="https://"+server+".albion-online-data.com/api/v2/stats/prices/"+item+".json";

let res=await fetch(url);
let data=await res.json();

let cities={};

data.forEach(d=>{

if(!cities[d.city]){
cities[d.city]={sell:999999999,buy:0};
}

if(d.sell_price_min>0 && d.sell_price_min<cities[d.city].sell){
cities[d.city].sell=d.sell_price_min;
}

if(d.buy_price_max>cities[d.city].buy){
cities[d.city].buy=d.buy_price_max;
}

});

let priceTable=document.getElementById("priceTable");

priceTable.innerHTML="<tr><th>都市</th><th>最安購入</th><th>最高売却</th></tr>";

let chartCities=[];
let sellPrices=[];
let buyPrices=[];

/* 全都市自動表示 */

Object.keys(cities).forEach(city=>{

let sell=cities[city].sell;
let buy=cities[city].buy;

let sellText=(sell==999999999 || sell==0)?"-":sell;
let buyText=(buy==0)?"-":buy;

priceTable.innerHTML+=`
<tr>
<td>${city}</td>
<td>${sellText}</td>
<td>${buyText}</td>
</tr>
`;

chartCities.push(city);
sellPrices.push(sell==999999999?0:sell);
buyPrices.push(buy);

});

let trades=[];

for(let buyCity in cities){

for(let sellCity in cities){

if(buyCity!==sellCity){

let buy=cities[buyCity].sell;
let sell=cities[sellCity].buy;

let profit=Math.floor(sell*0.935-buy);

if(profit>0){

trades.push({
buyCity:buyCity,
sellCity:sellCity,
profit:profit,
ppkg:(profit/weight).toFixed(2),
roi:((profit/buy)*100).toFixed(1)
});

}

}

}

}

trades.sort((a,b)=>b.profit-a.profit);

let tradeTable=document.getElementById("tradeTable");

tradeTable.innerHTML="<tr><th>購入都市</th><th>販売都市</th><th>利益</th><th>利益/kg</th><th>利益率</th></tr>";

trades.slice(0,20).forEach(t=>{

tradeTable.innerHTML+=`
<tr>
<td>${t.buyCity}</td>
<td>${t.sellCity}</td>
<td class="profit">+${t.profit}</td>
<td class="good">${t.ppkg}</td>
<td>${t.roi}%</td>
</tr>
`;

});

let ctx=document.getElementById("priceChart").getContext("2d");

if(window.priceChart){
window.priceChart.destroy();
}

window.priceChart=new Chart(ctx,{
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
plugins:{
legend:{labels:{color:"white"}}
},
scales:{
x:{ticks:{color:"white"}},
y:{ticks:{color:"white"}}
}
}
});

document.getElementById("result").innerHTML="市場分析完了";

}

loadItems();
