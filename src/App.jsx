import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

var UNITS = ["個", "本", "枚", "パック", "袋", "g", "kg", "ml", "L", "丁", "房", "束", "玉"];

var EXPIRY_HINTS = {
  "肉・魚": 3, "野菜・果物": 5, "卵・乳製品": 10, "主食": 5,
  "惣菜&弁当": 2, "加工品": 14, "飲料": 30, "保存食": 60, "嗜好品": 14,
};

var CAT_INFO = {
  "肉・魚": { emoji: "🥩", color: "#E53935" },
  "野菜・果物": { emoji: "🥬", color: "#43A047" },
  "卵・乳製品": { emoji: "🥚", color: "#FFB300" },
  "主食": { emoji: "🍚", color: "#8D6E63" },
  "惣菜&弁当": { emoji: "🍱", color: "#F4511E" },
  "加工品": { emoji: "🥫", color: "#6D4C41" },
  "飲料": { emoji: "🥤", color: "#039BE5" },
  "保存食": { emoji: "📦", color: "#5D4037" },
  "嗜好品": { emoji: "🍫", color: "#AB47BC" },
  "その他": { emoji: "🛒", color: "#90A4AE" },
};

var MEAL_TYPES = [
  { id: "breakfast", label: "朝ごはん", emoji: "🌅" },
  { id: "lunch", label: "昼ごはん", emoji: "☀️" },
  { id: "dinner", label: "夜ごはん", emoji: "🌙" },
  { id: "snack", label: "おやつ", emoji: "🍪" },
];

var QUICK_ITEMS = [
  { name: "鶏むね肉", cat: "肉・魚", unit: "g", qty: 300 },
  { name: "鶏もも肉", cat: "肉・魚", unit: "g", qty: 300 },
  { name: "豚こま切れ", cat: "肉・魚", unit: "g", qty: 200 },
  { name: "合挽き肉", cat: "肉・魚", unit: "g", qty: 300 },
  { name: "鮭", cat: "肉・魚", unit: "個", qty: 2 },
  { name: "卵", cat: "卵・乳製品", unit: "パック", qty: 1 },
  { name: "牛乳", cat: "卵・乳製品", unit: "本", qty: 1 },
  { name: "ヨーグルト", cat: "卵・乳製品", unit: "個", qty: 1 },
  { name: "豆腐", cat: "加工品", unit: "丁", qty: 1 },
  { name: "納豆", cat: "加工品", unit: "パック", qty: 1 },
  { name: "にんじん", cat: "野菜・果物", unit: "本", qty: 3 },
  { name: "玉ねぎ", cat: "野菜・果物", unit: "個", qty: 3 },
  { name: "じゃがいも", cat: "野菜・果物", unit: "個", qty: 3 },
  { name: "キャベツ", cat: "野菜・果物", unit: "玉", qty: 1 },
  { name: "もやし", cat: "野菜・果物", unit: "袋", qty: 1 },
  { name: "トマト", cat: "野菜・果物", unit: "個", qty: 3 },
  { name: "大根", cat: "野菜・果物", unit: "本", qty: 1 },
  { name: "ほうれん草", cat: "野菜・果物", unit: "束", qty: 1 },
  { name: "バナナ", cat: "野菜・果物", unit: "房", qty: 1 },
  { name: "きゅうり", cat: "野菜・果物", unit: "本", qty: 3 },
  { name: "パン", cat: "主食", unit: "袋", qty: 1 },
  { name: "うどん", cat: "主食", unit: "袋", qty: 1 },
];

