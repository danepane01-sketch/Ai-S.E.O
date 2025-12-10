/* super_hyper_seo_engine.js - injected Super Hyper SEO Engine
   Lightweight client-side SEO analyzer and UI panel.
*/
const SEO = (function(){
  function normalizeText(s){ return (s||'').toString().trim().replace(/\s+/g,' '); }
  function tokenize(s){ return normalizeText(s).toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu,' ').split(/\s+/).filter(Boolean); }
  function stopwordsSet(){ return new Set(['the','and','or','is','a','an','to','of','in','for','with','on','by','this','that','it','as','are','be','from','at','was','will','can']); }
  function freq(tokens){ const f={}; for(const t of tokens) f[t]=(f[t]||0)+1; return f; }
  function topN(freqObj,n=10,filterSet=null){ return Object.entries(freqObj).filter(([k])=>!filterSet||!filterSet.has(k)).sort((a,b)=>b[1]-a[1]).slice(0,n).map(x=>({term:x[0],count:x[1]})); }
  function avgWordsPerSentence(s){ const sentences=(s.match(/[^.!?]+[.!?]*/g)||[]).map(x=>x.trim()).filter(Boolean); if(sentences.length===0) return 0; const totalWords=sentences.reduce((acc,sen)=> acc + tokenize(sen).length,0); return totalWords/sentences.length; }
  function extractCandidates(text,n=10){ const tokens = tokenize(text).filter(Boolean); const sw = stopwordsSet(); const filtered = tokens.filter(t => t.length>2 && !sw.has(t)); const f = freq(filtered); return topN(f,n); }
  function scoreReadability(text){ const avgWords = avgWordsPerSentence(text); const score = Math.max(0, 100 - Math.abs(avgWords - 16) * 6); return Math.round(score); }
  function scoreSEO(text,{keywords=[]}={}){ const tf = freq(tokenize(text)); let kwScore=0; for(const k of keywords) kwScore += (tf[k]||0); const kwFactor = Math.min(1, kwScore / Math.max(1, Math.log(1+text.length))); const readScore = scoreReadability(text)/100; const len = text.length; const lenFactor = Math.min(1, len/1000); const final = Math.round(100 * (0.5*kwFactor + 0.3*readScore + 0.2*lenFactor)); return final; }
  function generateTitle(text,keywords=[]){ const cand = extractCandidates(text,5).map(x=>x.term); const titleParts = []; if(keywords && keywords.length) titleParts.push(keywords.slice(0,2).join(' ')); for(const c of cand) if(titleParts.join(' ').length < 50) titleParts.push(c); const firstSentence = (text.match(/^[^.!?]+[.!?]?/)||[text])[0].trim(); const base = firstSentence.split(',')[0].slice(0,60); const title = (titleParts.join(' - ') || base).slice(0,70); return title.replace(/\s+/g,' ').trim(); }
  function generateMeta(text){ const t = normalizeText(text).replace(/\s+/g,' '); if(t.length <= 160) return t; return t.slice(0,155).replace(/\s+\S$/,''); }
  function estimateDuplicationRatio(text){ const sentences = (text.match(/[^.!?]+[.!?]*/g)||[]).map(s=>s.trim()).filter(Boolean); const seen = {}; let repeats=0; for(const s of sentences){ const k = s.toLowerCase().replace(/\s+/g,' '); seen[k]=(seen[k]||0)+1; if(seen[k]>1) repeats++; } return sentences.length ? repeats/sentences.length : 0; }
  function suggestImprovements(text,keywords=[]){ const suggestions = []; const words = tokenize(text); if(words.length < 200) suggestions.push('Content tergolong pendek. Pertimbangkan menambah detail (200+ kata).'); const duplicationRatio = estimateDuplicationRatio(text); if(duplicationRatio > 0.15) suggestions.push(`Terdeteksi duplikasi konten ~${Math.round(duplicationRatio*100)}%. Kurangi pengulangan atau gabungkan paragraf serupa.`); const read = scoreReadability(text); if(read < 50) suggestions.push('Tingkat keterbacaan rendah (kalimat terlalu panjang). Bagi kalimat panjang menjadi beberapa kalimat pendek.'); if(keywords.length===0) suggestions.push('Belum ada keyword utama. Pilih 1-3 keyword utama untuk target SEO.'); const h2count = (text.match(/\n#{1,6}\s+/g)||[]).length; if(h2count < 2) suggestions.push('Pertimbangkan menambahkan heading/subheading untuk struktur (H2/H3).'); return suggestions; }

  const MEM_KEY = 'seo_engine_memory_v1';
  function loadMemory(){ try{ const raw=localStorage.getItem(MEM_KEY); return raw?JSON.parse(raw):[]; }catch(e){return[];} }
  function saveMemory(mem){ try{ localStorage.setItem(MEM_KEY, JSON.stringify(mem)); }catch(e){} }
  function addMemory(item){ const mem=loadMemory(); mem.push({ts:Date.now(), ...item}); saveMemory(mem); }
  function memoryStats(){ const mem=loadMemory(); return {count:mem.length, last: mem.length?mem[mem.length-1].ts:null}; }

  let panelRoot = null;
  function createPanel(){
    if(panelRoot) return panelRoot;
    const root = document.createElement('div');
    root.id = 'seo-engine-panel';
    const css = `
      #seo-engine-panel{ position: fixed; right: 20px; bottom: 20px; width: 360px; max-height: 70vh; overflow:auto;
        background: rgba(15,23,42,0.95); color: #e6eef8; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        border: 1px solid rgba(99,102,241,0.12); font-family: Inter, system-ui, sans-serif; z-index:9999; padding:12px;}
      #seo-engine-panel h4{ margin:0 0 8px 0; font-size:16px; color:#cbd5e1;}
      #seo-engine-panel .row{ display:flex; gap:8px; margin-bottom:8px;}
      #seo-engine-panel textarea{ width:100%; min-height:120px; background:rgba(255,255,255,0.03); color:#e6eef8; border:1px solid rgba(255,255,255,0.04); padding:8px; border-radius:6px; resize:vertical;}
      #seo-engine-panel button{ background: linear-gradient(90deg, #6366f1, #8b5cf6); color:white; border:none; padding:8px 10px; border-radius:6px; cursor:pointer;}
      #seo-engine-panel .small{ font-size:12px; color:#94a3b8;}
      #seo-engine-panel .metric{ font-weight:700; color: #fff; }
      #seo-engine-panel .suggest{ background: rgba(255,255,255,0.03); padding:8px; border-radius:6px; margin-bottom:6px; font-size:13px;}
    `;
    const style = document.createElement('style'); style.textContent = css; root.appendChild(style);

    root.innerHTML += `
      <h4>Super Hyper SEO Engine</h4>
      <div class="small">Masukkan konten di bawah lalu klik "Analisa SEO"</div>
      <textarea id="seo-input" placeholder="Tempelkan konten artikel di sini..."></textarea>
      <div class="row">
        <input id="seo-keywords" placeholder="keyword utama (comma separated)" style="flex:1;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.04);background:rgba(255,255,255,0.02);color:#e6eef8;">
        <button id="seo-run">Analisa SEO</button>
      </div>
      <div id="seo-output"></div>
      <div class="small">Memory: <span id="seo-mem-count">0</span></div>
    `;
    document.body.appendChild(root);

    document.getElementById('seo-run').addEventListener('click', ()=>{
      const text = document.getElementById('seo-input').value || '';
      const kwRaw = document.getElementById('seo-keywords').value || '';
      const kws = kwRaw.split(',').map(s=>s.trim()).filter(Boolean);
      const res = analyze(text,{keywords:kws});
      renderOutput(res);
      addMemory({text,keywords:kws,result:res, ts:Date.now()});
      document.getElementById('seo-mem-count').textContent = memoryStats().count;
    });

    panelRoot = root;
    document.getElementById('seo-mem-count').textContent = memoryStats().count;
    return root;
  }

  function renderOutput(res){
    const out = document.getElementById('seo-output');
    if(!out) return;
    out.innerHTML = '';
    const html = [];
    html.push(`<div style="margin:6px 0"><span class="small">Title suggestion</span><div class="metric">${escapeHtml(res.title)}</div></div>`);
    html.push(`<div style="margin:6px 0"><span class="small">Meta description</span><div class="small">${escapeHtml(res.meta)}</div></div>`);
    html.push(`<div style="margin:6px 0"><span class="small">Top Keywords</span><div class="small">${res.topKeywords.map(k=>escapeHtml(k.term)+' ('+k.count+')').join(', ')}</div></div>`);
    html.push(`<div style="margin:6px 0"><span class="small">SEO Score</span><div class="metric">${res.seoScore}/100</div></div>`);
    html.push(`<div style="margin:6px 0"><span class="small">Readability</span><div class="metric">${res.readability}/100</div></div>`);
    if(res.suggestions && res.suggestions.length){ html.push(`<div style="margin-top:8px"><span class="small">Suggestions</span>`); for(const s of res.suggestions){ html.push(`<div class="suggest">${escapeHtml(s)}</div>`);} html.push(`</div>`); }
    html.push(`<div style="margin-top:8px;"><button id="seo-insert-meta">Salin Title & Meta</button> <button id="seo-export-json">Ekspor JSON</button></div>`);
    out.innerHTML = html.join('');
    document.getElementById('seo-insert-meta').addEventListener('click', ()=>{ copyToClipboard(`${res.title}\n\n${res.meta}`); alert('Title & Meta copied to clipboard.'); });
    document.getElementById('seo-export-json').addEventListener('click', ()=>{ const blob=new Blob([JSON.stringify(res,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='seo_analysis.json'; a.click(); URL.revokeObjectURL(url); });
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',\"'\":'&#39;'}[m]; }); }
  function copyToClipboard(txt){ try{ navigator.clipboard.writeText(txt);}catch(e){ const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } }

  function analyze(text,opts){ const t=normalizeText(text||''); const keywords=(opts&&opts.keywords)||extractCandidates(t,5).map(x=>x.term); const topKeywords=extractCandidates(t,8); const readability=scoreReadability(t); const seoScore=scoreSEO(t,{keywords}); const title=generateTitle(t,keywords); const meta=generateMeta(t); const suggestions=suggestImprovements(t,keywords); const duplication=estimateDuplicationRatio(t); return { title, meta, topKeywords, keywords, readability, seoScore, suggestions, duplication, length: t.length }; }

  return { init(){ createPanel(); return this; }, attachTo(selector){ createPanel(); const container=document.querySelector(selector); if(!container) throw new Error('Selector not found: '+selector); container.appendChild(panelRoot); return this; }, analyzeText(text,opts){ return analyze(text,opts); }, memoryStats, addMemory };
})();

if(typeof window !== 'undefined') window.SEO = SEO;
if(typeof module !== 'undefined') module.exports = SEO;
