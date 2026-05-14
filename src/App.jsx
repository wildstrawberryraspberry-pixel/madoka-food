import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

var EXPIRY_DEFAULTS = {
  "肉・魚": 3, "野菜・果物": 5, "卵・乳製品": 10, "主食": 5,
  "惣菜&弁当": 2, "加工品": 14, "調味料": 90, "飲料": 30,
  "保存食": 60, "嗜好品": 14,
};

var CAT_INFO = {
  "肉・魚": { emoji: "🥩", color: "#E53935" },
  "野菜・果物": { emoji: "🥬", color: "#43A047" },
  "卵・乳製品": { emoji: "🥚", color: "#FFB300" },
  "主食": { emoji: "🍚", color: "#8D6E63" },
  "惣菜&弁当": { emoji: "🍱", color: "#F4511E" },
  "加工品": { emoji: "🥫", color: "#6D4C41" },
  "調味料": { emoji: "🧂", color: "#78909C" },
  "飲料": { emoji: "🥤", color: "#039BE5" },
  "保存食": { emoji: "📦", color: "#5D4037" },
  "嗜好品": { emoji: "🍫", color: "#AB47BC" },
  "その他": { emoji: "🛒", color: "#90A4AE" },
};

var QUICK_ITEMS = [
  { name: "鶏むね肉", cat: "肉・魚" }, { name: "鶏もも肉", cat: "肉・魚" },
  { name: "豚こま切れ", cat: "肉・魚" }, { name: "合挽き肉", cat: "肉・魚" },
  { name: "鮭", cat: "肉・魚" }, { name: "卵", cat: "卵・乳製品" },
  { name: "牛乳", cat: "卵・乳製品" }, { name: "ヨーグルト", cat: "卵・乳製品" },
  { name: "豆腐", cat: "加工品" }, { name: "納豆", cat: "加工品" },
  { name: "にんじん", cat: "野菜・果物" }, { name: "玉ねぎ", cat: "野菜・果物" },
  { name: "じゃがいも", cat: "野菜・果物" }, { name: "キャベツ", cat: "野菜・果物" },
  { name: "もやし", cat: "野菜・果物" }, { name: "トマト", cat: "野菜・果物" },
  { name: "大根", cat: "野菜・果物" }, { name: "ほうれん草", cat: "野菜・果物" },
  { name: "バナナ", cat: "野菜・果物" }, { name: "パン", cat: "主食" },
  { name: "ごはん", cat: "主食" }, { name: "うどん", cat: "主食" },
];

function getToday() {
  var n = new Date();
  return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
}

