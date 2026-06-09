import { useState, useEffect } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const BACKEND = (typeof process !== "undefined" && process.env?.REACT_APP_API_URL) || null;
const PREVIEW = !BACKEND;

const ls = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

// ── API helpers (production backend) ─────────────────────────────────────────
const getToken = () => localStorage.getItem("token");
async function apiCall(method, path, body) {
  const r = await fetch(BACKEND + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (r.status === 401) { localStorage.clear(); window.location.reload(); }
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}

// ── Claude caller ─────────────────────────────────────────────────────────────
// In production → calls your backend which holds the API key
// In preview → uses the artifact's built-in Claude API (window.claude)
async function callClaude(prompt) {
  if (!PREVIEW) {
    const d = await apiCall("POST", "/api/claude", { user: prompt });
    return d.text;
  }
  // Use artifact built-in API
  if (typeof window !== "undefined" && window.claude) {
    const result = await window.claude({ prompt });
    return result;
  }
  // Fallback: direct fetch without any auth headers (artifact proxy handles auth)
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
}

function pj(raw) {
  const c = raw.replace(/```json|```/g, "").trim();
  const s = c.search(/[\[{]/);
  const e = Math.max(c.lastIndexOf("]"), c.lastIndexOf("}"));
  if (s === -1 || e < s) throw new Error("No JSON found");
  return JSON.parse(c.slice(s, e + 1));
}

async function wait(set, i, v) {
  set(p => { const n = [...p]; n[i] = v; return n; });
  await new Promise(r => setTimeout(r, 350));
}

// ── Styles ────────────────────────────────────────────────────────────────────
const INP = { fontSize:13, padding:"8px 11px", width:"100%", outline:"none", border:"1px solid #ddd", borderRadius:8, fontFamily:"inherit", background:"#fff", color:"#111", boxSizing:"border-box" };
const CARD = { background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem 1.25rem", marginBottom:12, boxShadow:"0 1px 3px rgba(0,0,0,.05)" };
const COLS = [["#EEF0FF","#5147C7"],["#ECFDF5","#0a7c55"],["#FFF7ED","#c2410c"],["#EFF6FF","#1d4ed8"],["#FFF1F2","#be123c"],["#F0FDF4","#15803d"]];
const TONES = ["Analytical","Conversational","Witty","Provocative","Inspirational","Authoritative"];
const ac = i => COLS[i % COLS.length];
const al = n => (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

function Btn({ children, onClick, v="d", sm, disabled, full, style={} }) {
  const vs = {
    d: { bg:"#fff",     bo:"1px solid #ddd",       co:"#333" },
    p: { bg:"#5147C7",  bo:"none",                  co:"#fff" },
    g: { bg:"#0a7c55",  bo:"none",                  co:"#fff" },
    r: { bg:"#fef2f2",  bo:"1px solid #fca5a5",     co:"#b91c1c" },
    y: { bg:"#fefce8",  bo:"1px solid #fde047",     co:"#854d0e" },
  };
  const s = vs[v]||vs.d;
  return <button onClick={onClick} disabled={disabled} style={{ background:s.bg, border:s.bo, color:s.co, fontSize:sm?12:13, padding:sm?"4px 10px":"7px 16px", borderRadius:8, cursor:disabled?"not-allowed":"pointer", opacity:disabled?.5:1, display:"inline-flex", alignItems:"center", gap:5, fontFamily:"inherit", fontWeight:500, width:full?"100%":undefined, justifyContent:full?"center":undefined, ...style }}>{children}</button>;
}

const Card = ({ children, style={} }) => <div style={{ ...CARD, ...style }}>{children}</div>;

function Spin() {
  return <span style={{ width:13, height:13, borderRadius:"50%", border:"2px solid #ddd", borderTopColor:"#5147C7", animation:"_sp .7s linear infinite", display:"inline-block", flexShrink:0 }}/>;
}

function ABadge({ n }) {
  const cs = { 1:{bg:"#EEF0FF",c:"#5147C7"}, 2:{bg:"#ECFDF5",c:"#0a7c55"}, 3:{bg:"#FFF7ED",c:"#c2410c"}, 4:{bg:"#EFF6FF",c:"#1d4ed8"} };
  const t = cs[n];
  return <span style={{ fontSize:11, padding:"2px 9px", borderRadius:20, fontWeight:600, background:t.bg, color:t.c }}>Agent {n}</span>;
}

function SBadge({ s }) {
  const m = { pending:{bg:"#fef9c3",c:"#854d0e",l:"Pending"}, approved:{bg:"#dcfce7",c:"#166534",l:"Approved"}, posted:{bg:"#dbeafe",c:"#1e40af",l:"Posted"}, rejected:{bg:"#fee2e2",c:"#991b1b",l:"Rejected"} };
  const t = m[s]||m.pending;
  return <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, fontWeight:600, background:t.bg, color:t.c }}>{t.l}</span>;
}

function Steps({ steps, statuses, color="#5147C7" }) {
  return <div>{steps.map((s,i) => (
    <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"7px 0", borderBottom:i<steps.length-1?"1px solid #f5f5f5":"none" }}>
      <div style={{ width:20, height:20, borderRadius:"50%", background:color+"22", color, fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
        {statuses[i]==="✓"?"✓":statuses[i]==="✗"?"✗":i+1}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:500 }}>{s.n}</div>
        <div style={{ fontSize:11, color:"#888", marginTop:1 }}>{s.d}</div>
      </div>
      <div style={{ fontSize:11, color:statuses[i]==="✓"?"#0a7c55":statuses[i]==="✗"?"#b91c1c":"#aaa", marginTop:1 }}>
        {statuses[i]==="waiting"?"—":statuses[i]}
      </div>
    </div>
  ))}</div>;
}

function Pbar({ pct }) {
  return <div style={{ height:3, background:"#f0f0f0", borderRadius:2, overflow:"hidden", margin:"8px 0" }}><div style={{ height:"100%", background:"#5147C7", width:`${pct}%`, transition:"width .4s", borderRadius:2 }}/></div>;
}

function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#111", color:"#fff", borderRadius:20, padding:"8px 20px", fontSize:13, zIndex:9999, whiteSpace:"nowrap" }}>{msg}</div>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function Auth({ onLogin }) {
  const [mode,setMode] = useState("login");
  const [email,setEmail] = useState("");
  const [pw,setPw] = useState("");
  const [pw2,setPw2] = useState("");
  const [err,setErr] = useState("");
  const [busy,setBusy] = useState(false);

  async function go(e) {
    e.preventDefault(); setErr("");
    if (!email||!pw) { setErr("Email and password required"); return; }
    if (mode==="signup"&&pw!==pw2) { setErr("Passwords don't match"); return; }
    if (mode==="signup"&&pw.length<6) { setErr("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      if (PREVIEW) {
        const users = ls.get("_u")||{};
        if (mode==="signup") {
          if (users[email]) { setErr("Account already exists"); setBusy(false); return; }
          users[email] = { pw }; ls.set("_u", users);
        } else {
          if (!users[email]||users[email].pw!==pw) { setErr("Wrong email or password"); setBusy(false); return; }
        }
        localStorage.setItem("token","preview");
        localStorage.setItem("email",email);
        onLogin(email);
      } else {
        const r = await fetch(`${BACKEND}/${mode}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email,password:pw}) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        localStorage.setItem("token",d.token);
        localStorage.setItem("email",email);
        onLogin(email);
      }
    } catch(e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f8f9fb" }}>
      <style>{"@keyframes _sp{to{transform:rotate(360deg)}} *{box-sizing:border-box}"}</style>
      <div style={{ width:380 }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ width:52, height:52, borderRadius:14, background:"#5147C7", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px", boxShadow:"0 4px 20px #5147C740", fontSize:26 }}>⚡</div>
          <div style={{ fontSize:22, fontWeight:700, color:"#111" }}>Influencer Factory</div>
          <div style={{ fontSize:13, color:"#888", marginTop:5 }}>AI-powered content pipeline</div>
        </div>
        <div style={{ display:"flex", background:"#f0f0f0", borderRadius:10, padding:3, marginBottom:14 }}>
          {[["login","Sign in"],["signup","Create account"]].map(([k,l])=>(
            <button key={k} onClick={()=>{setMode(k);setErr("");}} style={{ flex:1, padding:"7px", border:"none", borderRadius:8, fontSize:13, fontFamily:"inherit", fontWeight:500, cursor:"pointer", background:mode===k?"#fff":"transparent", color:mode===k?"#111":"#888" }}>{l}</button>
          ))}
        </div>
        <Card>
          {err&&<div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"8px 12px", fontSize:13, color:"#b91c1c", marginBottom:12 }}>{err}</div>}
          <form onSubmit={go}>
            <div style={{ marginBottom:10 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Email</div><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@email.com" autoFocus style={INP}/></div>
            <div style={{ marginBottom:mode==="signup"?10:14 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Password</div><input value={pw} onChange={e=>setPw(e.target.value)} type="password" placeholder={mode==="signup"?"At least 6 characters":"••••••••"} style={INP}/></div>
            {mode==="signup"&&<div style={{ marginBottom:14 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Confirm password</div><input value={pw2} onChange={e=>setPw2(e.target.value)} type="password" placeholder="Repeat password" style={INP}/></div>}
            <Btn v="p" full onClick={go} disabled={busy}>{busy?<><Spin/>{mode==="signup"?" Creating...":" Signing in..."}</>:mode==="signup"?"Create account →":"Sign in →"}</Btn>
          </form>
        </Card>
        <div style={{ fontSize:12, color:"#888", textAlign:"center", marginTop:10 }}>
          {mode==="login"?"New here? ":"Have an account? "}
          <span onClick={()=>{setMode(mode==="login"?"signup":"login");setErr("");}} style={{ color:"#5147C7", cursor:"pointer", fontWeight:600 }}>{mode==="login"?"Create a free account":"Sign in"}</span>
        </div>
      </div>
    </div>
  );
}

// ── Persona Form ──────────────────────────────────────────────────────────────
function PersonaForm({ initial, onSave, onCancel }) {
  const [f,setF] = useState({ name:"", niche:"", tone:"Conversational", bio:"", xHandle:"", ...initial });
  const up = k => e => setF(p=>({...p,[k]:e.target.value}));
  return (
    <Card>
      <div style={{ fontSize:15,fontWeight:600,marginBottom:14 }}>{f.id?"Edit":"New"} persona</div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Name *</div><input value={f.name} onChange={up("name")} placeholder="Alex Chen" style={INP}/></div>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>X handle</div><input value={f.xHandle} onChange={up("xHandle")} placeholder="@alexchen" style={INP}/></div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Niche</div><input value={f.niche} onChange={up("niche")} placeholder="DeFi, Skincare, Fitness..." style={INP}/></div>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Tone</div><select value={f.tone} onChange={up("tone")} style={INP}>{TONES.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <div style={{ marginBottom:14 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Bio (optional)</div><textarea value={f.bio} onChange={up("bio")} placeholder="Two sentence backstory..." style={{ ...INP,resize:"none",minHeight:64 }}/></div>
      <div style={{ display:"flex",gap:8 }}>
        <Btn v="p" onClick={()=>{if(!f.name.trim()){alert("Name required");return;}onSave({...f,id:f.id||Date.now().toString()});}} disabled={!f.name.trim()}>Save persona</Btn>
        <Btn onClick={onCancel}>Cancel</Btn>
      </div>
    </Card>
  );
}

// ── Pipeline (Agent 1 + 2) ────────────────────────────────────────────────────
function Pipeline({ personas, addPosts }) {
  const [pid,setPid]   = useState(personas[0]?.id||"");
  const [topic,setTopic] = useState("");
  const [count,setCount] = useState(3);
  const [running,setRun] = useState(false);
  const [pct,setPct]   = useState(0);
  const [a1,setA1]     = useState(["waiting","waiting","waiting"]);
  const [a2,setA2]     = useState(["waiting","waiting","waiting"]);
  const [cards,setCards] = useState([]);
  const [done,setDone] = useState(false);
  const [err,setErr]   = useState("");
  const p = personas.find(x=>x.id===pid);

  if (!personas.length) return (
    <div style={{ textAlign:"center",padding:"3rem",color:"#888",fontSize:13 }}>
      No personas yet — go to <strong>Personas</strong> tab and create one first
    </div>
  );

  async function run() {
    if (!p||running) return;
    setRun(true); setDone(false); setErr(""); setPct(0); setCards([]);
    setA1(["waiting","waiting","waiting"]); setA2(["waiting","waiting","waiting"]);
    try {
      await wait(setA1,0,"running"); setPct(10);
      const r1 = await callClaude(
        `You are a content researcher. Return ONLY a raw JSON array, no markdown.
Research 5 topics for: Name=${p.name}, Niche=${p.niche}, Tone=${p.tone||"conversational"}${topic?`, Focus on: ${topic}`:""}.
Return: [{"topic":"","insight":"non-obvious insight","hook_angle":"scroll-stopping opener","confidence":"high"}]`
      );
      const resCards = pj(r1);
      setCards(resCards);
      await wait(setA1,0,"✓"); await wait(setA1,1,"running"); setPct(38);
      await wait(setA1,1,"✓"); await wait(setA1,2,"running"); setPct(52);
      await wait(setA1,2,"✓"); setPct(56);

      await wait(setA2,0,"running"); setPct(62);
      const r2 = await callClaude(
        `You are a ghostwriter. Return ONLY a raw JSON array, no markdown.
Write tweets for "${p.name}" (${p.xHandle||""}), tone: ${p.tone}, bio: "${p.bio||""}".
Topics: ${JSON.stringify(resCards.map(c=>({topic:c.topic,hook:c.hook_angle})))}
Rules: exactly ${count} tweet(s) per topic, under 280 chars, 1-2 hashtags, sound human not AI.
Return: [{"topic":"","tweets":[""]}]`
      );
      const packs = pj(r2);
      const posts = [];
      packs.forEach((pk,pi)=>(pk.tweets||[]).forEach((text,ti)=>posts.push({
        id:`${Date.now()}-${pi}-${ti}`, personaId:p.id, personaName:p.name,
        personaHandle:p.xHandle||"", topic:pk.topic, text,
        status:"pending",
        createdAt:new Date().toISOString()
      })));
      await wait(setA2,0,"✓"); await wait(setA2,1,"running"); setPct(84);
      await wait(setA2,1,"✓"); await wait(setA2,2,"running"); setPct(97);
      await wait(setA2,2,"✓"); setPct(100);
      setDone(true); addPosts(posts);
    } catch(e) {
      setErr(e.message);
      [setA1,setA2].forEach(set=>set(p=>{const n=[...p];const i=n.indexOf("running");if(i>=0)n[i]="✗";return n;}));
    }
    setRun(false);
  }

  return (<>
    <Card>
      <div style={{ fontSize:13,fontWeight:600,marginBottom:10 }}>Select persona</div>
      <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
        {personas.map((pe,i)=>{ const [bg,tc]=ac(i); return (
          <div key={pe.id} onClick={()=>setPid(pe.id)} style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:9,border:`1.5px solid ${pid===pe.id?"#5147C7":"#e5e5e5"}`,background:pid===pe.id?"#EEF0FF":"#fff",cursor:"pointer" }}>
            <div style={{ width:28,height:28,borderRadius:"50%",background:bg,color:tc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700 }}>{al(pe.name)}</div>
            <div><div style={{ fontSize:13,fontWeight:600 }}>{pe.name}</div><div style={{ fontSize:11,color:"#888" }}>{pe.niche}</div></div>
          </div>
        );})}
      </div>
    </Card>

    <Card>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}><ABadge n={1}/><span style={{ fontSize:14,fontWeight:600 }}>Research</span></div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Topic focus (optional)</div><input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Leave blank to auto-discover" style={INP}/></div>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Tweets per topic</div>
          <select value={count} onChange={e=>setCount(Number(e.target.value))} style={INP}>{[1,2,3,5].map(n=><option key={n} value={n}>{n} tweet{n>1?"s":""}</option>)}</select>
        </div>
      </div>
    </Card>

    <Card style={{ opacity:.75 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}><ABadge n={2}/><span style={{ fontSize:14,fontWeight:600 }}>Content generation</span></div>
      <div style={{ fontSize:12,color:"#888" }}>Writes in {p?.name||"persona"}'s exact voice. Posts land in review queue.</div>
    </Card>

    {err&&<div style={{ background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#b91c1c",marginBottom:12 }}>❌ {err}</div>}

    <Btn v="p" onClick={run} disabled={running||!pid}>
      {running?<><Spin/> Running pipeline...</>:"▶  Run pipeline ↗"}
    </Btn>

    {(running||pct>0)&&<Card style={{ marginTop:12 }}>
      <Pbar pct={pct}/>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:10 }}>
        <div>
          <div style={{ fontSize:10,color:"#888",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em" }}>Agent 1 · Research</div>
          <Steps steps={[{n:"Analysing niche",d:"Topics + insights"},{n:"Building cards",d:"Hooks + angles"},{n:"Mapping strategy",d:"Format + approach"}]} statuses={a1} color="#5147C7"/>
        </div>
        <div>
          <div style={{ fontSize:10,color:"#888",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em" }}>Agent 2 · Content</div>
          <Steps steps={[{n:"Loading voice",d:"Tone + style"},{n:"Writing tweets",d:`${count} per topic`},{n:"Quality check",d:"Char limit + tags"}]} statuses={a2} color="#0a7c55"/>
        </div>
      </div>
      {done&&<div style={{ marginTop:10,padding:"8px 12px",background:"#dcfce7",borderRadius:8,fontSize:13,color:"#166534" }}>✓ Posts added to your review queue</div>}
    </Card>}

    {cards.length>0&&<div style={{ marginTop:12 }}>
      <div style={{ fontSize:12,color:"#888",marginBottom:8 }}>Research cards ({cards.length})</div>
      {cards.map((c,i)=><Card key={i} style={{ borderLeft:"3px solid #5147C7",padding:".75rem 1rem",marginBottom:8 }}>
        <div style={{ fontSize:13,fontWeight:600,marginBottom:4 }}>{c.topic}</div>
        <div style={{ fontSize:12,color:"#666",marginBottom:3 }}>{c.insight}</div>
        <div style={{ fontSize:12,color:"#5147C7" }}>Hook: {c.hook_angle}</div>
      </Card>)}
    </div>}
  </>);
}

// ── Queue ─────────────────────────────────────────────────────────────────────
function Queue({ posts, setPosts }) {
  const [filter,setFilter] = useState("pending");
  const [editId,setEditId] = useState(null);
  const [editText,setEditText] = useState("");
  const upd = (id,ch) => setPosts(p=>p.map(x=>x.id===id?{...x,...ch}:x));
  const pending = posts.filter(p=>p.status==="pending");
  const shown = filter==="all"?posts:posts.filter(p=>p.status===filter);

  if (!posts.length) return (
    <div style={{ textAlign:"center",padding:"3rem",color:"#888",fontSize:13 }}>
      Queue is empty — run the pipeline to generate posts
    </div>
  );

  return (<>
    {pending.length>0&&<div style={{ background:"#fefce8",border:"1px solid #fde047",borderRadius:9,padding:"9px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8 }}>
      <span style={{ fontSize:13,color:"#854d0e",fontWeight:600 }}>⚠ {pending.length} post{pending.length>1?"s":""} waiting for review</span>
      <div style={{ display:"flex",gap:6 }}>
        <Btn v="g" sm onClick={()=>pending.forEach(p=>upd(p.id,{status:"approved"}))}>✓ Approve all</Btn>
        <Btn v="r" sm onClick={()=>pending.forEach(p=>upd(p.id,{status:"rejected"}))}>✕ Reject all</Btn>
      </div>
    </div>}
    <div style={{ display:"flex",gap:6,marginBottom:12,flexWrap:"wrap" }}>
      {["pending","approved","posted","rejected","all"].map(s=>(
        <button key={s} onClick={()=>setFilter(s)} style={{ fontSize:11,padding:"3px 11px",borderRadius:20,border:`1px solid ${filter===s?"#5147C7":"#e5e5e5"}`,background:filter===s?"#EEF0FF":"transparent",color:filter===s?"#5147C7":"#888",cursor:"pointer",fontFamily:"inherit" }}>
          {s==="all"?"All":s.charAt(0).toUpperCase()+s.slice(1)} ({s==="all"?posts.length:posts.filter(p=>p.status===s).length})
        </button>
      ))}
    </div>
    {shown.length===0&&<div style={{ fontSize:13,color:"#888",textAlign:"center",padding:"1.5rem 0" }}>No posts here</div>}
    {shown.map(post=>(
      <Card key={post.id} style={{ marginBottom:8 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap" }}>
          <div style={{ fontSize:13,fontWeight:600,flex:1 }}>{post.personaName}</div>
          {post.personaHandle&&<div style={{ fontSize:11,color:"#5147C7" }}>{post.personaHandle}</div>}
          <SBadge s={post.status}/>
        </div>
        {post.topic&&<div style={{ fontSize:11,color:"#888",marginBottom:6 }}>{post.topic}</div>}

        {editId===post.id?(
          <div style={{ marginBottom:9 }}>
            <textarea value={editText} onChange={e=>setEditText(e.target.value)} style={{ ...INP,resize:"vertical",minHeight:80,marginBottom:4 }}/>
            <div style={{ fontSize:11,color:editText.length>280?"#b91c1c":"#888",marginBottom:6 }}>{editText.length}/280</div>
            <div style={{ display:"flex",gap:6 }}>
              <Btn v="p" sm onClick={()=>{upd(post.id,{text:editText});setEditId(null);}}>Save</Btn>
              <Btn sm onClick={()=>setEditId(null)}>Cancel</Btn>
            </div>
          </div>
        ):(
          <div style={{ fontSize:13,lineHeight:1.75,marginBottom:10,color:"#111" }}>{post.text}</div>
        )}
        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
          {post.status==="pending"&&<>
            <Btn v="g" sm onClick={()=>upd(post.id,{status:"approved"})}>✓ Approve</Btn>
            <Btn v="r" sm onClick={()=>upd(post.id,{status:"rejected"})}>✕ Reject</Btn>
            <Btn sm onClick={()=>{setEditId(post.id);setEditText(post.text);}}>Edit</Btn>
          </>}
          {post.status==="approved"&&<Btn v="p" sm onClick={()=>{navigator.clipboard?.writeText(post.text);upd(post.id,{status:"posted"});}}>📋 Copy & mark posted</Btn>}
          <Btn sm onClick={()=>navigator.clipboard?.writeText(post.text)}>Copy</Btn>
          <Btn v="r" sm onClick={()=>setPosts(p=>p.filter(x=>x.id!==post.id))}>Delete</Btn>
        </div>
      </Card>
    ))}
  </>);
}

// ── Intelligence (Agent 3) ────────────────────────────────────────────────────
function Intelligence({ personas }) {
  const [pid,setPid]     = useState("");
  const [type,setType]   = useState("weekly");
  const [data,setData]   = useState("");
  const [comp,setComp]   = useState("");
  const [steps,setSteps] = useState(["waiting","waiting","waiting"]);
  const [result,setResult] = useState("");
  const [running,setRun] = useState(false);
  const [err,setErr]     = useState("");

  async function run() {
    setRun(true); setResult(""); setErr(""); setSteps(["waiting","waiting","waiting"]);
    const p = personas.find(x=>x.id===pid)||personas[0];
    const labels = { weekly:"Weekly learning report", competitor:"Competitor intelligence", hooks:"Hook performance analysis", monetisation:"Monetisation signals" };
    try {
      await wait(setSteps,0,"running"); await wait(setSteps,1,"running"); await wait(setSteps,0,"✓"); await wait(setSteps,2,"running");
      const r = await callClaude(
        `You are a content intelligence analyst. Be specific and actionable.
Produce a ${labels[type]} for "${p?.name||"this creator"}" (${p?.niche||"general"} niche).
${data?`Performance data:\n${data}`:"Use content best practices for this niche."}
${comp?`Competitors to analyse: ${comp}`:""}
Cover:
1. What is working — double down on these
2. What to stop
3. Three experiments for next week
4. Content opportunities being missed
5. Monetisation signals
6. One priority action this week`
      );
      await wait(setSteps,1,"✓"); await wait(setSteps,2,"✓");
      setResult(r);
    } catch(e) {
      setErr(e.message);
      setSteps(p=>{const n=[...p];const i=n.indexOf("running");if(i>=0)n[i]="✗";return n;});
    }
    setRun(false);
  }

  return (<>
    <Card>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}><ABadge n={3}/><span style={{ fontSize:14,fontWeight:600 }}>Recursive intelligence</span></div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Persona</div>
          <select value={pid} onChange={e=>setPid(e.target.value)} style={INP}><option value="">All personas</option>{personas.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Report type</div>
          <select value={type} onChange={e=>setType(e.target.value)} style={INP}>
            <option value="weekly">Weekly learning report</option>
            <option value="competitor">Competitor intelligence</option>
            <option value="hooks">Hook performance</option>
            <option value="monetisation">Monetisation signals</option>
          </select></div>
      </div>
      <div style={{ marginBottom:10 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Performance data (optional)</div>
        <textarea value={data} onChange={e=>setData(e.target.value)} placeholder="Paste top posts, saves, comments this week..." style={{ ...INP,resize:"none",minHeight:64 }}/></div>
      <div style={{ marginBottom:12 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Competitors to analyse (optional)</div>
        <input value={comp} onChange={e=>setComp(e.target.value)} placeholder="@handle, page name..." style={INP}/></div>
      {err&&<div style={{ background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#b91c1c",marginBottom:10 }}>❌ {err}</div>}
      <Btn v="y" onClick={run} disabled={running}>{running?<><Spin/> Analysing...</>:"Run intelligence agent ↗"}</Btn>
    </Card>
    {(running||result)&&<Card>
      <Steps steps={[{n:"Performance scan",d:"What worked"},{n:"Competitor scan",d:"Gaps + moves"},{n:"Generate report",d:"Actions + priorities"}]} statuses={steps} color="#c2410c"/>
      {result&&<div style={{ marginTop:12,fontSize:13,color:"#444",lineHeight:1.8,whiteSpace:"pre-wrap",borderTop:"1px solid #f0f0f0",paddingTop:12 }}>{result}</div>}
    </Card>}
  </>);
}

// ── Distribution (Agent 4) ────────────────────────────────────────────────────
function Distribution({ posts }) {
  const [postId,setPostId]     = useState("");
  const [channels,setChannels] = useState(["SEO article","Reddit post","X thread"]);
  const [intent,setIntent]     = useState("Authority");
  const [steps,setSteps]       = useState(["waiting","waiting","waiting"]);
  const [result,setResult]     = useState("");
  const [running,setRun]       = useState(false);
  const [err,setErr]           = useState("");
  const ALL = ["SEO article","Reddit post","Quora answer","X thread","LinkedIn","Citation page"];

  async function run() {
    const post = posts.find(p=>p.id===postId);
    if (!post) { alert("Select a post first"); return; }
    setRun(true); setResult(""); setErr(""); setSteps(["waiting","waiting","waiting"]);
    try {
      await wait(setSteps,0,"running"); await wait(setSteps,1,"running"); await wait(setSteps,0,"✓"); await wait(setSteps,2,"running");
      const r = await callClaude(
        `You are a content distribution expert. Write platform-ready content with a clear header for each channel.
Persona: ${post.personaName} (${post.personaHandle})
Topic: ${post.topic}
Original post: "${post.text}"
Channels: ${channels.join(", ")}
Intent: ${intent}
For each channel write optimised platform-specific content. Be specific and ready to publish.`
      );
      await wait(setSteps,1,"✓"); await wait(setSteps,2,"✓");
      setResult(r);
    } catch(e) {
      setErr(e.message);
      setSteps(p=>{const n=[...p];const i=n.indexOf("running");if(i>=0)n[i]="✗";return n;});
    }
    setRun(false);
  }

  return (<>
    <Card>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}><ABadge n={4}/><span style={{ fontSize:14,fontWeight:600 }}>Cross-platform distribution</span></div>
      <div style={{ marginBottom:10 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Select a post</div>
        <select value={postId} onChange={e=>setPostId(e.target.value)} style={INP}>
          <option value="">— pick a post —</option>
          {posts.filter(p=>p.status!=="rejected").map(p=><option key={p.id} value={p.id}>{p.personaName} · {(p.topic||p.text||"").slice(0,45)}</option>)}
        </select></div>
      <div style={{ marginBottom:10 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Channels</div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginTop:3 }}>
          {ALL.map(c=><span key={c} onClick={()=>setChannels(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c])} style={{ fontSize:12,padding:"3px 10px",borderRadius:20,cursor:"pointer",background:channels.includes(c)?"#EFF6FF":"#f5f5f5",border:`1px solid ${channels.includes(c)?"#1d4ed8":"#e5e5e5"}`,color:channels.includes(c)?"#1d4ed8":"#888" }}>{c}</span>)}
        </div></div>
      <div style={{ marginBottom:12 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Intent</div>
        <select value={intent} onChange={e=>setIntent(e.target.value)} style={INP}>
          {["Authority","Drive traffic","Community seeding","B2B leads"].map(o=><option key={o}>{o}</option>)}
        </select></div>
      {err&&<div style={{ background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#b91c1c",marginBottom:10 }}>❌ {err}</div>}
      <Btn v="p" onClick={run} disabled={running}>{running?<><Spin/> Distributing...</>:"Run distribution agent ↗"}</Btn>
    </Card>
    {(running||result)&&<Card>
      <Steps steps={[{n:"Adapt channels",d:channels.slice(0,2).join(", ")+"..."},{n:"SEO + citation",d:"Structure for search"},{n:"Community formats",d:"Reddit, Quora, X"}]} statuses={steps} color="#1d4ed8"/>
      {result&&<div style={{ marginTop:12,fontSize:13,color:"#444",lineHeight:1.8,whiteSpace:"pre-wrap",borderTop:"1px solid #f0f0f0",paddingTop:12 }}>{result}</div>}
    </Card>}
  </>);
}

// ── Personas Tab ──────────────────────────────────────────────────────────────
function PersonasTab({ personas, setPersonas, posts, setTab }) {
  const [form,setForm] = useState(false);
  const [edit,setEdit] = useState(null);
  function save(d) { setPersonas(prev=>d.id&&prev.find(p=>p.id===d.id)?prev.map(p=>p.id===d.id?d:p):[...prev,d]); setForm(false); setEdit(null); }
  if (form||edit) return <PersonaForm initial={edit} onSave={save} onCancel={()=>{setForm(false);setEdit(null);}}/>;
  return (<>
    <Btn v="p" onClick={()=>setForm(true)} style={{ marginBottom:14 }}>+ New persona</Btn>
    {!personas.length?<div style={{ textAlign:"center",padding:"3rem",color:"#888",fontSize:13 }}>No personas yet — create your first one above</div>:(
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10 }}>
        {personas.map((p,i)=>{
          const [bg,tc]=ac(i);
          const pend=posts.filter(x=>x.personaId===p.id&&x.status==="pending").length;
          return <Card key={p.id} style={{ marginBottom:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
              <div style={{ width:40,height:40,borderRadius:"50%",background:bg,color:tc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700 }}>{al(p.name)}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                <div style={{ fontSize:11,color:"#5147C7" }}>{p.xHandle||"No handle"}</div>
              </div>
              {pend>0&&<span style={{ fontSize:10,background:"#5147C7",color:"#fff",borderRadius:20,padding:"2px 8px",fontWeight:600 }}>{pend}</span>}
            </div>
            <div style={{ fontSize:12,color:"#666",marginBottom:6 }}>{p.niche} · {p.tone}</div>
            {p.bio&&<div style={{ fontSize:12,color:"#888",lineHeight:1.6,marginBottom:10 }}>{p.bio.length>80?p.bio.slice(0,80)+"...":p.bio}</div>}
            <div style={{ display:"flex",gap:6 }}>
              <Btn v="p" sm onClick={()=>setTab("pipeline")}>Run pipeline</Btn>
              <Btn sm onClick={()=>setEdit(p)}>Edit</Btn>
              <Btn v="r" sm onClick={()=>setPersonas(prev=>prev.filter(x=>x.id!==p.id))}>Delete</Btn>
            </div>
          </Card>;
        })}
      </div>
    )}
  </>);
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [email,setEmail]       = useState(()=>localStorage.getItem("token")?localStorage.getItem("email"):null);
  const [tab,setTab]           = useState("pipeline");
  const [personas,setPersonas] = useState(()=>ls.get("personas")||[]);
  const [posts,setPosts]       = useState(()=>ls.get("posts")||[]);
  const [toast,setToast]       = useState("");

  useEffect(()=>{ls.set("personas",personas);},[personas]);
  useEffect(()=>{ls.set("posts",posts);},[posts]);

  function addPosts(np) { setPosts(prev=>[...np,...prev]); setTab("queue"); setToast(`${np.length} posts added to review queue ✓`); }

  if (!email) return <Auth onLogin={e=>{localStorage.setItem("email",e);setEmail(e);}}/>;

  const pending = posts.filter(p=>p.status==="pending").length;
  const TABS = [
    {k:"pipeline",  ic:"▶",  l:"Pipeline"},
    {k:"queue",     ic:"📥", l:`Queue${pending>0?` (${pending})`:""}`},
    {k:"personas",  ic:"👤", l:"Personas"},
    {k:"intel",     ic:"🧠", l:"Intelligence"},
    {k:"distribute",ic:"🌐", l:"Distribute"},
  ];

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#f8f9fb", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{"@keyframes _sp{to{transform:rotate(360deg)}} *{box-sizing:border-box}"}</style>

      <div style={{ width:196, flexShrink:0, background:"#fff", borderRight:"1px solid #eee", padding:"1.25rem .875rem", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:"1.5rem" }}>
          <div style={{ width:28,height:28,borderRadius:7,background:"#5147C7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>⚡</div>
          <div style={{ fontSize:13,fontWeight:700,lineHeight:1.3 }}>Influencer<br/>Factory</div>
        </div>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{ width:"100%",textAlign:"left",padding:"7px 10px",border:"none",background:tab===t.k?"#EEF0FF":"transparent",borderRadius:8,fontSize:13,color:tab===t.k?"#5147C7":"#555",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit",fontWeight:tab===t.k?600:400,marginBottom:2 }}>
            <span>{t.ic}</span>{t.l}
          </button>
        ))}
        <div style={{ marginTop:"auto",paddingTop:12,borderTop:"1px solid #eee" }}>
          <div style={{ fontSize:11,color:"#888",marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{email}</div>
          <button onClick={()=>{localStorage.clear();setEmail(null);}} style={{ width:"100%",fontSize:12,padding:"5px 8px",border:"1px solid #eee",borderRadius:8,background:"transparent",color:"#888",cursor:"pointer",fontFamily:"inherit" }}>Sign out</button>
        </div>
      </div>

      <div style={{ flex:1,padding:"1.5rem",overflowY:"auto",minWidth:0 }}>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:"1.25rem" }}>
          {[["Personas",personas.length],["Pending",pending],["Approved",posts.filter(p=>p.status==="approved").length],["Posted",posts.filter(p=>p.status==="posted").length]].map(([l,v])=>(
            <div key={l} style={{ background:"#fff",border:"1px solid #eee",borderRadius:10,padding:"10px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
              <div style={{ fontSize:22,fontWeight:700,color:"#111" }}>{v}</div>
              <div style={{ fontSize:11,color:"#888",marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        {pending>0&&tab!=="queue"&&(
          <div onClick={()=>setTab("queue")} style={{ background:"#fefce8",border:"1px solid #fde047",borderRadius:9,padding:"9px 14px",fontSize:13,color:"#854d0e",display:"flex",alignItems:"center",gap:8,marginBottom:14,cursor:"pointer" }}>
            ⚠ {pending} post{pending>1?"s":""} waiting for review — click to open
          </div>
        )}

        {tab==="pipeline"   &&<Pipeline personas={personas} addPosts={addPosts}/>}
        {tab==="queue"      &&<Queue posts={posts} setPosts={setPosts}/>}
        {tab==="personas"   &&<PersonasTab personas={personas} setPersonas={setPersonas} posts={posts} setTab={setTab}/>}
        {tab==="intel"      &&<Intelligence personas={personas}/>}
        {tab==="distribute" &&<Distribution posts={posts}/>}
      </div>

      {toast&&<Toast msg={toast} onClose={()=>setToast("")}/>}
    </div>
  );
}