function getToday() {
  var n = new Date();
  return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
}
function daysDiff(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function addDays(s, d) { var dt = new Date(s); dt.setDate(dt.getDate() + d); return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"); }
function dateLabel(s) { try { var d = new Date(s); var W = ["日","月","火","水","木","金","土"]; return (d.getMonth()+1)+"/"+d.getDate()+"("+W[d.getDay()]+")"; } catch(e) { return s; } }
function clone(d) { return JSON.parse(JSON.stringify(d)); }
function mkData() { return { items: [], meals: [] }; }

export default function App() {
  var [data, setData] = useState(mkData);
  var [ready, setReady] = useState(false);
  var [tab, setTab] = useState("home");
  var TD = getToday();
  useEffect(function () {
    (async function () {
      try {
        var { data: row } = await supabase.from("app_data").select("data").eq("id", "food_app").single();
        if (row && row.data && row.data.items) setData(row.data);
      } catch (e) { console.error(e); }
      setReady(true);
    })();
  }, []);
  var save = useCallback(async function (d) {
    setData(d);
    await supabase.from("app_data").upsert({ id: "food_app", data: d, updated_at: new Date().toISOString() });
  }, []);
  var activeItems = (data.items || []).filter(function (it) { return !it.used; });
  var wastedItems = (data.items || []).filter(function (it) { return it.wasted; });
  var usedItems = (data.items || []).filter(function (it) { return it.used && !it.wasted; });
  activeItems.sort(function (a, b) { return daysDiff(TD, a.expiry) - daysDiff(TD, b.expiry); });
  var byCategory = {};
  activeItems.forEach(function (it) { var c = it.category || "その他"; if (!byCategory[c]) byCategory[c] = []; byCategory[c].push(it); });
  var expired = activeItems.filter(function (it) { return daysDiff(TD, it.expiry) < 0; }).length;
  var urgent = activeItems.filter(function (it) { var r = daysDiff(TD, it.expiry); return r >= 0 && r <= 1; }).length;
  var ok = activeItems.filter(function (it) { return daysDiff(TD, it.expiry) > 1; }).length;
  if (!ready) return (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#FAFAF7" }}><div style={{ fontSize: 50 }}>🥬</div><div style={{ fontSize: 17, fontWeight: 800, marginTop: 12 }}>食材管理</div><div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>読み込み中...</div></div>);
  return (
    <div style={S.app}><style>{cssText}</style>
      <header style={S.header}><div style={{ fontSize: 16, fontWeight: 800 }}>🥬 食材管理</div><div style={{ fontSize: 11, opacity: .8, marginTop: 2 }}>{dateLabel(TD)}</div></header>
      <main style={{ padding: "6px 12px", paddingBottom: 70 }}>
        {tab === "home" && <HomeTab activeItems={activeItems} wastedItems={wastedItems} expired={expired} urgent={urgent} ok={ok} TD={TD} data={data} save={save} />}
        {tab === "category" && <CategoryTab byCategory={byCategory} TD={TD} data={data} save={save} />}
        {tab === "import" && <ImportTab data={data} save={save} TD={TD} />}
        {tab === "meals" && <MealsTab data={data} save={save} activeItems={activeItems} TD={TD} />}
        {tab === "settings" && <SettingsTab data={data} save={save} usedItems={usedItems} wastedItems={wastedItems} />}
      </main>
      <nav style={S.nav}>
        {[{id:"home",icon:"🏠",l:"ホーム"},{id:"import",icon:"📥",l:"追加"},{id:"meals",icon:"🍽️",l:"献立"},{id:"category",icon:"📂",l:"食材"},{id:"settings",icon:"⚙️",l:"設定"}].map(function(t){
          return <button key={t.id} onClick={function(){setTab(t.id)}} style={{...S.navBtn,color:tab===t.id?"#43A047":"#aaa"}}><span style={{fontSize:20}}>{t.icon}</span><span style={{fontSize:9,fontWeight:tab===t.id?700:400,marginTop:1}}>{t.l}</span></button>;
        })}
      </nav>
    </div>
  );
}

function FoodItem(p) {
  var item = p.item, TD = p.TD, data = p.data, save = p.save;
  var [showUse, setShowUse] = useState(false);
  var [showMenu, setShowMenu] = useState(false);
  var [editExpiry, setEditExpiry] = useState(item.expiry);
  var remain = daysDiff(TD, item.expiry);
  var info = CAT_INFO[item.category] || CAT_INFO["その他"];
  var bgColor = remain < 0 ? "#FFEBEE" : remain <= 1 ? "#FFF3E0" : "#fff";
  var statusColor = remain < 0 ? "#E53935" : remain <= 1 ? "#FF9800" : remain <= 3 ? "#FFC107" : "#4CAF50";
  var statusText = remain < 0 ? "期限切れ" + Math.abs(remain) + "日" : remain === 0 ? "今日まで！" : remain === 1 ? "明日まで" : "あと" + remain + "日";
  var qtyLabel = item.quantity + item.unit;
  var useAmount = function (amount) {
    var d = clone(data); var t = d.items.find(function (i) { return i.id === item.id; }); if (!t) return;
    t.quantity = Math.max(0, t.quantity - amount);
    if (t.quantity <= 0) { t.used = true; t.usedDate = TD; }
    save(d); setShowUse(false);
  };
  var markWasted = function () {
    if (!window.confirm("「" + item.name + "」を廃棄しますか？\n（フードロスとしてカウントされます）")) return;
    var d = clone(data); var t = d.items.find(function (i) { return i.id === item.id; });
    if (t) { t.used = true; t.wasted = true; t.usedDate = TD; }
    save(d);
  };
  var deleteItem = function () {
    if (!window.confirm("「" + item.name + "」を削除しますか？\n（誤登録などの取消用。フードロスにはカウントされません）")) return;
    var d = clone(data);
    d.items = (d.items || []).filter(function (i) { return i.id !== item.id; });
    save(d);
    setShowMenu(false);
  };
  var updateExpiry = function () {
    if (!editExpiry) return;
    var d = clone(data);
    var t = d.items.find(function (i) { return i.id === item.id; });
    if (t) { t.expiry = editExpiry; }
    save(d);
    setShowMenu(false);
  };
  var toggleMenu = function () {
    var next = !showMenu;
    setShowMenu(next);
    if (next) { setEditExpiry(item.expiry); setShowUse(false); }
  };
  var toggleUse = function () {
    var next = !showUse;
    setShowUse(next);
    if (next) setShowMenu(false);
  };
  var useOptions = [];
  if (item.unit === "g" || item.unit === "kg" || item.unit === "ml" || item.unit === "L") {
    var q = item.quantity;
    useOptions.push({ label: "1/4使う", amount: Math.round(q * 0.25) });
    useOptions.push({ label: "半分使う", amount: Math.round(q * 0.5) });
    useOptions.push({ label: "3/4使う", amount: Math.round(q * 0.75) });
    useOptions.push({ label: "全部使い切り", amount: q, green: true });
  } else {
    if (item.quantity > 1) { useOptions.push({ label: "1" + item.unit + "使う", amount: 1 }); if (item.quantity > 2) useOptions.push({ label: "2" + item.unit + "使う", amount: 2 }); if (item.quantity > 3) useOptions.push({ label: Math.floor(item.quantity / 2) + item.unit + "使う", amount: Math.floor(item.quantity / 2) }); }
    useOptions.push({ label: "全部使い切り", amount: item.quantity, green: true });
  }
  return (
    <div style={{ borderBottom: "1px solid #f3f3f3", background: bgColor, borderRadius: 6, marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 4px" }}>
        <div style={{ fontSize: 18 }}>{info.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}<span style={{ marginLeft: 6, fontSize: 10, color: "#666", fontWeight: 400 }}>{qtyLabel}</span></div><div style={{ fontSize: 10, color: "#aaa" }}>{item.category} ・ 購入{dateLabel(item.purchaseDate)}</div></div>
        <div style={{ textAlign: "right", marginRight: 2 }}><div style={{ fontSize: 11, fontWeight: 800, color: statusColor }}>{statusText}</div><div style={{ fontSize: 9, color: "#bbb" }}>〜{dateLabel(item.expiry)}</div></div>
        <button onClick={toggleUse} style={{padding:"4px 8px",borderRadius:6,border:"none",background:"#43A047",color:"#fff",fontWeight:700,fontSize:10,cursor:"pointer"}}>使う</button>
        <button onClick={markWasted} title="廃棄（フードロスにカウント）" style={{padding:"4px 6px",borderRadius:6,border:"none",background:"#E53935",color:"#fff",fontWeight:700,fontSize:10,cursor:"pointer",lineHeight:1.2}}>🗑<div style={{fontSize:8,fontWeight:700,marginTop:1}}>廃棄</div></button>
        <button onClick={toggleMenu} title="編集・削除" style={{padding:"4px 8px",borderRadius:6,border:"1px solid #cfd8dc",background:showMenu?"#ECEFF1":"#fff",color:"#546E7A",fontWeight:700,fontSize:14,cursor:"pointer",lineHeight:1}}>⋯</button>
      </div>
      {showUse && (<div style={{ display: "flex", gap: 4, padding: "4px 8px 8px", flexWrap: "wrap" }}>{useOptions.map(function (opt) { return <button key={opt.label} onClick={function(){useAmount(opt.amount)}} style={{...S.useBtn, background: opt.green ? "#4CAF50" : "#fff", color: opt.green ? "#fff" : "#333"}}>{opt.label}</button>; })}</div>)}
      {showMenu && (
        <div style={{ padding: "8px 10px 10px", borderTop: "1px dashed #e0e0e0", background: "#FAFAFA", borderRadius: "0 0 6px 6px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#666", marginBottom: 4 }}>📅 賞味期限を変更</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            <input type="date" value={editExpiry} onChange={function(e){setEditExpiry(e.target.value)}} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "1.5px solid #e0e0e0", fontSize: 12, background: "#fff", fontFamily: "inherit" }} />
            <button onClick={updateExpiry} disabled={!editExpiry || editExpiry === item.expiry} style={{ padding: "4px 14px", borderRadius: 6, border: "none", background: (!editExpiry || editExpiry === item.expiry) ? "#bdbdbd" : "#43A047", color: "#fff", fontWeight: 700, fontSize: 11, cursor: (!editExpiry || editExpiry === item.expiry) ? "default" : "pointer" }}>更新</button>
          </div>
          <button onClick={deleteItem} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E53935", background: "#fff", color: "#E53935", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>❌ 削除（誤登録のとき・廃棄カウントなし）</button>
        </div>
      )}
    </div>
  );
}

function HomeTab(p) {
  var { activeItems, wastedItems, expired, urgent, ok, TD, data, save } = p;
  return (<div style={{ animation: "fadeIn .3s ease" }}>
    <div style={{ ...S.card, background: "linear-gradient(135deg, #E8F5E9, #fff)" }}><div style={{ display: "flex", gap: 14, justifyContent: "center" }}><MStat l="食材数" v={activeItems.length} c="#43A047" /><MStat l="期限切れ" v={expired} c="#E53935" /><MStat l="今日明日" v={urgent} c="#FF9800" /><MStat l="余裕あり" v={ok} c="#4CAF50" /></div></div>
    {activeItems.length > 0 && (<div style={S.card}><div style={S.cardTitle}>⚡ 優先して使うもの</div>{activeItems.slice(0, 15).map(function (it) { return <FoodItem key={it.id} item={it} TD={TD} data={data} save={save} />; })}{activeItems.length > 15 && <div style={{ fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 6 }}>他{activeItems.length - 15}件</div>}</div>)}
    {activeItems.length === 0 && (<div style={{ textAlign: "center", padding: 30, color: "#bbb" }}><div style={{ fontSize: 40 }}>🛒</div><div style={{ marginTop: 8, fontWeight: 700 }}>食材がありません</div><div style={{ fontSize: 12, marginTop: 4 }}>「追加」タブから登録してください</div></div>)}
    {wastedItems.length > 0 && (<div style={{ ...S.card, background: "#FFF8F8" }}><div style={S.cardTitle}>🗑 フードロス記録</div><div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 10 }}><MStat l="今月" v={wastedItems.filter(function (w) { return w.usedDate && w.usedDate.startsWith(TD.substring(0, 7)); }).length + "個"} c="#E53935" /><MStat l="累計" v={wastedItems.length + "個"} c="#E53935" /></div></div>)}
  </div>);
}

function CategoryTab(p) {
  var { byCategory, TD, data, save } = p;
  return (<div style={{ animation: "fadeIn .3s ease" }}><h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>📂 カテゴリ別</h2>
    {Object.keys(byCategory).length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#bbb" }}>食材がありません</div>}
    {Object.keys(byCategory).map(function (cat) { var items = byCategory[cat]; var info = CAT_INFO[cat] || CAT_INFO["その他"]; return (<div key={cat} style={S.card}><div style={{ ...S.cardTitle, color: info.color }}>{info.emoji} {cat}（{items.length}）</div>{items.map(function (it) { return <FoodItem key={it.id} item={it} TD={TD} data={data} save={save} />; })}</div>); })}
  </div>);
}

function ImportTab(p) {
  var { data, save, TD } = p;
  var [mode, setMode] = useState("quick");
  var [preview, setPreview] = useState(null);
  var [importing, setImporting] = useState(false);
  var [manualName, setManualName] = useState("");
  var [manualCat, setManualCat] = useState("野菜・果物");
  var [manualUnit, setManualUnit] = useState("個");
  var [manualQty, setManualQty] = useState("1");
  var [manualExpiry, setManualExpiry] = useState("");
  var [photoLoading, setPhotoLoading] = useState(false);
  var [photoResults, setPhotoResults] = useState(null);
  var [added, setAdded] = useState(null);
  var cats = Object.keys(CAT_INFO).filter(function (c) { return c !== "その他"; });
  var addItem = function (item) { var d = clone(data); if (!d.items) d.items = []; d.items.push(item); save(d); };
  var quickAdd = function (q) { var exp = addDays(TD, EXPIRY_HINTS[q.cat] || 7); addItem({ id: "f" + Date.now(), name: q.name, category: q.cat, unit: q.unit || "個", quantity: q.qty || 1, purchaseDate: TD, expiry: exp, used: false }); setAdded(q.name); setTimeout(function () { setAdded(null); }, 1200); };
  var addManual = function () { if (!manualName.trim()) return; var exp = manualExpiry || addDays(TD, EXPIRY_HINTS[manualCat] || 7); addItem({ id: "f" + Date.now(), name: manualName.trim(), category: manualCat, unit: manualUnit, quantity: parseFloat(manualQty) || 1, purchaseDate: TD, expiry: exp, used: false }); setAdded(manualName.trim()); setManualName(""); setManualQty("1"); setManualExpiry(""); setTimeout(function () { setAdded(null); }, 1200); };
  var handlePhoto = function (e) { var file = e.target.files[0]; if (!file) return; setPhotoLoading(true); setPhotoResults(null); var reader = new FileReader(); reader.onload = async function (ev) { var base64 = ev.target.result.split(",")[1]; try { var res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } }, { type: "text", text: "この画像の食材を特定。調味料は除外。JSON形式のみ：\n[{\"name\":\"名前\",\"category\":\"カテゴリ\",\"unit\":\"単位\",\"quantity\":数量}]\ncategory：肉・魚/野菜・果物/卵・乳製品/主食/惣菜&弁当/加工品/飲料/保存食/嗜好品\nunit：個/本/g/パック/袋/束/玉/丁/房/枚" }] }] }) }); var rd = await res.json(); var text = rd.content.map(function (c) { return c.text || ""; }).join(""); var parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); setPhotoResults(parsed.map(function (it, idx) { return Object.assign({}, it, { id: "fp" + Date.now() + "_" + idx, expiry: addDays(TD, EXPIRY_HINTS[it.category] || 7), selected: true }); })); } catch (err) { setPhotoResults([]); } setPhotoLoading(false); }; reader.readAsDataURL(file); };
  var togglePhoto = function (idx) { var r = photoResults.slice(); r[idx] = Object.assign({}, r[idx], { selected: !r[idx].selected }); setPhotoResults(r); };
  var importPhoto = function () { var sel = photoResults.filter(function (r) { return r.selected; }); if (!sel.length) return; var d = clone(data); if (!d.items) d.items = []; sel.forEach(function (it) { d.items.push({ id: it.id, name: it.name, category: it.category, unit: it.unit || "個", quantity: it.quantity || 1, purchaseDate: TD, expiry: it.expiry, used: false }); }); save(d); setPhotoResults(null); setAdded(sel.length + "件追加"); setTimeout(function () { setAdded(null); }, 1500); };
  var handleCSV = function (e) { var file = e.target.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function (ev) { var lines = ev.target.result.split("\n"); var items = []; for (var i = 1; i < lines.length; i++) { var line = lines[i].trim(); if (!line) continue; var fields = []; var cur = ""; var inQ = false; for (var j = 0; j < line.length; j++) { var c = line[j]; if (c === '"') inQ = !inQ; else if (c === ',' && !inQ) { fields.push(cur); cur = ""; } else cur += c; } fields.push(cur); if (fields[2] === "食費" && fields[6] && fields[6].trim() && fields[3] !== "割引" && fields[3] !== "調味料") { var existing = (data.items || []).some(function (it) { return it.name === fields[6].trim() && it.purchaseDate === fields[0] && !it.used; }); if (!existing) items.push({ id: "fc" + Date.now() + "_" + i, name: fields[6].trim(), category: fields[3] || "その他", unit: "個", quantity: 1, purchaseDate: fields[0], expiry: addDays(fields[0], EXPIRY_HINTS[fields[3]] || 7), used: false }); } } setPreview(items); }; reader.readAsText(file, "Shift_JIS"); };
  var doImport = function () { if (!preview || !preview.length) return; var d = clone(data); if (!d.items) d.items = []; d.items = d.items.concat(preview); save(d); setPreview(null); setImporting(true); setTimeout(function () { setImporting(false); }, 2000); };
  var freq = {}; (data.items || []).forEach(function (it) { if (!freq[it.name]) freq[it.name] = { name: it.name, cat: it.category, unit: it.unit || "個", qty: it.quantity || 1, count: 0 }; freq[it.name].count++; }); QUICK_ITEMS.forEach(function (q) { if (!freq[q.name]) freq[q.name] = { name: q.name, cat: q.cat, unit: q.unit, qty: q.qty, count: 0 }; }); var sorted = Object.values(freq).sort(function (a, b) { return b.count !== a.count ? b.count - a.count : (a.name < b.name ? -1 : 1); }); var byCat = {}; sorted.forEach(function (it) { var c = it.cat || "その他"; if (!byCat[c]) byCat[c] = []; if (byCat[c].length < 8) byCat[c].push(it); });
  return (<div style={{ animation: "fadeIn .3s ease" }}>
    <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>📥 食材を追加</h2>
    {added && <div style={{ background: "#4CAF50", color: "#fff", borderRadius: 10, padding: "8px 14px", marginBottom: 8, fontSize: 13, fontWeight: 700, textAlign: "center" }}>✅ {added}</div>}
    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>{[{id:"quick",l:"🛒 タップ"},{id:"photo",l:"📷 写真"},{id:"csv",l:"📄 CSV"}].map(function(m){ return <button key={m.id} onClick={function(){setMode(m.id)}} style={{flex:1,padding:"8px 4px",borderRadius:10,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:mode===m.id?"#43A047":"#f0f0f0",color:mode===m.id?"#fff":"#666"}}>{m.l}</button>; })}</div>
    {mode === "quick" && (<div>
      <div style={S.card}><div style={S.cardTitle}>✏️ 食材名を入力</div><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}><input value={manualName} onChange={function(e){setManualName(e.target.value)}} placeholder="食材名" style={{...S.input, flex: 2, minWidth: 80}} /><select value={manualCat} onChange={function(e){setManualCat(e.target.value)}} style={{...S.input, flex: 1, minWidth: 70, fontSize: 11}}>{cats.map(function(c){return <option key={c} value={c}>{c}</option>})}</select></div><div style={{ display: "flex", gap: 4, marginTop: 6 }}><input type="number" value={manualQty} onChange={function(e){setManualQty(e.target.value)}} style={{...S.input, width: 50, flex: "none"}} /><select value={manualUnit} onChange={function(e){setManualUnit(e.target.value)}} style={{...S.input, width: 55, flex: "none"}}>{UNITS.map(function(u){return <option key={u} value={u}>{u}</option>})}</select><input type="date" value={manualExpiry} onChange={function(e){setManualExpiry(e.target.value)}} style={{...S.input, flex: 1, fontSize: 11}} placeholder="期限" /><button onClick={addManual} style={{...S.addBtn, background: "#43A047"}}>追加</button></div></div>
      <div style={S.card}><div style={S.cardTitle}>🛒 よく買うもの</div><div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>購入データから自動更新</div>
        {["肉・魚","卵・乳製品","野菜・果物","主食","加工品","惣菜&弁当","飲料","保存食","嗜好品"].map(function(cat){ var items = byCat[cat]; if (!items || !items.length) return null; var info = CAT_INFO[cat] || CAT_INFO["その他"]; return (<div key={cat} style={{ marginBottom: 10 }}><div style={{ fontSize: 11, fontWeight: 700, color: info.color, marginBottom: 4 }}>{info.emoji} {cat}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{items.map(function(q){ return <button key={q.name} onClick={function(){quickAdd(q)}} style={{padding:"6px 12px",borderRadius:10,border:"1px solid #e8e8e8",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",position:"relative"}}>{info.emoji} {q.name}{q.count > 0 && <span style={{position:"absolute",top:-4,right:-4,background:"#43A047",color:"#fff",borderRadius:8,padding:"0 4px",fontSize:8,fontWeight:800}}>{q.count}</span>}</button>; })}</div></div>); })}
      </div>
    </div>)}
    {mode === "photo" && (<div style={S.card}><div style={S.cardTitle}>📷 写真から食材を認識</div><div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>食材の写真またはレシートを撮影してください。</div><input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ fontSize: 12 }} />
      {photoLoading && <div style={{ textAlign: "center", padding: 20 }}><div style={{ fontSize: 28 }}>🔍</div><div style={{ fontSize: 13, fontWeight: 700, color: "#43A047", marginTop: 6 }}>AIが分析中...</div></div>}
      {photoResults && photoResults.length > 0 && (<div style={{ marginTop: 12 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#43A047", marginBottom: 6 }}>🛒 {photoResults.length}件認識</div>{photoResults.map(function(it,idx){ var info = CAT_INFO[it.category] || CAT_INFO["その他"]; return <div key={it.id} onClick={function(){togglePhoto(idx)}} style={{display:"flex",gap:8,alignItems:"center",fontSize:12,padding:"8px 6px",borderBottom:"1px solid #f0f0f0",cursor:"pointer",opacity:it.selected?1:.4,background:it.selected?"#F1F8E9":"#fff",borderRadius:6,marginBottom:2}}><span style={{fontSize:16}}>{it.selected?"☑️":"⬜"}</span><span>{info.emoji}</span><span style={{flex:1,fontWeight:600}}>{it.name}</span><span style={{color:"#666",fontSize:10}}>{it.quantity}{it.unit}</span><span style={{color:"#aaa",fontSize:10}}>{it.category}</span></div>; })}<button onClick={importPhoto} style={{...S.subBtn,background:"#43A047",marginTop:10}}>✓ 選択した食材を追加</button></div>)}
      {photoResults && photoResults.length === 0 && <div style={{ marginTop: 10, fontSize: 12, color: "#FF9800" }}>認識できませんでした。</div>}
    </div>)}
    {mode === "csv" && (<div style={S.card}><div style={S.cardTitle}>📄 ZaimのCSVから取り込み</div><input type="file" accept=".csv" onChange={handleCSV} style={{ fontSize: 12 }} />
      {preview && preview.length > 0 && (<div style={{ marginTop: 12 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#43A047", marginBottom: 6 }}>🛒 {preview.length}件</div><div style={{ maxHeight: 200, overflowY: "auto" }}>{preview.map(function(it){ var info = CAT_INFO[it.category] || CAT_INFO["その他"]; return <div key={it.id} style={{display:"flex",gap:6,alignItems:"center",fontSize:12,padding:"4px 0",borderBottom:"1px solid #f0f0f0"}}><span>{info.emoji}</span><span style={{flex:1,fontWeight:600}}>{it.name}</span><span style={{color:"#aaa",fontSize:10}}>{it.category}</span></div>; })}</div><button onClick={doImport} style={{...S.subBtn,background:"#43A047",marginTop:10}}>✓ 取り込む</button></div>)}
      {importing && <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: "#4CAF50", textAlign: "center" }}>✅ 取り込みました！</div>}
    </div>)}
  </div>);
}

function MealsTab(p) {
  var { data, save, activeItems, TD } = p;
  var meals = data.meals || [];
  var [showAdd, setShowAdd] = useState(false);
  var [name, setName] = useState("");
  var [mealType, setMealType] = useState("dinner");
  var [date, setDate] = useState(TD);
  var [selIngredients, setSelIngredients] = useState([]);
  var [photoFile, setPhotoFile] = useState(null);
  var [photoPreview, setPhotoPreview] = useState(null);
  var [saving, setSaving] = useState(false);
  var [viewMonth, setViewMonth] = useState(0);
  var handlePhoto = function (e) { var file = e.target.files[0]; if (!file) return; setPhotoFile(file); var reader = new FileReader(); reader.onload = function (ev) { setPhotoPreview(ev.target.result); }; reader.readAsDataURL(file); };
  var toggleIng = function (itemId) {
    var existing = selIngredients.find(function (s) { return s.itemId === itemId; });
    if (existing) { setSelIngredients(selIngredients.filter(function (s) { return s.itemId !== itemId; })); }
    else { var item = activeItems.find(function (i) { return i.id === itemId; }); if (item) { var defAmount = (item.unit === "g" || item.unit === "ml") ? Math.round(item.quantity / 2) : 1; setSelIngredients(selIngredients.concat([{ itemId: itemId, name: item.name, amount: defAmount, unit: item.unit }])); } }
  };
  var updateIngAmount = function (itemId, amount) { setSelIngredients(selIngredients.map(function (s) { return s.itemId === itemId ? Object.assign({}, s, { amount: parseFloat(amount) || 0 }) : s; })); };
  var handleSave = async function () {
    if (!name.trim()) return; setSaving(true); var photoUrl = null;
    if (photoFile) { var ext = photoFile.name.split(".").pop() || "jpg"; var fileName = "meal_" + Date.now() + "." + ext; try { await supabase.storage.from("meal-photos").upload(fileName, photoFile); var { data: urlData } = supabase.storage.from("meal-photos").getPublicUrl(fileName); photoUrl = urlData.publicUrl; } catch (e) { console.error(e); } }
    var d = clone(data); if (!d.meals) d.meals = [];
    d.meals.push({ id: "meal_" + Date.now(), date: date, mealType: mealType, name: name.trim(), photoUrl: photoUrl, ingredients: selIngredients });
    selIngredients.forEach(function (ing) { var item = d.items.find(function (i) { return i.id === ing.itemId; }); if (item) { item.quantity = Math.max(0, item.quantity - ing.amount); if (item.quantity <= 0) { item.used = true; item.usedDate = TD; } } });
    save(d); setName(""); setMealType("dinner"); setDate(TD); setSelIngredients([]); setPhotoFile(null); setPhotoPreview(null); setShowAdd(false); setSaving(false);
  };
  var deleteMeal = function (mealId) { var d = clone(data); d.meals = (d.meals || []).filter(function (m) { return m.id !== mealId; }); save(d); };
  var now = new Date(); var vd = new Date(now.getFullYear(), now.getMonth() + viewMonth, 1);
  var monthPrefix = vd.getFullYear() + "-" + String(vd.getMonth() + 1).padStart(2, "0");
  var monthMeals = meals.filter(function (m) { return m.date && m.date.startsWith(monthPrefix); });
  var byDate = {}; monthMeals.forEach(function (m) { if (!byDate[m.date]) byDate[m.date] = []; byDate[m.date].push(m); });
  var dates = Object.keys(byDate).sort().reverse();
  return (<div style={{ animation: "fadeIn .3s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><h2 style={{ fontSize: 17, fontWeight: 800 }}>🍽️ 献立記録</h2><button onClick={function () { setShowAdd(!showAdd); }} style={{ ...S.addBtn, background: "#43A047" }}>{showAdd ? "✕" : "＋ 記録"}</button></div>
    {showAdd && (<div style={{ ...S.card, border: "2px solid #43A04730" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}><input type="date" value={date} onChange={function(e){setDate(e.target.value)}} style={{...S.input,flex:1}} /><select value={mealType} onChange={function(e){setMealType(e.target.value)}} style={{...S.input,flex:1}}>{MEAL_TYPES.map(function(t){return <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>})}</select></div>
      <input value={name} onChange={function(e){setName(e.target.value)}} placeholder="料理名" style={{...S.input,width:"100%",marginBottom:8}} />
      <div style={{ marginBottom: 8 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4 }}>📷 写真（任意）</div><input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ fontSize: 11 }} />{photoPreview && <img src={photoPreview} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginTop: 6 }} />}</div>
      {activeItems.length > 0 && (<div style={{ marginBottom: 8 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4 }}>🥬 使った食材（タップ→使用量設定）</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>{activeItems.map(function (it) { var sel = selIngredients.find(function (s) { return s.itemId === it.id; }); var info = CAT_INFO[it.category] || CAT_INFO["その他"]; return <button key={it.id} onClick={function(){toggleIng(it.id)}} style={{padding:"4px 10px",borderRadius:8,border:sel?"2px solid #43A047":"1px solid #e8e8e8",background:sel?"#E8F5E9":"#fff",fontSize:11,fontWeight:sel?700:400,cursor:"pointer"}}>{info.emoji} {it.name}（{it.quantity}{it.unit}）</button>; })}</div>
        {selIngredients.length > 0 && (<div style={{ background: "#f9f9f9", borderRadius: 8, padding: 8 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 4 }}>使用量</div>{selIngredients.map(function (s) { return (<div key={s.itemId} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 12 }}><span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span><input type="number" value={s.amount} onChange={function(e){updateIngAmount(s.itemId, e.target.value)}} style={{ width: 50, padding: "3px 6px", borderRadius: 6, border: "1.5px solid #e0e0e0", fontSize: 12, textAlign: "center" }} /><span style={{ fontSize: 11, color: "#888" }}>{s.unit}</span></div>); })}</div>)}
      </div>)}
      <button onClick={handleSave} disabled={saving || !name.trim()} style={{...S.subBtn,background:saving?"#999":"#43A047"}}>{saving ? "保存中..." : "✓ 保存（在庫も自動更新）"}</button>
    </div>)}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10 }}><button onClick={function(){setViewMonth(viewMonth-1)}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer"}}>◀</button><div style={{ fontSize: 16, fontWeight: 800, minWidth: 120, textAlign: "center" }}>{vd.getFullYear()}年{vd.getMonth()+1}月</div><button onClick={function(){if(viewMonth<0)setViewMonth(viewMonth+1)}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",opacity:viewMonth<0?1:.3}}>▶</button></div>
    {dates.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#bbb" }}>この月の記録はありません</div>}
    {dates.map(function (d) { return (<div key={d} style={S.card}><div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>📅 {dateLabel(d)}</div>
      {byDate[d].sort(function (a, b) { var o = {breakfast:0,lunch:1,dinner:2,snack:3}; return (o[a.mealType]||9)-(o[b.mealType]||9); }).map(function (m) { var mt = MEAL_TYPES.find(function(t){return t.id===m.mealType}) || {emoji:"🍽️",label:m.mealType}; return (<div key={m.id} style={{ marginBottom: 10, padding: "8px 0", borderBottom: "1px solid #f3f3f3" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 20 }}>{mt.emoji}</span><div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "#aaa" }}>{mt.label}</div><div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div></div><button onClick={function(){deleteMeal(m.id)}} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:"#ccc"}}>🗑</button></div>{m.photoUrl && <img src={m.photoUrl} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginTop: 6 }} />}{m.ingredients && m.ingredients.length > 0 && (<div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>{m.ingredients.map(function (ing, idx) { return <span key={idx} style={{ padding: "2px 8px", borderRadius: 6, background: "#F1F8E9", fontSize: 10, color: "#43A047", fontWeight: 600 }}>{ing.name} {ing.amount}{ing.unit}</span>; })}</div>)}</div>); })}
    </div>); })}
  </div>);
}