function daysDiff(from, to) { return Math.round((new Date(to) - new Date(from)) / 86400000); }
function addDays(dateStr, days) {
  var d = new Date(dateStr); d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function dateLabel(s) {
  try { var d = new Date(s); var DJ = ["日","月","火","水","木","金","土"]; return (d.getMonth()+1)+"/"+d.getDate()+"("+DJ[d.getDay()]+")"; } catch(e) { return s; }
}

export default function App() {
  var [items, setItems] = useState([]);
  var [meals, setMeals] = useState([]);
  var [expirySettings, setExpirySettings] = useState(EXPIRY_DEFAULTS);
  var [ready, setReady] = useState(false);
  var [tab, setTab] = useState("home");
  var TD = getToday();

  // Load from Supabase
  useEffect(function () {
    (async function () {
      try {
        var { data: foodData } = await supabase.from("food_items").select("*");
        if (foodData) setItems(foodData);
        var { data: mealsData } = await supabase.from("meals").select("*").order("date", { ascending: false });
        if (mealsData) setMeals(mealsData);
        var { data: settingsData } = await supabase.from("food_settings").select("*").eq("id", "default").single();
        if (settingsData && settingsData.settings) setExpirySettings(Object.assign({}, EXPIRY_DEFAULTS, settingsData.settings));
      } catch (e) { console.error(e); }
      setReady(true);
    })();
  }, []);

  // Save settings to Supabase
  var saveSettings = useCallback(async function (s) {
    setExpirySettings(s);
    await supabase.from("food_settings").upsert({ id: "default", settings: s });
  }, []);

  // Add items to Supabase
  var addItems = useCallback(async function (newItems) {
    var { data } = await supabase.from("food_items").insert(newItems).select();
    if (data) setItems(function (prev) { return prev.concat(data); });
  }, []);

  // Update item
  var updateItem = useCallback(async function (id, changes) {
    await supabase.from("food_items").update(changes).eq("id", id);
    setItems(function (prev) { return prev.map(function (it) { return it.id === id ? Object.assign({}, it, changes) : it; }); });
  }, []);

  // Delete item
  var deleteItem = useCallback(async function (id) {
    await supabase.from("food_items").delete().eq("id", id);
    setItems(function (prev) { return prev.filter(function (it) { return it.id !== id; }); });
  }, []);

  // Clear used items
  var clearUsed = useCallback(async function () {
    await supabase.from("food_items").delete().eq("used", true);
    setItems(function (prev) { return prev.filter(function (it) { return !it.used; }); });
  }, []);

  // Clear all
  var clearAll = useCallback(async function () {
    await supabase.from("food_items").delete().neq("id", "");
    await supabase.from("food_settings").delete().eq("id", "default");
    setItems([]);
    setExpirySettings(EXPIRY_DEFAULTS);
  }, []);

  // Meals CRUD
  var addMeal = useCallback(async function (meal) {
    var { data } = await supabase.from("meals").insert(meal).select();
    if (data) setMeals(function (prev) { return [data[0]].concat(prev); });
  }, []);

  var deleteMeal = useCallback(async function (id) {
    await supabase.from("meals").delete().eq("id", id);
    setMeals(function (prev) { return prev.filter(function (m) { return m.id !== id; }); });
  }, []);

  // Upload photo to Supabase Storage
  var uploadPhoto = useCallback(async function (file) {
    var ext = file.name.split(".").pop() || "jpg";
    var fileName = "meal_" + Date.now() + "." + ext;
    var { data, error } = await supabase.storage.from("meal-photos").upload(fileName, file);
    if (error) { console.error(error); return null; }
    var { data: urlData } = supabase.storage.from("meal-photos").getPublicUrl(fileName);
    return urlData.publicUrl;
  }, []);

  var activeItems = items.filter(function (it) { return !it.used; });
  var usedItems = items.filter(function (it) { return it.used && !it.wasted; });
  var wastedItems = items.filter(function (it) { return it.wasted; });
  activeItems.sort(function (a, b) { return daysDiff(TD, a.expiry) - daysDiff(TD, b.expiry); });

  var byCategory = {};
  activeItems.forEach(function (it) {
    var cat = it.category || "その他";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(it);
  });

  var expired = activeItems.filter(function (it) { return daysDiff(TD, it.expiry) < 0; }).length;
  var urgent = activeItems.filter(function (it) { var r = daysDiff(TD, it.expiry); return r >= 0 && r <= 1; }).length;
  var ok = activeItems.filter(function (it) { return daysDiff(TD, it.expiry) > 1; }).length;

  if (!ready) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"#FAFAF7" }}>
        <div style={{ fontSize: 50 }}>🥬</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginTop: 12 }}>食材管理</div>
        <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{cssText}</style>
      <header style={S.header}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>🥬 食材管理</div>
        <div style={{ fontSize: 11, opacity: .8, marginTop: 2 }}>{dateLabel(TD)}</div>
      </header>
      <main style={{ padding: "6px 12px", paddingBottom: 70 }}>
        {tab === "home" && <HomeTab items={items} activeItems={activeItems} wastedItems={wastedItems} expired={expired} urgent={urgent} ok={ok} TD={TD} updateItem={updateItem} deleteItem={deleteItem} />}
        {tab === "category" && <CategoryTab byCategory={byCategory} TD={TD} updateItem={updateItem} deleteItem={deleteItem} />}
        {tab === "import" && <ImportTab items={items} addItems={addItems} expirySettings={expirySettings} TD={TD} />}
        {tab === "meals" && <MealsTab meals={meals} activeItems={activeItems} addMeal={addMeal} deleteMeal={deleteMeal} uploadPhoto={uploadPhoto} TD={TD} />}
        {tab === "settings" && <SettingsTab expirySettings={expirySettings} saveSettings={saveSettings} usedItems={usedItems} wastedItems={wastedItems} clearUsed={clearUsed} clearAll={clearAll} />}
      </main>
      <nav style={S.nav}>
        {[{id:"home",icon:"🏠",l:"ホーム"},{id:"import",icon:"📥",l:"追加"},{id:"meals",icon:"🍽️",l:"献立"},{id:"category",icon:"📂",l:"食材"},{id:"settings",icon:"⚙️",l:"設定"}].map(function(t){
          return <button key={t.id} onClick={function(){setTab(t.id)}} style={{...S.navBtn,color:tab===t.id?"#43A047":"#aaa"}}><span style={{fontSize:20}}>{t.icon}</span><span style={{fontSize:9,fontWeight:tab===t.id?700:400,marginTop:1}}>{t.l}</span></button>;
        })}
      </nav>
    </div>
  );
}

