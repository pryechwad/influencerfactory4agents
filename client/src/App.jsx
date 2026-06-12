import { useState, useEffect } from "react";

const BACKEND = (typeof process !== "undefined" && process.env?.REACT_APP_API_URL) || null;
const PREVIEW = !BACKEND;

const ls = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

const getToken = () => localStorage.getItem("token");
async function apiCall(method, path, body) {
  const r = await fetch(BACKEND + path, {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (r.status === 401) { localStorage.clear(); window.location.reload(); }
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}

async function callClaude(system, user, maxTokens = 2000) {
  if (!PREVIEW) {
    const d = await apiCall("POST", "/api/claude", { system, user, maxTokens });
    return d.text;
  }
  // Preview mode — sandbox blocks direct API calls
  // This will work correctly when deployed on Vercel + Render
  throw new Error("Preview mode: API calls are blocked by the sandbox. Deploy on Vercel to use the full app.");
}

function pj(raw) {
  let c = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  // Fix smart quotes
  c = c.replace(/‘/g, "'").replace(/’/g, "'").replace(/“/g, '"').replace(/”/g, '"');
  const s = c.indexOf("[") !== -1 ? c.indexOf("[") : c.indexOf("{");
  const e = Math.max(c.lastIndexOf("]"), c.lastIndexOf("}"));
  if (s === -1 || e < s) throw new Error("No JSON found in response");
  const str = c.slice(s, e + 1);
  try {
    return JSON.parse(str);
  } catch(err) {
    throw new Error("JSON Parse error: " + err.message);
  }
}

async function wtick(set, i, v) {
  set(p => { const n = [...p]; n[i] = v; return n; });
  await new Promise(r => setTimeout(r, 350));
}

// ── Styles ────────────────────────────────────────────────────────────────────
const INP = { fontSize:13, padding:"8px 11px", width:"100%", outline:"none", border:"1px solid #ddd", borderRadius:8, fontFamily:"inherit", background:"#fff", color:"#111", boxSizing:"border-box" };
const CARD = { background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem 1.25rem", marginBottom:12, boxShadow:"0 1px 3px rgba(0,0,0,.05)" };

// Instagram gradient
const IG_GRAD = "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)";
const IG_COLOR = "#E1306C";

const COLORS = [["#FFF0F5","#E1306C"],["#FFF7ED","#c2410c"],["#EEF0FF","#5147C7"],["#ECFDF5","#0a7c55"],["#EFF6FF","#1d4ed8"],["#F0FDF4","#15803d"]];
const TONES  = ["Inspirational","Aesthetic","Educational","Entertaining","Behind-the-scenes","Motivational","Lifestyle","Provocative"];
const NICHES = ["Fashion","Fitness","Food","Travel","Beauty","Business","Wellness","Tech","Art","Photography","Finance","Lifestyle"];

const avCol = i => COLORS[i % COLORS.length];
const avLet = n => (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

function Btn({ children, onClick, v="d", sm, disabled, full, style={} }) {
  const vs = {
    d:  { bg:"#fff",     bo:"1px solid #ddd",       co:"#333" },
    ig: { bg:IG_COLOR,   bo:"none",                  co:"#fff" },
    g:  { bg:"#0a7c55",  bo:"none",                  co:"#fff" },
    r:  { bg:"#fef2f2",  bo:"1px solid #fca5a5",     co:"#b91c1c" },
    y:  { bg:"#fefce8",  bo:"1px solid #fde047",     co:"#854d0e" },
  };
  const s = vs[v]||vs.d;
  return <button onClick={onClick} disabled={disabled} style={{ background:s.bg, border:s.bo, color:s.co, fontSize:sm?12:13, padding:sm?"4px 10px":"7px 16px", borderRadius:8, cursor:disabled?"not-allowed":"pointer", opacity:disabled?.5:1, display:"inline-flex", alignItems:"center", gap:5, fontFamily:"inherit", fontWeight:500, width:full?"100%":undefined, justifyContent:full?"center":undefined, ...style }}>{children}</button>;
}

const Card = ({ children, style={} }) => <div style={{ ...CARD, ...style }}>{children}</div>;

function Spin() { return <span style={{ width:13, height:13, borderRadius:"50%", border:"2px solid #ddd", borderTopColor:IG_COLOR, animation:"_sp .7s linear infinite", display:"inline-block", flexShrink:0 }}/>; }

function SBadge({ s }) {
  const m = { pending:{bg:"#fce7f3",c:"#9d174d",l:"Pending"}, approved:{bg:"#dcfce7",c:"#166534",l:"Approved"}, posted:{bg:"#dbeafe",c:"#1e40af",l:"Posted"}, rejected:{bg:"#fee2e2",c:"#991b1b",l:"Rejected"} };
  const t = m[s]||m.pending;
  return <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, fontWeight:600, background:t.bg, color:t.c }}>{t.l}</span>;
}

function ABadge({ n, label }) {
  const cs = { 1:{bg:"#fce7f3",c:"#9d174d"}, 2:{bg:"#FFF7ED",c:"#c2410c"}, 3:{bg:"#EEF0FF",c:"#5147C7"}, 4:{bg:"#ECFDF5",c:"#0a7c55"} };
  const t = cs[n]||cs[1];
  return <span style={{ fontSize:11, padding:"2px 9px", borderRadius:20, fontWeight:600, background:t.bg, color:t.c }}>Agent {n}{label?` — ${label}`:""}</span>;
}

function Steps({ steps, statuses, color=IG_COLOR }) {
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
  return <div style={{ height:3, background:"#f0f0f0", borderRadius:2, overflow:"hidden", margin:"8px 0" }}>
    <div style={{ height:"100%", background:IG_GRAD, width:`${pct}%`, transition:"width .4s", borderRadius:2 }}/>
  </div>;
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
          users[email]={pw}; ls.set("_u",users);
        } else {
          if (!users[email]||users[email].pw!==pw) { setErr("Wrong email or password"); setBusy(false); return; }
        }
        localStorage.setItem("token","preview");
        localStorage.setItem("email",email);
        onLogin(email);
      } else {
        const r = await fetch(`${BACKEND}/${mode}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})});
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
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#fafafa" }}>
      <style>{"@keyframes _sp{to{transform:rotate(360deg)}} *{box-sizing:border-box}"}</style>
      <div style={{ width:380 }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ width:56, height:56, borderRadius:16, background:IG_GRAD, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", boxShadow:"0 4px 20px #E1306C40", fontSize:28 }}>📸</div>
          <div style={{ fontSize:22, fontWeight:700, color:"#111" }}>Instagram Factory</div>
          <div style={{ fontSize:13, color:"#888", marginTop:5 }}>AI-powered Instagram content pipeline</div>
        </div>
        <div style={{ display:"flex", background:"#f0f0f0", borderRadius:10, padding:3, marginBottom:14 }}>
          {[["login","Sign in"],["signup","Create account"]].map(([k,l])=>(
            <button key={k} onClick={()=>{setMode(k);setErr("");}} style={{ flex:1, padding:"7px", border:"none", borderRadius:8, fontSize:13, fontFamily:"inherit", fontWeight:500, cursor:"pointer", background:mode===k?"#fff":"transparent", color:mode===k?"#111":"#888" }}>{l}</button>
          ))}
        </div>
        <Card>
          {err&&<div style={{ background:"#fce7f3", border:"1px solid #f9a8d4", borderRadius:8, padding:"8px 12px", fontSize:13, color:"#9d174d", marginBottom:12 }}>{err}</div>}
          <form onSubmit={go}>
            <div style={{ marginBottom:10 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Email</div><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@email.com" autoFocus style={INP}/></div>
            <div style={{ marginBottom:mode==="signup"?10:14 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Password</div><input value={pw} onChange={e=>setPw(e.target.value)} type="password" placeholder={mode==="signup"?"At least 6 characters":"••••••••"} style={INP}/></div>
            {mode==="signup"&&<div style={{ marginBottom:14 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Confirm password</div><input value={pw2} onChange={e=>setPw2(e.target.value)} type="password" placeholder="Repeat password" style={INP}/></div>}
            <Btn v="ig" full onClick={go} disabled={busy}>{busy?<><Spin/>{mode==="signup"?" Creating...":" Signing in..."}</>:mode==="signup"?"Create account →":"Sign in →"}</Btn>
          </form>
        </Card>
        <div style={{ fontSize:12, color:"#888", textAlign:"center", marginTop:10 }}>
          {mode==="login"?"New here? ":"Have an account? "}
          <span onClick={()=>{setMode(mode==="login"?"signup":"login");setErr("");}} style={{ color:IG_COLOR, cursor:"pointer", fontWeight:600 }}>{mode==="login"?"Create a free account":"Sign in"}</span>
        </div>
      </div>
    </div>
  );
}

// ── Persona Form ──────────────────────────────────────────────────────────────
function PersonaForm({ initial, onSave, onCancel }) {
  const [f,setF] = useState({ name:"", niche:"", tone:"Inspirational", bio:"", igHandle:"", targetAudience:"", ...initial });
  const up = k => e => setF(p=>({...p,[k]:e.target.value}));
  return (
    <Card>
      <div style={{ fontSize:15,fontWeight:600,marginBottom:14 }}>{f.id?"Edit":"New"} persona</div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Name *</div><input value={f.name} onChange={up("name")} placeholder="Sarah Lee" style={INP}/></div>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Instagram handle</div><input value={f.igHandle} onChange={up("igHandle")} placeholder="@sarahlee" style={INP}/></div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Niche</div>
          <select value={f.niche} onChange={up("niche")} style={INP}>
            <option value="">Select niche...</option>
            {NICHES.map(n=><option key={n}>{n}</option>)}
            <option value="Custom">Custom</option>
          </select>
        </div>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Tone</div>
          <select value={f.tone} onChange={up("tone")} style={INP}>{TONES.map(t=><option key={t}>{t}</option>)}</select>
        </div>
      </div>
      <div style={{ marginBottom:10 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Bio / backstory</div>
        <textarea value={f.bio} onChange={up("bio")} placeholder="Fitness coach helping women build strength and confidence..." style={{ ...INP,resize:"none",minHeight:64 }}/>
      </div>
      <div style={{ marginBottom:14 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Target audience</div>
        <input value={f.targetAudience} onChange={up("targetAudience")} placeholder="Women 25-35 interested in fitness and wellness" style={INP}/>
      </div>
      <div style={{ display:"flex",gap:8 }}>
        <Btn v="ig" onClick={()=>{if(!f.name.trim()){alert("Name required");return;}onSave({...f,id:f.id||Date.now().toString()});}} disabled={!f.name.trim()}>Save persona</Btn>
        <Btn onClick={onCancel}>Cancel</Btn>
      </div>
    </Card>
  );
}

// ── Pipeline (Agent 1 + 2) ────────────────────────────────────────────────────
function Pipeline({ personas, addPosts }) {
  const [pid,setPid]     = useState(personas[0]?.id||"");
  const [topic,setTopic] = useState("");
  const [count,setCount] = useState(3);
  const [running,setRun] = useState(false);
  const [pct,setPct]     = useState(0);
  const [a1,setA1]       = useState(["waiting","waiting","waiting"]);
  const [a2,setA2]       = useState(["waiting","waiting","waiting"]);
  const [cards,setCards] = useState([]);
  const [done,setDone]   = useState(false);
  const [err,setErr]     = useState("");
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
      // Agent 1: Research
      await wtick(setA1,0,"running"); setPct(10);
      const r1 = await callClaude(
        "You are an Instagram content researcher. Return ONLY a raw JSON array. No markdown, no explanation.",
        `Research 5 Instagram content ideas for this persona:
Name: ${p.name}, Niche: ${p.niche}, Tone: ${p.tone}, Audience: ${p.targetAudience||p.bio||"general"}
${topic?`Focus on: "${topic}"`:"Find the most engaging Instagram content topics right now for this niche"}
For each idea think about what makes people stop scrolling, save the post, and share it.
Return: [{"topic":"","insight":"why this resonates on Instagram","hook":"first line that stops the scroll","content_type":"carousel|single image|quote","confidence":"high"}]`
      );
      const resCards = pj(r1);
      setCards(resCards);
      await wtick(setA1,0,"✓"); await wtick(setA1,1,"running"); setPct(38);
      await wtick(setA1,1,"✓"); await wtick(setA1,2,"running"); setPct(52);
      await wtick(setA1,2,"✓"); setPct(56);

      // Agent 2: Content
      await wtick(setA2,0,"running"); setPct(62);
      const r2 = await callClaude(
        "You are a professional Instagram ghostwriter. Return ONLY a raw JSON array. No markdown, no explanation. Use \\n for line breaks inside strings. Escape all special characters properly.",
        `Write Instagram captions for ${p.name} (${p.igHandle||""}). Tone: ${p.tone}. Niche: ${p.niche}.
Topics to write about: ${resCards.map(c=>c.topic).join(", ")}
Write exactly ${count} caption(s) per topic.

Each caption must have:
- A hook opening line
- 2-3 short body lines separated by \\n
- A call to action line
- 15-20 hashtags at the end

Keep it simple and clean. No curly quotes. No special unicode.

Return this exact JSON format:
[{"topic":"topic name","captions":[{"caption":"hook line\\nbody line\\nbody line\\ncall to action\\n\\n#hashtag1 #hashtag2 #hashtag3","image_description":"short image description here"}]}]`
      );
      await wtick(setA2,0,"✓"); await wtick(setA2,1,"running"); setPct(82);
      const packs = pj(r2);
      const posts = [];
      packs.forEach((pack,pi)=>{
        (pack.captions||[]).forEach((item,ci)=>{
          posts.push({
            id:`${Date.now()}-${pi}-${ci}`,
            personaId:p.id, personaName:p.name,
            personaHandle:p.igHandle||"",
            topic:pack.topic,
            text:item.caption,
            imageDescription:item.image_description||"",
            status:"pending",
            createdAt:new Date().toISOString()
          });
        });
      });
      await wtick(setA2,1,"✓"); await wtick(setA2,2,"running"); setPct(97);
      await wtick(setA2,2,"✓"); setPct(100);
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
        {personas.map((pe,i)=>{ const [bg,tc]=avCol(i); return (
          <div key={pe.id} onClick={()=>setPid(pe.id)} style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:9,border:`1.5px solid ${pid===pe.id?IG_COLOR:"#e5e5e5"}`,background:pid===pe.id?"#FFF0F5":"#fff",cursor:"pointer" }}>
            <div style={{ width:28,height:28,borderRadius:"50%",background:bg,color:tc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700 }}>{avLet(pe.name)}</div>
            <div><div style={{ fontSize:13,fontWeight:600 }}>{pe.name}</div><div style={{ fontSize:11,color:"#888" }}>{pe.niche}</div></div>
          </div>
        );})}
      </div>
    </Card>

    <Card>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}><ABadge n={1} label="Research"/><span style={{ fontSize:12,color:"#888" }}>Claude finds the best Instagram content ideas</span></div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Topic focus (optional)</div><input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Leave blank to auto-discover" style={INP}/></div>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Captions per topic</div>
          <select value={count} onChange={e=>setCount(Number(e.target.value))} style={INP}>{[1,2,3].map(n=><option key={n} value={n}>{n} caption{n>1?"s":""}</option>)}</select>
        </div>
      </div>
    </Card>

    <Card style={{ opacity:.75 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5 }}><ABadge n={2} label="Content"/></div>
      <div style={{ fontSize:12,color:"#888" }}>Writes full captions with hooks, body, CTA, and 20-30 hashtags in {p?.name||"persona"}'s voice. Also suggests the perfect image for each post.</div>
    </Card>

    {err&&<div style={{ background:"#fce7f3",border:"1px solid #f9a8d4",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#9d174d",marginBottom:12 }}>❌ {err}</div>}

    <Btn v="ig" onClick={run} disabled={running||!pid}>
      {running?<><Spin/> Running pipeline...</>:"▶  Run pipeline ↗"}
    </Btn>

    {(running||pct>0)&&<Card style={{ marginTop:12 }}>
      <Pbar pct={pct}/>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:10 }}>
        <div>
          <div style={{ fontSize:10,color:"#888",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em" }}>Agent 1 · Research</div>
          <Steps steps={[{n:"Analysing niche",d:"Content ideas"},{n:"Finding hooks",d:"Scroll-stopping angles"},{n:"Mapping formats",d:"Carousel vs single vs quote"}]} statuses={a1} color={IG_COLOR}/>
        </div>
        <div>
          <div style={{ fontSize:10,color:"#888",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em" }}>Agent 2 · Content</div>
          <Steps steps={[{n:"Loading voice",d:"Tone + style"},{n:"Writing captions",d:`${count} per topic`},{n:"Adding hashtags",d:"20-30 per post"}]} statuses={a2} color="#0a7c55"/>
        </div>
      </div>
      {done&&<div style={{ marginTop:10,padding:"8px 12px",background:"#dcfce7",borderRadius:8,fontSize:13,color:"#166534" }}>✓ Posts added to your review queue</div>}
    </Card>}

    {cards.length>0&&<div style={{ marginTop:12 }}>
      <div style={{ fontSize:12,color:"#888",marginBottom:8 }}>Content ideas ({cards.length})</div>
      {cards.map((c,i)=><Card key={i} style={{ borderLeft:`3px solid ${IG_COLOR}`,padding:".75rem 1rem",marginBottom:8 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
          <div style={{ fontSize:13,fontWeight:600,flex:1 }}>{c.topic}</div>
          <span style={{ fontSize:11,padding:"2px 8px",borderRadius:20,background:"#fce7f3",color:"#9d174d",fontWeight:500 }}>{c.content_type}</span>
        </div>
        <div style={{ fontSize:12,color:"#666",marginBottom:3 }}>{c.insight}</div>
        <div style={{ fontSize:12,color:IG_COLOR }}>Hook: {c.hook}</div>
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
    {pending.length>0&&<div style={{ background:"#fce7f3",border:"1px solid #f9a8d4",borderRadius:9,padding:"9px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8 }}>
      <span style={{ fontSize:13,color:"#9d174d",fontWeight:600 }}>⚠ {pending.length} post{pending.length>1?"s":""} waiting for review</span>
      <div style={{ display:"flex",gap:6 }}>
        <Btn v="g" sm onClick={()=>pending.forEach(p=>upd(p.id,{status:"approved"}))}>✓ Approve all</Btn>
        <Btn v="r" sm onClick={()=>pending.forEach(p=>upd(p.id,{status:"rejected"}))}>✕ Reject all</Btn>
      </div>
    </div>}

    <div style={{ display:"flex",gap:6,marginBottom:12,flexWrap:"wrap" }}>
      {["pending","approved","posted","rejected","all"].map(s=>(
        <button key={s} onClick={()=>setFilter(s)} style={{ fontSize:11,padding:"3px 11px",borderRadius:20,border:`1px solid ${filter===s?IG_COLOR:"#e5e5e5"}`,background:filter===s?"#FFF0F5":"transparent",color:filter===s?IG_COLOR:"#888",cursor:"pointer",fontFamily:"inherit" }}>
          {s==="all"?"All":s.charAt(0).toUpperCase()+s.slice(1)} ({s==="all"?posts.length:posts.filter(p=>p.status===s).length})
        </button>
      ))}
    </div>

    {shown.length===0&&<div style={{ fontSize:13,color:"#888",textAlign:"center",padding:"1.5rem 0" }}>No posts here</div>}

    {shown.map(post=>(
      <Card key={post.id} style={{ marginBottom:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap" }}>
          <div style={{ fontSize:13,fontWeight:600,flex:1 }}>{post.personaName}</div>
          {post.personaHandle&&<div style={{ fontSize:11,color:IG_COLOR }}>{post.personaHandle}</div>}
          <SBadge s={post.status}/>
        </div>
        {post.topic&&<div style={{ fontSize:11,color:"#888",marginBottom:6 }}>{post.topic}</div>}

        {/* Image suggestion */}
        {post.imageDescription&&(
          <div style={{ background:"#fce7f3",borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"flex-start",gap:8 }}>
            <span style={{ fontSize:16 }}>📸</span>
            <div>
              <div style={{ fontSize:11,fontWeight:600,color:"#9d174d",marginBottom:2 }}>Suggested image</div>
              <div style={{ fontSize:12,color:"#555" }}>{post.imageDescription}</div>
            </div>
          </div>
        )}

        {/* Caption */}
        {editId===post.id?(
          <div style={{ marginBottom:9 }}>
            <textarea value={editText} onChange={e=>setEditText(e.target.value)} style={{ ...INP,resize:"vertical",minHeight:160,marginBottom:4 }}/>
            <div style={{ fontSize:11,color:editText.length>2200?"#b91c1c":"#888",marginBottom:6 }}>{editText.length}/2200 characters</div>
            <div style={{ display:"flex",gap:6 }}>
              <Btn v="ig" sm onClick={()=>{upd(post.id,{text:editText});setEditId(null);}}>Save</Btn>
              <Btn sm onClick={()=>setEditId(null)}>Cancel</Btn>
            </div>
          </div>
        ):(
          <div style={{ fontSize:13,lineHeight:1.75,marginBottom:10,color:"#111",whiteSpace:"pre-wrap",maxHeight:200,overflow:"hidden",WebkitMaskImage:"linear-gradient(to bottom, black 60%, transparent 100%)" }}>{post.text}</div>
        )}

        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
          {post.status==="pending"&&<>
            <Btn v="g" sm onClick={()=>upd(post.id,{status:"approved"})}>✓ Approve</Btn>
            <Btn v="r" sm onClick={()=>upd(post.id,{status:"rejected"})}>✕ Reject</Btn>
            <Btn sm onClick={()=>{setEditId(post.id);setEditText(post.text);}}>Edit</Btn>
          </>}
          {post.status==="approved"&&(
            <Btn v="ig" sm onClick={()=>{navigator.clipboard?.writeText(post.text);upd(post.id,{status:"posted"});}}>
              📋 Copy & mark posted
            </Btn>
          )}
          <Btn sm onClick={()=>navigator.clipboard?.writeText(post.text)}>Copy caption</Btn>
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
    const labels = { weekly:"Weekly Instagram learning report", competitor:"Competitor account analysis", hooks:"Hook and caption performance", hashtags:"Hashtag strategy optimisation", monetisation:"Monetisation signals" };
    try {
      await wtick(setSteps,0,"running"); await wtick(setSteps,1,"running"); await wtick(setSteps,0,"✓"); await wtick(setSteps,2,"running");
      const r = await callClaude(
        "You are an Instagram growth analyst. Be specific and actionable.",
        `Produce a ${labels[type]} for "${p?.name||"this creator"}" (${p?.niche||"general"} niche, Instagram).
${data?`Performance data:\n${data}`:"Use Instagram best practices for this niche."}
${comp?`Competitor accounts to analyse: ${comp}`:""}
Cover:
1. What is working — content formats, hooks, posting times to double down on
2. What to stop or reduce
3. Three experiments for next week
4. Content gaps and opportunities
5. Hashtag recommendations — mix of small (10k-100k), medium (100k-1M), large (1M+)
6. Monetisation or collaboration opportunities
7. One priority action this week`
      );
      await wtick(setSteps,1,"✓"); await wtick(setSteps,2,"✓");
      setResult(r);
    } catch(e) {
      setErr(e.message);
      setSteps(p=>{const n=[...p];const i=n.indexOf("running");if(i>=0)n[i]="✗";return n;});
    }
    setRun(false);
  }

  return (<>
    <Card>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}><ABadge n={3} label="Intelligence"/></div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Persona</div>
          <select value={pid} onChange={e=>setPid(e.target.value)} style={INP}><option value="">All personas</option>{personas.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Report type</div>
          <select value={type} onChange={e=>setType(e.target.value)} style={INP}>
            <option value="weekly">Weekly learning report</option>
            <option value="competitor">Competitor analysis</option>
            <option value="hooks">Hook performance</option>
            <option value="hashtags">Hashtag strategy</option>
            <option value="monetisation">Monetisation signals</option>
          </select></div>
      </div>
      <div style={{ marginBottom:10 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Performance data (optional)</div>
        <textarea value={data} onChange={e=>setData(e.target.value)} placeholder="Top post this week, reach, saves, profile visits..." style={{ ...INP,resize:"none",minHeight:64 }}/></div>
      <div style={{ marginBottom:12 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Competitor accounts (optional)</div>
        <input value={comp} onChange={e=>setComp(e.target.value)} placeholder="@account1, @account2..." style={INP}/></div>
      {err&&<div style={{ background:"#fce7f3",border:"1px solid #f9a8d4",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#9d174d",marginBottom:10 }}>❌ {err}</div>}
      <Btn v="y" onClick={run} disabled={running}>{running?<><Spin/> Analysing...</>:"Run intelligence agent ↗"}</Btn>
    </Card>
    {(running||result)&&<Card>
      <Steps steps={[{n:"Analysing performance",d:"What worked"},{n:"Competitor scan",d:"Gaps + moves"},{n:"Generate report",d:"Actions + priorities"}]} statuses={steps} color="#c2410c"/>
      {result&&<div style={{ marginTop:12,fontSize:13,color:"#444",lineHeight:1.8,whiteSpace:"pre-wrap",borderTop:"1px solid #f0f0f0",paddingTop:12 }}>{result}</div>}
    </Card>}
  </>);
}

// ── Distribution (Agent 4) ────────────────────────────────────────────────────
function Distribution({ posts }) {
  const [postId,setPostId]     = useState("");
  const [channels,setChannels] = useState(["Blog post","Pinterest","LinkedIn"]);
  const [intent,setIntent]     = useState("Authority");
  const [steps,setSteps]       = useState(["waiting","waiting","waiting"]);
  const [result,setResult]     = useState("");
  const [running,setRun]       = useState(false);
  const [err,setErr]           = useState("");
  const ALL = ["Blog post","Pinterest","LinkedIn","Facebook","Twitter/X","Email newsletter","YouTube description"];

  async function run() {
    const post = posts.find(p=>p.id===postId);
    if (!post) { alert("Select a post first"); return; }
    setRun(true); setResult(""); setErr(""); setSteps(["waiting","waiting","waiting"]);
    try {
      await wtick(setSteps,0,"running"); await wtick(setSteps,1,"running"); await wtick(setSteps,0,"✓"); await wtick(setSteps,2,"running");
      const r = await callClaude(
        "You are a content distribution expert. Write platform-ready content with a clear header for each channel.",
        `Repurpose this Instagram post for other platforms.
Persona: ${post.personaName} (${post.personaHandle})
Topic: ${post.topic}
Original caption: "${post.text.slice(0,500)}"
Image description: "${post.imageDescription||""}"
Channels: ${channels.join(", ")}
Intent: ${intent}
For each channel write fully adapted, platform-optimised content.`
      );
      await wtick(setSteps,1,"✓"); await wtick(setSteps,2,"✓");
      setResult(r);
    } catch(e) {
      setErr(e.message);
      setSteps(p=>{const n=[...p];const i=n.indexOf("running");if(i>=0)n[i]="✗";return n;});
    }
    setRun(false);
  }

  return (<>
    <Card>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}><ABadge n={4} label="Distribution"/></div>
      <div style={{ marginBottom:10 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Select a post</div>
        <select value={postId} onChange={e=>setPostId(e.target.value)} style={INP}>
          <option value="">— pick a post —</option>
          {posts.filter(p=>p.status!=="rejected").map(p=><option key={p.id} value={p.id}>{p.personaName} · {(p.topic||p.text||"").slice(0,45)}</option>)}
        </select></div>
      <div style={{ marginBottom:10 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Repurpose to</div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginTop:3 }}>
          {ALL.map(c=><span key={c} onClick={()=>setChannels(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c])} style={{ fontSize:12,padding:"3px 10px",borderRadius:20,cursor:"pointer",background:channels.includes(c)?"#FFF0F5":"#f5f5f5",border:`1px solid ${channels.includes(c)?IG_COLOR:"#e5e5e5"}`,color:channels.includes(c)?IG_COLOR:"#888" }}>{c}</span>)}
        </div></div>
      <div style={{ marginBottom:12 }}><div style={{ fontSize:12,color:"#666",marginBottom:4 }}>Intent</div>
        <select value={intent} onChange={e=>setIntent(e.target.value)} style={INP}>
          {["Authority","Drive traffic","Community seeding","Brand awareness","Lead generation"].map(o=><option key={o}>{o}</option>)}
        </select></div>
      {err&&<div style={{ background:"#fce7f3",border:"1px solid #f9a8d4",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#9d174d",marginBottom:10 }}>❌ {err}</div>}
      <Btn v="ig" onClick={run} disabled={running}>{running?<><Spin/> Distributing...</>:"Run distribution agent ↗"}</Btn>
    </Card>
    {(running||result)&&<Card>
      <Steps steps={[{n:"Adapting content",d:channels.slice(0,2).join(", ")+"..."},{n:"Platform optimisation",d:"Format + tone"},{n:"Final output",d:"Ready to publish"}]} statuses={steps} color="#1d4ed8"/>
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
    <Btn v="ig" onClick={()=>setForm(true)} style={{ marginBottom:14 }}>+ New persona</Btn>
    {!personas.length?<div style={{ textAlign:"center",padding:"3rem",color:"#888",fontSize:13 }}>No personas yet — create your first one above</div>:(
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10 }}>
        {personas.map((p,i)=>{
          const [bg,tc]=avCol(i);
          const pend=posts.filter(x=>x.personaId===p.id&&x.status==="pending").length;
          return <Card key={p.id} style={{ marginBottom:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
              <div style={{ width:40,height:40,borderRadius:"50%",background:IG_GRAD,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700 }}>{avLet(p.name)}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                <div style={{ fontSize:11,color:IG_COLOR }}>{p.igHandle||"No handle"}</div>
              </div>
              {pend>0&&<span style={{ fontSize:10,background:IG_COLOR,color:"#fff",borderRadius:20,padding:"2px 8px",fontWeight:600 }}>{pend}</span>}
            </div>
            <div style={{ fontSize:12,color:"#666",marginBottom:6 }}>{p.niche} · {p.tone}</div>
            {p.bio&&<div style={{ fontSize:12,color:"#888",lineHeight:1.6,marginBottom:10 }}>{p.bio.length>80?p.bio.slice(0,80)+"...":p.bio}</div>}
            <div style={{ display:"flex",gap:6 }}>
              <Btn v="ig" sm onClick={()=>setTab("pipeline")}>Run pipeline</Btn>
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
  const [personas,setPersonas] = useState(()=>ls.get("ig_personas")||[]);
  const [posts,setPosts]       = useState(()=>ls.get("ig_posts")||[]);
  const [toast,setToast]       = useState("");

  useEffect(()=>{ls.set("ig_personas",personas);},[personas]);
  useEffect(()=>{ls.set("ig_posts",posts);},[posts]);

  function addPosts(np) { setPosts(prev=>[...np,...prev]); setTab("queue"); setToast(`${np.length} posts added to review queue ✓`); }

  if (!email) return <Auth onLogin={e=>{localStorage.setItem("email",e);setEmail(e);}}/>;

  const pending = posts.filter(p=>p.status==="pending").length;
  const TABS = [
    {k:"pipeline",  ic:"▶",  l:"Pipeline"},
    {k:"queue",     ic:"📥", l:`Queue${pending>0?` (${pending})`:""}`},
    {k:"personas",  ic:"👤", l:"Personas"},
    {k:"intel",     ic:"🧠", l:"Intelligence"},
    {k:"distribute",ic:"🔄", l:"Distribute"},
  ];

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#fafafa", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{"@keyframes _sp{to{transform:rotate(360deg)}} *{box-sizing:border-box}"}</style>

      {/* Sidebar */}
      <div style={{ width:196, flexShrink:0, background:"#fff", borderRight:"1px solid #eee", padding:"1.25rem .875rem", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:"1.5rem" }}>
          <div style={{ width:28,height:28,borderRadius:7,background:IG_GRAD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>📸</div>
          <div style={{ fontSize:13,fontWeight:700,lineHeight:1.3 }}>Instagram<br/>Factory</div>
        </div>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{ width:"100%",textAlign:"left",padding:"7px 10px",border:"none",background:tab===t.k?"#FFF0F5":"transparent",borderRadius:8,fontSize:13,color:tab===t.k?IG_COLOR:"#555",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit",fontWeight:tab===t.k?600:400,marginBottom:2 }}>
            <span>{t.ic}</span>{t.l}
          </button>
        ))}
        <div style={{ marginTop:"auto",paddingTop:12,borderTop:"1px solid #eee" }}>
          <div style={{ fontSize:11,color:"#888",marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{email}</div>
          <button onClick={()=>{localStorage.clear();setEmail(null);}} style={{ width:"100%",fontSize:12,padding:"5px 8px",border:"1px solid #eee",borderRadius:8,background:"transparent",color:"#888",cursor:"pointer",fontFamily:"inherit" }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1,padding:"1.5rem",overflowY:"auto",minWidth:0 }}>
        {/* Stats */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:"1.25rem" }}>
          {[["Personas",personas.length],["Pending",pending],["Approved",posts.filter(p=>p.status==="approved").length],["Posted",posts.filter(p=>p.status==="posted").length]].map(([l,v])=>(
            <div key={l} style={{ background:"#fff",border:"1px solid #eee",borderRadius:10,padding:"10px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
              <div style={{ fontSize:22,fontWeight:700,color:"#111" }}>{v}</div>
              <div style={{ fontSize:11,color:"#888",marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        {pending>0&&tab!=="queue"&&(
          <div onClick={()=>setTab("queue")} style={{ background:"#fce7f3",border:"1px solid #f9a8d4",borderRadius:9,padding:"9px 14px",fontSize:13,color:"#9d174d",display:"flex",alignItems:"center",gap:8,marginBottom:14,cursor:"pointer" }}>
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