function SettingsTab(p) {
  var { data, save, usedItems, wastedItems } = p;
  var wasteByCat = {}; wastedItems.forEach(function (w) { var c = w.category || "その他"; if (!wasteByCat[c]) wasteByCat[c] = 0; wasteByCat[c]++; });
  return (<div style={{ animation: "fadeIn .3s ease" }}><h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>⚙️ 設定</h2>
    {wastedItems.length > 0 && (<div style={{ ...S.card, background: "#FFF8F8" }}><div style={S.cardTitle}>📊 フードロスレポート</div><div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 12 }}><MStat l="廃棄" v={wastedItems.length + "個"} c="#E53935" /><MStat l="使い切り" v={usedItems.length + "個"} c="#4CAF50" /><MStat l="使い切り率" v={(usedItems.length + wastedItems.length) > 0 ? Math.round((usedItems.length / (usedItems.length + wastedItems.length)) * 100) + "%" : "-"} c="#2196F3" /></div>
      {Object.keys(wasteByCat).sort(function(a,b){return wasteByCat[b]-wasteByCat[a]}).map(function(cat){ var info = CAT_INFO[cat] || CAT_INFO["その他"]; return <div key={cat} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:"1px solid #f8f0f0"}}><span>{info.emoji}</span><span style={{flex:1,fontSize:12,fontWeight:600}}>{cat}</span><span style={{fontSize:12,fontWeight:700,color:"#E53935"}}>{wasteByCat[cat]}個</span></div>; })}
    </div>)}
    <div style={S.card}><div style={S.cardTitle}>🗑 データ管理</div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button onClick={function(){ var d = clone(data); d.items = (d.items||[]).filter(function(i){return !i.used}); save(d); }} style={{...S.subBtn,background:"#FF9800"}}>使用済み・廃棄データを削除</button>
      <button onClick={function(){ save(mkData()); }} style={{...S.subBtn,background:"#E53935"}}>すべてリセット</button>
    </div></div>
  </div>);
}