// ═══ HOME TAB ═══
function HomeTab(p) {
  var { activeItems, wastedItems, expired, urgent, ok, TD, updateItem, deleteItem } = p;
  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ ...S.card, background: "linear-gradient(135deg, #E8F5E9, #fff)" }}>
        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          <MStat l="食材数" v={activeItems.length} c="#43A047" />
          <MStat l="期限切れ" v={expired} c="#E53935" />
          <MStat l="今日明日" v={urgent} c="#FF9800" />
          <MStat l="余裕あり" v={ok} c="#4CAF50" />
        </div>
      </div>
      {activeItems.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>⚡ 優先して使うもの</div>
          {activeItems.slice(0, 15).map(function (it) {
            return <FoodItem key={it.id} item={it} TD={TD} updateItem={updateItem} deleteItem={deleteItem} />;
          })}
          {activeItems.length > 15 && <div style={{ fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 6 }}>他{activeItems.length - 15}件</div>}
        </div>
      )}
      {activeItems.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, color: "#bbb" }}>
          <div style={{ fontSize: 40 }}>🛒</div>
          <div style={{ marginTop: 8, fontWeight: 700 }}>食材がありません</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>「取り込み」タブから追加してください</div>
        </div>
      )}
      {wastedItems.length > 0 && (
        <div style={{ ...S.card, background: "#FFF8F8" }}>
          <div style={S.cardTitle}>🗑 フードロス記録</div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 10 }}>
            <MStat l="今月の廃棄" v={wastedItems.filter(function (w) { var m = TD.substring(0, 7); return w.used_date && w.used_date.startsWith(m); }).length + "個"} c="#E53935" />
            <MStat l="累計廃棄" v={wastedItems.length + "個"} c="#E53935" />
          </div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>最近の廃棄</div>
          {wastedItems.slice().sort(function (a, b) { return (b.used_date||"") > (a.used_date||"") ? 1 : -1; }).slice(0, 5).map(function (w) {
            var info = CAT_INFO[w.category] || CAT_INFO["その他"];
            return (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 0", borderBottom: "1px solid #f8f0f0" }}>
                <span>{info.emoji}</span><span style={{ flex: 1, fontWeight: 600 }}>{w.name}</span>
                <span style={{ color: "#ccc", fontSize: 10 }}>{w.used_date ? dateLabel(w.used_date) : ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ CATEGORY TAB ═══
function CategoryTab(p) {
  var { byCategory, TD, updateItem, deleteItem } = p;
  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>📂 カテゴリ別</h2>
      {Object.keys(byCategory).length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#bbb" }}>食材がありません</div>}
      {Object.keys(byCategory).map(function (cat) {
        var items = byCategory[cat];
        var info = CAT_INFO[cat] || CAT_INFO["その他"];
        return (
          <div key={cat} style={S.card}>
            <div style={{ ...S.cardTitle, color: info.color }}>{info.emoji} {cat}（{items.length}）</div>
            {items.map(function (it) { return <FoodItem key={it.id} item={it} TD={TD} updateItem={updateItem} deleteItem={deleteItem} />; })}
          </div>
        );
      })}
    </div>
  );
}

// ═══ FOOD ITEM ═══
function FoodItem(p) {
  var { item, TD, updateItem, deleteItem } = p;
  var remain = daysDiff(TD, item.expiry);
  var info = CAT_INFO[item.category] || CAT_INFO["その他"];
  var bgColor = remain < 0 ? "#FFEBEE" : remain <= 1 ? "#FFF3E0" : "#fff";
  var statusColor = remain < 0 ? "#E53935" : remain <= 1 ? "#FF9800" : remain <= 3 ? "#FFC107" : "#4CAF50";
  var statusText = remain < 0 ? "期限切れ" + Math.abs(remain) + "日" : remain === 0 ? "今日まで！" : remain === 1 ? "明日まで" : "あと" + remain + "日";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: "1px solid #f3f3f3", background: bgColor, borderRadius: 6, marginBottom: 2 }}>
      <div style={{ fontSize: 18 }}>{info.emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
        <div style={{ fontSize: 10, color: "#aaa" }}>{item.category} ・ 購入{dateLabel(item.purchase_date)}</div>
      </div>
      <div style={{ textAlign: "right", marginRight: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: statusColor }}>{statusText}</div>
        <div style={{ fontSize: 9, color: "#bbb" }}>〜{dateLabel(item.expiry)}</div>
      </div>
      <button onClick={function(){updateItem(item.id,{used:true,used_date:TD})}} style={{ padding:"4px 8px",borderRadius:6,border:"none",background:"#4CAF50",color:"#fff",fontWeight:700,fontSize:10,cursor:"pointer" }}>✓</button>
      <button onClick={function(){updateItem(item.id,{used:true,wasted:true,used_date:TD})}} style={{ padding:"4px 8px",borderRadius:6,border:"none",background:"#E53935",color:"#fff",fontWeight:700,fontSize:10,cursor:"pointer" }}>🗑</button>
    </div>
  );
}

// ═══ IMPORT TAB ═══
function ImportTab(p) {
  var { items, addItems, expirySettings, TD } = p;
  var [mode, setMode] = useState("quick");
  var [preview, setPreview] = useState(null);
  var [importing, setImporting] = useState(false);
  var [manualName, setManualName] = useState("");
  var [manualCat, setManualCat] = useState("野菜・果物");
  var [photoLoading, setPhotoLoading] = useState(false);
  var [photoResults, setPhotoResults] = useState(null);
  var [added, setAdded] = useState(null);
  var cats = Object.keys(CAT_INFO).filter(function (c) { return c !== "その他"; });

  var quickAdd = function (item) {
    var expiryDays = expirySettings[item.cat] || EXPIRY_DEFAULTS[item.cat] || 7;
    addItems([{ id: "fq" + Date.now(), name: item.name, category: item.cat, purchase_date: TD, expiry: addDays(TD, expiryDays), used: false, wasted: false, source: "quick" }]);
    setAdded(item.name);
    setTimeout(function () { setAdded(null); }, 1200);
  };

  var addManual = function () {
    if (!manualName.trim()) return;
    var expiryDays = expirySettings[manualCat] || EXPIRY_DEFAULTS[manualCat] || 7;
    addItems([{ id: "fm" + Date.now(), name: manualName.trim(), category: manualCat, purchase_date: TD, expiry: addDays(TD, expiryDays), used: false, wasted: false, source: "manual" }]);
    setAdded(manualName.trim());
    setManualName("");
    setTimeout(function () { setAdded(null); }, 1200);
  };

  var handlePhoto = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    setPhotoLoading(true); setPhotoResults(null);
    var reader = new FileReader();
    reader.onload = async function (ev) {
      var base64 = ev.target.result.split(",")[1];
      var mediaType = file.type || "image/jpeg";
      try {
        var res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "この画像に写っている食材や食品をすべて特定してください。レシートの場合は品目名を読み取ってください。\n\n以下のJSON形式のみで回答してください。他のテキストは不要です：\n[{\"name\": \"食材名\", \"category\": \"カテゴリ\"}]\n\ncategoryは以下のいずれかにしてください：肉・魚、野菜・果物、卵・乳製品、主食、惣菜&弁当、加工品、調味料、飲料、保存食、嗜好品" }
          ]}] })
        });
        var resData = await res.json();
        var text = resData.content.map(function (c) { return c.text || ""; }).join("");
        var clean = text.replace(/```json|```/g, "").trim();
        var parsed = JSON.parse(clean);
        setPhotoResults(parsed.map(function (it, idx) {
          var expiryDays = expirySettings[it.category] || EXPIRY_DEFAULTS[it.category] || 7;
          return { id: "fp" + Date.now() + "_" + idx, name: it.name, category: it.category || "その他", purchase_date: TD, expiry: addDays(TD, expiryDays), used: false, wasted: false, source: "photo", selected: true };
        }));
      } catch (err) { setPhotoResults([]); }
      setPhotoLoading(false);
    };
    reader.readAsDataURL(file);
  };

  var togglePhotoItem = function (idx) { var r = photoResults.slice(); r[idx] = Object.assign({}, r[idx], { selected: !r[idx].selected }); setPhotoResults(r); };

  var importPhotoItems = function () {
    var selected = photoResults.filter(function (r) { return r.selected; });
    if (selected.length === 0) return;
    addItems(selected.map(function (it) { return { id: it.id, name: it.name, category: it.category, purchase_date: it.purchase_date, expiry: it.expiry, used: false, wasted: false, source: "photo" }; }));
    setPhotoResults(null);
    setAdded(selected.length + "件追加");
    setTimeout(function () { setAdded(null); }, 1500);
  };

  var handleCSV = function (e) {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var text = ev.target.result; var lines = text.split("\n"); var foodItems = [];
      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim(); if (!line) continue;
        var fields = []; var current = ""; var inQuote = false;
        for (var j = 0; j < line.length; j++) { var c = line[j]; if (c === '"') inQuote = !inQuote; else if (c === ',' && !inQuote) { fields.push(current); current = ""; } else current += c; }
        fields.push(current);
        var date = fields[0]; var category = fields[2]; var subCategory = fields[3]; var itemName = fields[6];
        if (category === "食費" && itemName && itemName.trim() && subCategory !== "割引") {
          var existing = items.some(function (it) { return it.name === itemName.trim() && it.purchase_date === date && !it.used; });
          if (!existing) {
            var expiryDays = expirySettings[subCategory] || EXPIRY_DEFAULTS[subCategory] || 7;
            foodItems.push({ id: "f" + Date.now() + "_" + i, name: itemName.trim(), category: subCategory || "その他", purchase_date: date, expiry: addDays(date, expiryDays), used: false, wasted: false, source: "zaim" });
          }
        }
      }
      setPreview(foodItems);
    };
    reader.readAsText(file, "Shift_JIS");
  };

  var doImport = function () {
    if (!preview || preview.length === 0) return;
    addItems(preview);
    setPreview(null); setImporting(true);
    setTimeout(function () { setImporting(false); }, 2000);
  };

  // Build dynamic quick items
  var freq = {};
  items.forEach(function (it) { if (!freq[it.name]) freq[it.name] = { name: it.name, cat: it.category, count: 0 }; freq[it.name].count++; });
  QUICK_ITEMS.forEach(function (q) { if (!freq[q.name]) freq[q.name] = { name: q.name, cat: q.cat, count: 0 }; });
  var sorted = Object.values(freq).sort(function (a, b) { return b.count !== a.count ? b.count - a.count : (a.name < b.name ? -1 : 1); });
  var byCat = {};
  sorted.forEach(function (item) { var cat = item.cat || "その他"; if (!byCat[cat]) byCat[cat] = []; if (byCat[cat].length < 8) byCat[cat].push(item); });

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>📥 食材を追加</h2>
      {added && <div style={{ background: "#4CAF50", color: "#fff", borderRadius: 10, padding: "8px 14px", marginBottom: 8, fontSize: 13, fontWeight: 700, textAlign: "center" }}>✅ {added}を追加しました</div>}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {[{id:"quick",label:"🛒 タップで追加"},{id:"photo",label:"📷 写真で追加"},{id:"csv",label:"📄 CSV"}].map(function(m){
          return <button key={m.id} onClick={function(){setMode(m.id)}} style={{flex:1,padding:"8px 4px",borderRadius:10,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:mode===m.id?"#43A047":"#f0f0f0",color:mode===m.id?"#fff":"#666"}}>{m.label}</button>;
        })}
      </div>

      {mode === "quick" && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>✏️ 食材名を入力</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={manualName} onChange={function(e){setManualName(e.target.value)}} placeholder="食材名" style={S.input} />
              <select value={manualCat} onChange={function(e){setManualCat(e.target.value)}} style={{...S.input,width:90,flex:"none",fontSize:11}}>{cats.map(function(c){return <option key={c} value={c}>{c}</option>})}</select>
              <button onClick={addManual} style={{...S.addBtn,background:"#43A047",whiteSpace:"nowrap"}}>追加</button>
            </div>
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>🛒 よく買うもの（タップで追加）</div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>購入データから自動更新されます</div>
            {["肉・魚","卵・乳製品","野菜・果物","主食","加工品","惣菜&弁当","調味料","飲料","保存食","嗜好品"].map(function(cat){
              var catItems = byCat[cat]; if (!catItems || catItems.length === 0) return null;
              var info = CAT_INFO[cat] || CAT_INFO["その他"];
              return (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: info.color, marginBottom: 4 }}>{info.emoji} {cat}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {catItems.map(function(q){
                      return <button key={q.name} onClick={function(){quickAdd({name:q.name,cat:q.cat})}} style={{padding:"6px 12px",borderRadius:10,border:"1px solid #e8e8e8",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",position:"relative"}}>
                        {info.emoji} {q.name}
                        {q.count > 0 && <span style={{position:"absolute",top:-4,right:-4,background:"#43A047",color:"#fff",borderRadius:8,padding:"0 4px",fontSize:8,fontWeight:800}}>{q.count}</span>}
                      </button>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "photo" && (
        <div style={S.card}>
          <div style={S.cardTitle}>📷 写真から食材を認識</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>食材の写真またはレシートの写真を選択してください。</div>
          <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ fontSize: 12 }} />
          {photoLoading && <div style={{ textAlign: "center", padding: 20 }}><div style={{ fontSize: 28 }}>🔍</div><div style={{ fontSize: 13, fontWeight: 700, color: "#43A047", marginTop: 6 }}>AIが分析中...</div></div>}
          {photoResults && photoResults.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#43A047", marginBottom: 6 }}>🛒 {photoResults.length}件認識</div>
              {photoResults.map(function(it,idx){
                var info = CAT_INFO[it.category] || CAT_INFO["その他"];
                return <div key={it.id} onClick={function(){togglePhotoItem(idx)}} style={{display:"flex",gap:8,alignItems:"center",fontSize:12,padding:"8px 6px",borderBottom:"1px solid #f0f0f0",cursor:"pointer",opacity:it.selected?1:.4,background:it.selected?"#F1F8E9":"#fff",borderRadius:6,marginBottom:2}}>
                  <span style={{fontSize:16}}>{it.selected?"☑️":"⬜"}</span><span>{info.emoji}</span><span style={{flex:1,fontWeight:600}}>{it.name}</span><span style={{color:"#aaa",fontSize:10}}>{it.category}</span>
                </div>;
              })}
              <button onClick={importPhotoItems} style={{...S.subBtn,background:"#43A047",marginTop:10}}>✓ 選択した食材を追加</button>
            </div>
          )}
          {photoResults && photoResults.length === 0 && <div style={{ marginTop: 10, fontSize: 12, color: "#FF9800" }}>認識できませんでした。別の角度で撮影してみてください。</div>}
        </div>
      )}

      {mode === "csv" && (
        <div style={S.card}>
          <div style={S.cardTitle}>📄 ZaimのCSVから取り込み</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>ZaimのWeb版からダウンロードしたCSVファイルを選択してください。</div>
          <input type="file" accept=".csv" onChange={handleCSV} style={{ fontSize: 12 }} />
          {preview && preview.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#43A047", marginBottom: 6 }}>🛒 {preview.length}件の食材が見つかりました</div>
              <div style={{ maxHeight: 200, overflowY: "auto", background: "#f9f9f9", borderRadius: 8, padding: 8 }}>
                {preview.map(function(it){ var info = CAT_INFO[it.category] || CAT_INFO["その他"]; return <div key={it.id} style={{display:"flex",gap:6,alignItems:"center",fontSize:12,padding:"4px 0",borderBottom:"1px solid #f0f0f0"}}><span>{info.emoji}</span><span style={{flex:1,fontWeight:600}}>{it.name}</span><span style={{color:"#aaa",fontSize:10}}>{it.category}</span></div>; })}
              </div>
              <button onClick={doImport} style={{...S.subBtn,background:"#43A047",marginTop:10}}>✓ {preview.length}件を取り込む</button>
            </div>
          )}
          {preview && preview.length === 0 && <div style={{ marginTop: 10, fontSize: 12, color: "#FF9800" }}>新しい食材が見つかりませんでした</div>}
          {importing && <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: "#4CAF50", textAlign: "center" }}>✅ 取り込みました！</div>}
        </div>
      )}
    </div>
  );
}

