import React, { useEffect, useMemo, useRef, useState } from 'react';

const API = 'http://localhost:8787';
const STYLE_MODES = ['Adaptive', 'Minimal', 'Streetwear', 'Quiet Luxury', 'Y2K', 'Workwear', 'Avant-Garde'];
const TREND_LENSES = ['Timeless', 'Current', 'Experimental'];

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('closet');
  const [inventory, setInventory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([{ role: 'assistant', text: 'Scan your closet. I’ll learn your palette, silhouettes, and what actually works together.' }]);
  const [status, setStatus] = useState('Camera off');
  const [loading, setLoading] = useState(false);
  const [styleMode, setStyleMode] = useState('Adaptive');
  const [trendLens, setTrendLens] = useState('Current');
  const [bodyPhoto, setBodyPhoto] = useState(null);
  const [garmentPhoto, setGarmentPhoto] = useState(null);
  const [tryOnResult, setTryOnResult] = useState(null);
  const [tryOnStatus, setTryOnStatus] = useState('Upload one full-body photo to create your fitting-room base.');

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    videoRef.current.srcObject = stream;
    setStatus('Camera ready');
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  }

  async function scanFrame() {
    setLoading(true);
    try {
      const image = captureFrame();
      const res = await fetch(`${API}/api/closet/scan`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ image, existingInventory: inventory }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setInventory(data.inventory || []);
      setStatus(`Found ${data.inventory?.length || 0} closet items`);
    } catch (e) { setStatus(e.message); }
    finally { setLoading(false); }
  }

  async function sendChat(seedMessage) {
    const text = (seedMessage || message).trim();
    if (!text) return;
    const user = { role:'user', text };
    setChat(c => [...c, user]);
    setMessage(''); setLoading(true);
    try {
      const res = await fetch(`${API}/api/chat`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ message:user.text, inventory, selectedItem:selected, history:chat.slice(-8), styleMode, trendLens }) });
      const data = await res.json();
      setChat(c => [...c, { role:'assistant', text:data.text || data.error }]);
    } finally { setLoading(false); }
  }

  async function shouldIBuy(file) {
    if (!file) return;
    const image = await fileToDataUrl(file);
    setLoading(true);
    const res = await fetch(`${API}/api/buy-check`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ image, inventory, styleMode, trendLens }) });
    const data = await res.json();
    setChat(c => [...c, { role:'assistant', text:data.text || data.error }]);
    setLoading(false);
    setMode('stylist');
  }

  async function setPhoto(file, setter, kind) {
    if (!file) return;
    const data = await fileToDataUrl(file);
    setter(data);
    setTryOnResult(null);
    if (kind === 'body') setTryOnStatus('Base look saved. Now add a garment to try on.');
  }

  async function generateTryOn() {
    if (!bodyPhoto || !garmentPhoto) return;
    setLoading(true); setTryOnStatus('Generating your fitting-room preview…');
    try {
      const res = await fetch(`${API}/api/try-on`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ bodyImage: bodyPhoto, garmentImage: garmentPhoto, styleMode }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Try-on failed');
      setTryOnResult(data.image);
      setTryOnStatus('Preview ready. Keep the same base photo and swap garments.');
    } catch (e) { setTryOnStatus(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { startCamera().catch(() => setStatus('Camera permission needed')); }, []);

  const palette = useMemo(() => summarizePalette(inventory), [inventory]);

  return <div className="shell">
    <aside className="rail">
      <div className="brandMark">CC</div>
      <nav>
        <NavButton active={mode==='closet'} onClick={()=>setMode('closet')} icon="▦" label="Closet" />
        <NavButton active={mode==='stylist'} onClick={()=>setMode('stylist')} icon="✦" label="Stylist" />
        <NavButton active={mode==='wardrobe'} onClick={()=>setMode('wardrobe')} icon="◫" label="Wardrobe" />
      </nav>
      <div className="railFoot">AI / LIVE</div>
    </aside>

    <div className="page">
      <header className="topbar">
        <div><div className="eyebrow">CLOSET CO-SHOPPER</div><h1>{mode === 'wardrobe' ? 'Virtual Wardrobe' : mode === 'stylist' ? 'Personal Stylist' : 'Your Closet'}</h1></div>
        <div className="statusDot"><i />{status}</div>
      </header>

      <div className="controlStrip">
        <div className="controlGroup"><span>STYLE</span>{STYLE_MODES.map(s=><button key={s} className={styleMode===s?'chip active':'' || 'chip'} onClick={()=>setStyleMode(s)}>{s}</button>)}</div>
        <div className="controlGroup"><span>LENS</span>{TREND_LENSES.map(s=><button key={s} className={trendLens===s?'chip active':'chip'} onClick={()=>setTrendLens(s)}>{s}</button>)}</div>
      </div>

      {mode === 'closet' && <div className="closetLayout">
        <section className="cameraCard panel">
          <div className="sectionTop"><div><span className="kicker">LIVE SCAN</span><h2>Show me what you own.</h2></div><span className="count">{inventory.length.toString().padStart(2,'0')}</span></div>
          <div className="videoWrap"><video ref={videoRef} autoPlay playsInline muted /><div className="frameCorners"/><div className="scanLine"/><div className="cameraLabel">LIVE / VONAGE READY</div></div>
          <canvas ref={canvasRef} hidden />
          <div className="actions"><button className="primary" onClick={scanFrame} disabled={loading}>{loading?'ANALYZING…':'SCAN THIS VIEW'}</button><label className="ghost">SHOULD I BUY THIS?<input hidden type="file" accept="image/*" onChange={e=>shouldIBuy(e.target.files?.[0])}/></label></div>
        </section>

        <section className="insightCard panel">
          <span className="kicker">COLOR THEORY</span><h2>Closet Palette</h2>
          <div className="paletteRow">{palette.map((c,i)=><div key={`${c}-${i}`} className="paletteSwatch" title={c} style={{background: colorToCss(c)}} />)}</div>
          <p className="muted">Recommendations balance contrast, analogous colors, saturation, and neutral anchors — not just matching keywords.</p>
          <button className="textAction" onClick={()=>{setMode('stylist');sendChat('Analyze my closet color palette. Tell me my strongest color combinations, what colors I over-own, and one color gap worth adding.')}}>ANALYZE MY COLOR DNA →</button>
        </section>

        <section className="inventory panel wide">
          <div className="sectionTop"><div><span className="kicker">INDEX</span><h2>Wardrobe Pieces</h2></div><button className="textAction" onClick={()=>setSelected(null)}>VIEW ALL</button></div>
          {inventory.length === 0 ? <div className="emptyState"><div>+</div><p>Scan a few pieces to build your wardrobe graph.</p></div> : <div className="fashionGrid">{inventory.map(item => <button key={item.id} className={`fashionCard ${selected?.id===item.id?'active':''}`} onClick={()=>{setSelected(item);setMode('stylist')}}><div className="itemVisual" style={{background: colorToCss(item.color)}}><span>{item.emoji || '✦'}</span></div><div className="itemMeta"><b>{item.name}</b><small>{item.category} / {item.color}</small></div></button>)}</div>}
        </section>
      </div>}

      {mode === 'stylist' && <div className="stylistLayout">
        <section className="styleContext panel">
          <span className="kicker">ACTIVE CONTEXT</span>
          <h2>{selected?.name || 'Whole Closet'}</h2>
          <p className="muted">{styleMode} style · {trendLens} lens</p>
          <div className="quickPrompts">
            <button onClick={()=>sendChat('Build me one outfit using color theory and only clothes I own. Explain the palette in one sentence.')}>BUILD A LOOK</button>
            <button onClick={()=>sendChat('Give me a one-swap improvement for an outfit centered on my selected item. Use something I already own.')}>ONE-SWAP FIX</button>
            <button onClick={()=>sendChat('What is the most versatile piece in my closet and why?')}>MOST VERSATILE</button>
            <button onClick={()=>sendChat('Give me 3 outfits that fit my selected style direction without inventing clothes I do not own.')}>3 STYLE ROUTES</button>
          </div>
          <label className="uploadTile">+ CHECK A NEW PIECE<input hidden type="file" accept="image/*" onChange={e=>shouldIBuy(e.target.files?.[0])}/></label>
        </section>

        <section className="chatPanel panel">
          <div className="chatHeader"><div><span className="kicker">CO-SHOPPER</span><h2>Ask like you’d ask a friend.</h2></div>{selected && <button className="textAction" onClick={()=>setSelected(null)}>CLEAR ITEM</button>}</div>
          <div className="messages">{chat.map((m,i)=><div key={i} className={`bubble ${m.role}`}>{m.text}</div>)}</div>
          <div className="composer"><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder="Does this work? Make it cleaner. What shoes?"/><button onClick={()=>sendChat()}>↑</button></div>
        </section>
      </div>}

      {mode === 'wardrobe' && <div className="wardrobeLayout">
        <section className="fittingRoom panel">
          <div className="sectionTop"><div><span className="kicker">VIRTUAL FITTING ROOM</span><h2>Your body. Infinite closet.</h2></div><span className="beta">BETA</span></div>
          <div className="tryOnStage">
            {tryOnResult ? <img src={tryOnResult} alt="AI virtual try-on" /> : bodyPhoto ? <img src={bodyPhoto} alt="Full body base" /> : <div className="bodyPlaceholder"><div className="silhouette">◇</div><b>ADD A FULL-BODY PHOTO</b><span>Front-facing / good light / full outfit visible</span></div>}
            <div className="stageTag">{tryOnResult ? 'AI PREVIEW' : 'BASE PHOTO'}</div>
          </div>
          <p className="tryOnStatus">{tryOnStatus}</p>
        </section>

        <section className="wardrobeControls panel">
          <span className="kicker">01 / SET YOUR BASE</span><h3>Upload once.</h3><p className="muted">Think Snapchat-style: one clean full-body image stays as your fitting-room identity while you cycle through pieces.</p>
          <label className="dropZone">{bodyPhoto ? '✓ BASE PHOTO READY' : '+ UPLOAD FULL-BODY PHOTO'}<input hidden type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0],setBodyPhoto,'body')}/></label>
          <div className="rule"/>
          <span className="kicker">02 / PICK A PIECE</span><h3>Try something on.</h3>
          <label className="dropZone">{garmentPhoto ? '✓ GARMENT READY' : '+ UPLOAD CLOTHING PHOTO'}<input hidden type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0],setGarmentPhoto,'garment')}/></label>
          {garmentPhoto && <img className="garmentThumb" src={garmentPhoto} alt="Garment" />}
          <button className="primary full" disabled={!bodyPhoto || !garmentPhoto || loading} onClick={generateTryOn}>{loading?'GENERATING LOOK…':'TRY IT ON'}</button>
          <p className="finePrint">Generated preview is a visual simulation, not a guarantee of physical fit or sizing.</p>
        </section>
      </div>}
    </div>
  </div>
}

function NavButton({active,onClick,icon,label}){return <button className={`navBtn ${active?'active':''}`} onClick={onClick}><span>{icon}</span><small>{label}</small></button>}
function fileToDataUrl(file){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); }
function summarizePalette(items){const colors=items.map(x=>x.color).filter(Boolean); return colors.length ? [...new Set(colors)].slice(0,7) : ['black','white','charcoal','stone','navy'];}
function colorToCss(name='gray'){const n=String(name).toLowerCase(); const map={black:'#111111',white:'#f4f4f2',gray:'#a5a5a1',grey:'#a5a5a1',charcoal:'#343434',stone:'#c8c2b8',navy:'#1b2740',blue:'#315d8c',brown:'#6c4b38',beige:'#d7c7aa',cream:'#eee7d7',red:'#9e2f2f',green:'#4c684e',olive:'#737052',pink:'#d99a9f',purple:'#65507f',yellow:'#d0b34d',orange:'#c8793c'}; return map[n] || '#d9d9d6';}
export default App;