function MStat(p) { return <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:900,color:p.c}}>{p.v}</div><div style={{fontSize:9,color:"#999",marginTop:1}}>{p.l}</div></div>; }

var cssText = "@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Zen Maru Gothic',sans-serif}input,select,textarea,button{font-family:inherit}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}";

var S = {
  app: { fontFamily: "'Zen Maru Gothic',sans-serif", background: "#FAFAF7", minHeight: "100vh", maxWidth: 480, margin: "0 auto", paddingBottom: 80 },
  header: { padding: "16px 14px 14px", background: "linear-gradient(135deg, #2E7D32, #43A047)", color: "#fff", borderRadius: "0 0 20px 20px" },
  card: { background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,.04)" },
  cardTitle: { fontSize: 14, fontWeight: 800, color: "#333", marginBottom: 10 },
  addBtn: { padding: "5px 12px", borderRadius: 16, border: "none", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" },
  subBtn: { width: "100%", padding: 10, borderRadius: 10, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  input: { flex: 1, padding: "9px 10px", borderRadius: 9, border: "1.5px solid #e0e0e0", fontSize: 13, outline: "none", background: "#FAFAFA", fontFamily: "inherit" },
  useBtn: { padding: "6px 12px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#333" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, display: "flex", justifyContent: "space-around", background: "#fff", borderTop: "1px solid #eee", padding: "6px 0 env(safe-area-inset-bottom, 10px)", zIndex: 100 },
  navBtn: { display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "3px 8px" },
};