// ═══ MEALS TAB ═══
var MEAL_TYPES = [
  { id: "breakfast", label: "朝ごはん", emoji: "🌅" },
  { id: "lunch", label: "昼ごはん", emoji: "☀️" },
  { id: "dinner", label: "夜ごはん", emoji: "🌙" },
  { id: "snack", label: "おやつ", emoji: "🍪" },
];

function MealsTab(p) {
  var { meals, activeItems, addMeal, deleteMeal, uploadPhoto, TD } = p;
  var [showAdd, setShowAdd] = useState(false);
  var [name, setName] = useState("");
  var [mealType, setMealType] = useState("dinner");
  var [date, setDate] = useState(TD);
  var [selIngredients, setSelIngredients] = useState([]);
  var [photoFile, setPhotoFile] = useState(null);
  var [photoPreview, setPhotoPreview] = useState(null);
  var [saving, setSaving] = useState(false);
  var [viewMonth, setViewMonth] = useState(0);

  var handlePhoto = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    var reader = new FileReader();
    reader.onload = function (ev) { setPhotoPreview(ev.target.result); };
    reader.readAsDataURL(file);
  };

  var toggleIngredient = function (itemName) {
    if (selIngredients.indexOf(itemName) >= 0) {
      setSelIngredients(selIngredients.filter(function (n) { return n !== itemName; }));
    } else {
      setSelIngredients(selIngredients.concat([itemName]));
    }
  };

  var handleSave = async function () {
    if (!name.trim()) return;
    setSaving(true);
    var photoUrl = null;
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile);
    }
    await addMeal({
      id: "meal_" + Date.now(),
      date: date,
      meal_type: mealType,
      name: name.trim(),
      photo_url: photoUrl,
      ingredients: selIngredients,
    });
    setName(""); setMealType("dinner"); setDate(TD); setSelIngredients([]);
    setPhotoFile(null); setPhotoPreview(null); setShowAdd(false); setSaving(false);
  };

  // Month navigation
  var now = new Date();
  var vd = new Date(now.getFullYear(), now.getMonth() + viewMonth, 1);
  var vYear = vd.getFullYear();
  var vMonth = vd.getMonth();
  var monthLabel = vYear + "年" + (vMonth + 1) + "月";
  var monthPrefix = vYear + "-" + String(vMonth + 1).padStart(2, "0");
  var monthMeals = meals.filter(function (m) { return m.date && m.date.startsWith(monthPrefix); });

  // Group by date
  var byDate = {};
  monthMeals.forEach(function (m) {
    if (!byDate[m.date]) byDate[m.date] = [];
    byDate[m.date].push(m);
  });
  var dates = Object.keys(byDate).sort().reverse();

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>🍽️ 献立記録</h2>
        <button onClick={function () { setShowAdd(!showAdd); }} style={{ ...S.addBtn, background: "#43A047" }}>{showAdd ? "✕" : "＋ 記録する"}</button>
      </div>

      {/* Add meal form */}
      {showAdd && (
        <div style={{ ...S.card, border: "2px solid #43A04730" }}>
          <div style={S.cardTitle}>📝 献立を記録</div>

          {/* Date & Type */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input type="date" value={date} onChange={function (e) { setDate(e.target.value); }} style={{ ...S.input, flex: 1 }} />
            <select value={mealType} onChange={function (e) { setMealType(e.target.value); }} style={{ ...S.input, flex: 1 }}>
              {MEAL_TYPES.map(function (t) { return <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>; })}
            </select>
          </div>

          {/* Name */}
          <input value={name} onChange={function (e) { setName(e.target.value); }} placeholder="料理名（例：カレーライス）" style={{ ...S.input, width: "100%", marginBottom: 8 }} />

          {/* Photo */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4 }}>📷 写真（任意）</div>
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ fontSize: 11 }} />
            {photoPreview && <img src={photoPreview} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginTop: 6 }} />}
          </div>

          {/* Ingredients from active items */}
          {activeItems.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4 }}>🥬 使った食材（タップで選択）</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {activeItems.map(function (it) {
                  var sel = selIngredients.indexOf(it.name) >= 0;
                  var info = CAT_INFO[it.category] || CAT_INFO["その他"];
                  return (
                    <button key={it.id} onClick={function () { toggleIngredient(it.name); }} style={{ padding: "4px 10px", borderRadius: 8, border: sel ? "2px solid #43A047" : "1px solid #e8e8e8", background: sel ? "#E8F5E9" : "#fff", fontSize: 11, fontWeight: sel ? 700 : 400, cursor: "pointer" }}>
                      {info.emoji} {it.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={saving || !name.trim()} style={{ ...S.subBtn, background: saving ? "#999" : "#43A047", marginTop: 4 }}>
            {saving ? "保存中..." : "✓ 保存"}
          </button>
        </div>
      )}

      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10 }}>
        <button onClick={function () { setViewMonth(viewMonth - 1); }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>◀</button>
        <div style={{ fontSize: 16, fontWeight: 800, minWidth: 120, textAlign: "center" }}>{monthLabel}</div>
        <button onClick={function () { if (viewMonth < 0) setViewMonth(viewMonth + 1); }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", opacity: viewMonth < 0 ? 1 : .3 }}>▶</button>
      </div>

      {/* Meals by date */}
      {dates.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#bbb" }}>この月の記録はありません</div>}
      {dates.map(function (d) {
        var dayMeals = byDate[d];
        return (
          <div key={d} style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#333", marginBottom: 8 }}>📅 {dateLabel(d)}</div>
            {dayMeals.sort(function (a, b) {
              var order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
              return (order[a.meal_type] || 9) - (order[b.meal_type] || 9);
            }).map(function (m) {
              var mt = MEAL_TYPES.find(function (t) { return t.id === m.meal_type; }) || { emoji: "🍽️", label: m.meal_type };
              return (
                <div key={m.id} style={{ marginBottom: 10, padding: "8px 0", borderBottom: "1px solid #f3f3f3" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{mt.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#aaa" }}>{mt.label}</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                    </div>
                    <button onClick={function () { deleteMeal(m.id); }} style={{ background: "none", border: "none", fontSize: 12, cursor: "pointer", color: "#ccc" }}>🗑</button>
                  </div>
                  {m.photo_url && <img src={m.photo_url} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginTop: 6 }} />}
                  {m.ingredients && m.ingredients.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {m.ingredients.map(function (ing, idx) {
                        return <span key={idx} style={{ padding: "2px 8px", borderRadius: 6, background: "#F1F8E9", fontSize: 10, color: "#43A047", fontWeight: 600 }}>{ing}</span>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ═══ SETTINGS TAB ═══
function SettingsTab(p) {
  var { expirySettings, saveSettings, usedItems, wastedItems, clearUsed, clearAll } = p;
  var settings = expirySettings || EXPIRY_DEFAULTS;

  var updateSetting = function (cat, days) {
    var s = Object.assign({}, settings);
    s[cat] = parseInt(days) || 7;
    saveSettings(s);
  };

  var wasteByCat = {};
  (wastedItems || []).forEach(function (w) { var cat = w.category || "その他"; if (!wasteByCat[cat]) wasteByCat[cat] = 0; wasteByCat[cat]++; });

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>⚙️ 設定</h2>
      {(wastedItems||[]).length > 0 && (
        <div style={{ ...S.card, background: "#FFF8F8" }}>
          <div style={S.cardTitle}>📊 フードロスレポート</div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 12 }}>
            <MStat l="累計廃棄" v={(wastedItems||[]).length + "個"} c="#E53935" />
            <MStat l="使い切り" v={(usedItems||[]).length + "個"} c="#4CAF50" />
            <MStat l="使い切り率" v={((usedItems||[]).length + (wastedItems||[]).length) > 0 ? Math.round(((usedItems||[]).length / ((usedItems||[]).length + (wastedItems||[]).length)) * 100) + "%" : "-"} c="#2196F3" />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#E53935", marginBottom: 6 }}>カテゴリ別の廃棄数</div>
          {Object.keys(wasteByCat).sort(function(a,b){return wasteByCat[b]-wasteByCat[a]}).map(function(cat){
            var info = CAT_INFO[cat] || CAT_INFO["その他"];
            return <div key={cat} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:"1px solid #f8f0f0"}}><span>{info.emoji}</span><span style={{flex:1,fontSize:12,fontWeight:600}}>{cat}</span><span style={{fontSize:12,fontWeight:700,color:"#E53935"}}>{wasteByCat[cat]}個</span></div>;
          })}
        </div>
      )}
      <div style={S.card}>
        <div style={S.cardTitle}>📅 カテゴリ別の賞味期限（日数）</div>
        {Object.keys(EXPIRY_DEFAULTS).map(function(cat){
          var info = CAT_INFO[cat] || CAT_INFO["その他"];
          var val = settings[cat] || EXPIRY_DEFAULTS[cat];
          return <div key={cat} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #f5f5f5"}}><span style={{fontSize:16}}>{info.emoji}</span><span style={{flex:1,fontSize:13,fontWeight:600}}>{cat}</span><input type="number" min="1" value={val} onChange={function(e){updateSetting(cat,e.target.value)}} style={{width:50,padding:"4px 6px",borderRadius:6,border:"1.5px solid #e0e0e0",fontSize:13,textAlign:"center"}} /><span style={{fontSize:11,color:"#aaa"}}>日</span></div>;
        })}
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>🗑 データ管理</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={clearUsed} style={{...S.subBtn,background:"#FF9800"}}>使用済み{(usedItems||[]).length + (wastedItems||[]).length}件を削除</button>
          <button onClick={clearAll} style={{...S.subBtn,background:"#E53935"}}>すべてリセット</button>
        </div>
      </div>
    </div>
  );
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
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, display: "flex", justifyContent: "space-around", background: "#fff", borderTop: "1px solid #eee", padding: "6px 0 env(safe-area-inset-bottom, 10px)", zIndex: 100 },
  navBtn: { display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "3px 8px" },
};
