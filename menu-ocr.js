// Menu photo scanner — injected via <script src="menu-ocr.js" defer>
// Requires FOODS, RESTRICTIONS, INGREDIENTS, mode, render to be in global scope.
(function () {
  'use strict';

  // ── CONSTANTS ────────────────────────────────────────────────────────────────

  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const MATCH_THRESHOLD = 0.25;
  const MAX_IMAGE_PX = 2000;

  // Keyword hints: food category → words that suggest a dish belongs there.
  const CAT_KEYWORDS = {
    'Beef & Veal':         ['wagyu','steak','ribeye','filet','brisket','short rib','veal','tenderloin','prime rib','sirloin'],
    'Lamb & Game':         ['lamb','venison','duck','rabbit','foie','chop','rack of lamb','game'],
    'Pork & Charcuterie':  ['pork','bacon','prosciutto','ham','salami','chorizo','sausage','lardons','pancetta'],
    'Poultry':             ['chicken','turkey','quail','hen','poultry','capon'],
    'Shellfish':           ['lobster','shrimp','crab','scallop','oyster','mussel','clam','prawn'],
    'Fish':                ['salmon','tuna','cod','halibut','sea bass','branzino','sole','trout','snapper','mahi'],
    'Vegetables':          ['asparagus','broccoli','carrot','beet','artichoke','eggplant','zucchini','leek'],
    'Fruits':              ['mango','pineapple','berry','apple','fig','peach','citrus'],
    'Grains & Bread':      ['pasta','risotto','gnocchi','polenta','bread','rice','farro','couscous'],
    'Soup & Broth':        ['soup','bisque','broth','consomme','gazpacho','chowder','veloute'],
    'Dessert':             ['cake','tart','mousse','souffle','chocolate','ice cream','sorbet','pudding','creme brulee','gelato'],
    'Cheese':              ['brie','camembert','gouda','gruyere','parmesan','burrata','ricotta','blue cheese','fontina'],
    'Dairy & Eggs':        ['egg','frittata','quiche','custard','cream','omelette'],
    'Nuts & Seeds':        ['walnut','almond','pecan','pistachio','cashew','hazelnut'],
    'Mushroom':            ['mushroom','porcini','shiitake','chanterelle','morel','truffle'],
    'Technique & Sauce':   ['hollandaise','reduction','confit','tartare','carpaccio','ceviche','bechamel','foam','emulsion'],
  };

  // ── A. CSS ───────────────────────────────────────────────────────────────────

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .ocr-btn {
        padding: 3px 12px; border-radius: 20px;
        border: 1px solid var(--accent); background: transparent;
        color: var(--accent); font-size: 12px; cursor: pointer;
        font-family: inherit; transition: all .15s; white-space: nowrap;
      }
      .ocr-btn:hover { background: var(--accentDim); color: #fff; }

      #ocr-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.55);
        z-index: 499; opacity: 0; pointer-events: none;
        transition: opacity .3s ease;
      }
      #ocr-overlay.open { opacity: 1; pointer-events: auto; }

      #ocr-panel {
        position: fixed; top: 0; right: 0;
        height: 100dvh; width: min(480px, 100vw);
        background: var(--bg2); border-left: 1px solid var(--border);
        z-index: 500; display: flex; flex-direction: column;
        transform: translateX(100%); transition: transform .3s ease;
        overflow: hidden;
      }
      #ocr-panel.open { transform: translateX(0); }

      #ocr-panel-hdr {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px 12px; border-bottom: 1px solid var(--border);
        flex-shrink: 0;
      }
      #ocr-panel-hdr h2 { font-size: 15px; font-weight: 700; color: var(--accent); margin: 0; }
      #ocr-close {
        background: none; border: none; color: var(--dim);
        font-size: 22px; cursor: pointer; line-height: 1; padding: 2px 6px; border-radius: 4px;
      }
      #ocr-close:hover { color: var(--text); }

      #ocr-prog-wrap {
        flex-shrink: 0; padding: 8px 16px 6px;
        border-bottom: 1px solid var(--border); display: none;
      }
      #ocr-prog-wrap.active { display: block; }
      #ocr-prog-bar { height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }
      #ocr-prog-fill { height: 100%; background: var(--accent); width: 0%; transition: width .3s ease; }
      #ocr-status { font-size: 11px; color: var(--dim); margin-top: 5px; }

      #ocr-drop {
        flex-shrink: 0; margin: 14px 16px;
        border: 2px dashed var(--border); border-radius: 8px;
        padding: 20px; text-align: center; cursor: pointer;
        transition: border-color .15s; background: var(--bg3);
      }
      #ocr-drop:hover, #ocr-drop.drag { border-color: var(--accent); }
      #ocr-drop .drop-icon { font-size: 32px; display: block; margin-bottom: 8px; }
      #ocr-drop p { color: var(--dim); font-size: 12px; margin: 0; line-height: 1.7; }
      #ocr-drop p strong { color: var(--accent); }
      #ocr-file { display: none; }

      #ocr-results { flex: 1; overflow-y: auto; padding: 0 16px 24px; }

      .ocr-group { margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
      .ocr-group:last-child { border-bottom: none; }
      .ocr-raw { font-size: 11px; color: var(--dim); font-style: italic; margin: 10px 0 6px; }

      .ocr-card {
        background: var(--bg3); border: 1px solid var(--border);
        border-radius: 6px; padding: 10px 12px; margin-bottom: 8px;
      }
      .ocr-card-hdr {
        display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 4px;
      }
      .ocr-card .food-name { font-size: 13px; font-weight: 600; }
      .ocr-badge {
        font-size: 10px; font-weight: 700; padding: 1px 7px;
        border-radius: 10px; white-space: nowrap; flex-shrink: 0;
      }
      .ocr-badge-strong { background: var(--yes); color: var(--yestxt); }
      .ocr-badge-likely { background: var(--unk); color: var(--unktxt); }
      .ocr-badge-weak   { background: var(--bg2); color: var(--dim); border: 1px solid var(--border); }
      .ocr-card .food-cat  { font-size: 11px; color: var(--dim); display: block; margin-bottom: 4px; }
      .ocr-card .food-desc { font-size: 11px; color: #666; display: block; margin-bottom: 8px; line-height: 1.45; }

      .ocr-mini-row { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 8px; }
      .ocr-cell {
        width: 30px; height: 30px; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; cursor: default;
      }
      .ocr-cell.y { background: var(--yes); }
      .ocr-cell.n { background: var(--no); }
      .ocr-cell.p { background: var(--partial); }
      .ocr-cell.u { background: var(--unk); }
      .mode-contains .ocr-cell.n { background: #242424; }

      .ocr-lookup {
        font-size: 11px; padding: 3px 10px; border-radius: 12px;
        border: 1px solid var(--accentDim); background: transparent;
        color: var(--accent); cursor: pointer; font-family: inherit; transition: all .15s;
      }
      .ocr-lookup:hover { background: var(--accentDim); color: #fff; }

      .ocr-empty { text-align: center; padding: 40px 20px; color: var(--dim); }
      .ocr-empty .ei { font-size: 40px; margin-bottom: 12px; }
      .ocr-empty p { font-size: 13px; margin-bottom: 6px; }
      .ocr-empty small { font-size: 11px; color: #555; }
    `;
    document.head.appendChild(s);
  }

  // ── B. DOM ───────────────────────────────────────────────────────────────────

  function injectDOM() {
    // Button in the .bar
    const bar = document.querySelector('.bar');
    const sep = document.createElement('span');
    sep.style.color = '#444';
    sep.textContent = '•';
    bar.appendChild(sep);

    const btn = document.createElement('button');
    btn.className = 'ocr-btn';
    btn.id = 'ocr-open';
    btn.textContent = '📷 Scan Menu';
    bar.appendChild(btn);

    // Backdrop
    const overlay = document.createElement('div');
    overlay.id = 'ocr-overlay';
    document.body.appendChild(overlay);

    // Slide-in panel
    const panel = document.createElement('div');
    panel.id = 'ocr-panel';
    panel.innerHTML = `
      <div id="ocr-panel-hdr">
        <h2>📷 Scan Menu</h2>
        <button id="ocr-close" aria-label="Close">×</button>
      </div>
      <div id="ocr-prog-wrap">
        <div id="ocr-prog-bar"><div id="ocr-prog-fill"></div></div>
        <div id="ocr-status"></div>
      </div>
      <div id="ocr-drop">
        <input type="file" id="ocr-file" accept="image/*" capture="environment">
        <span class="drop-icon">🍽️</span>
        <p><strong>Take a photo or tap to upload</strong> a menu image.<br>Items will be matched against the database.</p>
      </div>
      <div id="ocr-results"></div>
    `;
    document.body.appendChild(panel);
  }

  // ── C. PANEL ─────────────────────────────────────────────────────────────────

  function openPanel()  {
    document.getElementById('ocr-panel').classList.add('open');
    document.getElementById('ocr-overlay').classList.add('open');
    document.addEventListener('keydown', onEsc);
  }
  function closePanel() {
    document.getElementById('ocr-panel').classList.remove('open');
    document.getElementById('ocr-overlay').classList.remove('open');
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') closePanel(); }

  // ── D. TESSERACT LAZY LOADER ─────────────────────────────────────────────────

  let _tsLoad = null;
  let _worker = null;

  function loadTesseract() {
    if (_tsLoad) return _tsLoad;
    _tsLoad = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT_CDN;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load Tesseract.js from CDN'));
      document.head.appendChild(s);
    });
    return _tsLoad;
  }

  async function getWorker() {
    if (_worker) return _worker;
    setStatus('Loading OCR engine…');
    await loadTesseract();
    _worker = await Tesseract.createWorker('eng', 1, {
      logger(m) {
        if (m.status === 'loading tesseract core') {
          setProgress(Math.round(m.progress * 15));
          setStatus('Loading OCR engine…');
        } else if (m.status === 'loading language traineddata') {
          setProgress(15 + Math.round(m.progress * 20));
          setStatus('Loading language data…');
        } else if (m.status === 'initializing tesseract') {
          setProgress(35);
          setStatus('Initializing…');
        } else if (m.status === 'recognizing text') {
          setProgress(35 + Math.round(m.progress * 45));
          setStatus('Reading text…');
        }
      }
    });
    return _worker;
  }

  // ── E. PROGRESS ──────────────────────────────────────────────────────────────

  let _hideTimer = null;

  function setProgress(pct) {
    clearTimeout(_hideTimer);
    const wrap = document.getElementById('ocr-prog-wrap');
    const fill = document.getElementById('ocr-prog-fill');
    wrap.classList.add('active');
    fill.style.width = pct + '%';
    if (pct >= 100) {
      _hideTimer = setTimeout(() => {
        wrap.classList.remove('active');
        fill.style.width = '0%';
      }, 700);
    }
  }
  function setStatus(text) { document.getElementById('ocr-status').textContent = text; }
  function clearResults()  { document.getElementById('ocr-results').innerHTML = ''; }

  // ── F. IMAGE RESIZE ──────────────────────────────────────────────────────────

  function resizeImage(file) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, MAX_IMAGE_PX / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale === 1) { resolve(file); return; }
        const c = document.createElement('canvas');
        c.width  = Math.round(img.naturalWidth  * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(blob => resolve(blob || file), 'image/jpeg', 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  // ── G. OCR RUNNER ────────────────────────────────────────────────────────────

  async function runOCR(file) {
    openPanel();
    clearResults();
    setProgress(1);
    try {
      const blob   = await resizeImage(file);
      const worker = await getWorker();
      const imgUrl = URL.createObjectURL(blob);
      const { data: { text } } = await worker.recognize(imgUrl);
      URL.revokeObjectURL(imgUrl);

      setProgress(85);
      setStatus('Matching dishes…');

      const candidates = parseMenuText(text);
      const results    = matchCandidates(candidates);
      setProgress(100);

      if (!text.trim() || text.trim().length < 50) {
        setStatus('Too little text recognized');
      } else if (results.length === 0) {
        setStatus('No matching dishes found');
      } else {
        setStatus(`Found ${results.length} possible match${results.length !== 1 ? 'es' : ''}`);
      }

      renderResults(results, text);
    } catch (err) {
      setStatus('Error: ' + err.message);
      document.getElementById('ocr-results').innerHTML =
        `<div class="ocr-empty"><p style="color:var(--notxt)">${err.message}</p></div>`;
    }
  }

  // ── H. MENU TEXT PARSER ──────────────────────────────────────────────────────

  const PRICE_SUFFIX_RE = /\s*\.{2,}\s*\$?[\d,]+(\.\d{2})?\s*$|\s+\$[\d,]+(\.\d{2})?\s*$|\s+[\d,]+\.\d{2}\s*$/;
  const STANDALONE_PRICE_RE = /^\s*\$?[\d,]+(\.\d{2})?\s*$|^[\d]+\s*[€£¥]\s*$/;
  const FILLER = new Set([
    'our','the','a','an','house','fresh','classic','grilled','sauteed','sautéed',
    'braised','roasted','pan','seared','fried','baked','steamed','poached',
    'slow','cooked','homemade','seasonal','with','and','or','of','in','on'
  ]);

  function stripPriceSuffix(line) { return line.replace(PRICE_SUFFIX_RE, '').trim(); }

  function isTitleCase(str) {
    const words = str.split(/\s+/).filter(w => w.length > 3);
    if (words.length < 2) return false;
    return words.filter(w => /^[A-Z]/.test(w)).length >= Math.ceil(words.length * 0.6);
  }

  function classifyLine(raw) {
    const t = raw.trim();
    if (!t || t.length < 3) return 'noise';
    if (STANDALONE_PRICE_RE.test(t)) return 'price';
    // All-caps section headers
    if (t === t.toUpperCase() && /[A-Z]{3}/.test(t) && t.replace(/\s/g,'').length > 3) return 'header';
    const stripped  = stripPriceSuffix(t);
    const wordCount = stripped.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 8 && isTitleCase(stripped)) return 'item';
    if (t.length > 45 || (t.includes(',') && /[a-z]/.test(t.slice(5)))) return 'desc';
    if (wordCount >= 2 && wordCount <= 8) return 'maybe-item';
    return 'desc';
  }

  function normalizeForMatch(str) {
    return str
      .toLowerCase()
      .split(/\s+/)
      .filter(w => !FILLER.has(w) && w.length > 1)
      .join(' ')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseMenuText(text) {
    const candidates = [];
    let current = null;
    let descCount = 0;

    for (const raw of text.split('\n')) {
      const type = classifyLine(raw);
      if (type === 'noise' || type === 'price' || type === 'header') {
        if (current) { candidates.push(current); current = null; }
        continue;
      }
      if (type === 'item' || type === 'maybe-item') {
        if (current) candidates.push(current);
        const name = stripPriceSuffix(raw.trim());
        current = { rawName: name, normalizedName: normalizeForMatch(name), rawDesc: '' };
        descCount = 0;
        continue;
      }
      // type === 'desc'
      if (current && descCount < 3) {
        current.rawDesc += (current.rawDesc ? ' ' : '') + raw.trim();
        descCount++;
      }
    }
    if (current) candidates.push(current);
    return candidates.filter(c => c.normalizedName.length >= 3);
  }

  // ── I. MATCH ENGINE ──────────────────────────────────────────────────────────

  function tokenSet(str) {
    return new Set((str.match(/\b\w{3,}\b/g) || []).map(w => w.toLowerCase()));
  }

  function bigrams(str) {
    const s = str.toLowerCase().replace(/\s+/g, ' ');
    const out = new Set();
    for (let i = 0; i < s.length - 1; i++) out.add(s[i] + s[i + 1]);
    return out;
  }

  function jaccard(a, b) {
    if (!a.size && !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return inter / (a.size + b.size - inter);
  }

  function bigramSim(s1, s2) {
    const a = bigrams(s1), b = bigrams(s2);
    if (!a.size && !b.size) return 0;
    let shared = 0;
    for (const bg of a) if (b.has(bg)) shared++;
    return (2 * shared) / (a.size + b.size);
  }

  function catBonus(candidate, food) {
    const haystack = (candidate.rawName + ' ' + candidate.rawDesc).toLowerCase();
    for (const kw of (CAT_KEYWORDS[food.cat] || [])) {
      if (haystack.includes(kw)) return 0.1;
    }
    return 0;
  }

  function scoreOne(candidate, food) {
    const cand     = candidate.normalizedName;
    const foodName = normalizeForMatch(food.name);
    const foodFull = (food.name + ' ' + food.cat + ' ' + food.desc).toLowerCase();

    // Signal 1: substring match
    let sub = 0;
    if (cand && foodName && (foodName.includes(cand) || cand.includes(foodName))) {
      sub = 0.9;
    } else if (cand.length >= 5 && foodFull.includes(cand)) {
      sub = 0.5;
    }

    // Signal 2: word Jaccard
    const jScore = jaccard(tokenSet(cand), tokenSet(foodName)) * 0.6;

    // Signal 3: bigram similarity (robust to OCR noise)
    const bgScore = bigramSim(cand, foodName) * 0.3;

    // Signal 4: category keyword hint
    const bonus = catBonus(candidate, food);

    // Penalty: large word-count mismatch
    const penalty = Math.abs(cand.split(/\s+/).length - foodName.split(/\s+/).length) > 3 ? 0.1 : 0;

    return Math.min(1, Math.max(0, sub + jScore + bgScore + bonus - penalty));
  }

  function confidence(score) {
    return score >= 0.7 ? 'Strong' : score >= 0.45 ? 'Likely' : 'Weak';
  }

  function matchCandidates(candidates) {
    const results = [];
    for (const c of candidates) {
      const scored = FOODS
        .map(food => ({ food, score: scoreOne(c, food) }))
        .sort((a, b) => b.score - a.score);
      const best = scored[0];
      if (!best || best.score < MATCH_THRESHOLD) continue;
      results.push({
        candidate: c,
        matches: scored
          .filter(s => s.score >= MATCH_THRESHOLD && s.score >= best.score * 0.85)
          .slice(0, 3)
          .map(s => ({ food: s.food, score: s.score, conf: confidence(s.score) }))
      });
    }
    return results;
  }

  // ── J. RESULTS RENDERER ──────────────────────────────────────────────────────

  function buildMiniRow(food) {
    const isContains = (typeof mode !== 'undefined' && mode === 'contains');
    const cols   = isContains ? INGREDIENTS : RESTRICTIONS;
    const dKey   = isContains ? 'c' : 'r';
    return cols.map(col => {
      const val = (food[dKey] && food[dKey][col.id]) || 'u';
      return `<div class="ocr-cell ${val}" title="${col.label}">${col.icon}</div>`;
    }).join('');
  }

  function renderResults(matchGroups, rawText) {
    const container = document.getElementById('ocr-results');
    container.innerHTML = '';

    if (rawText.trim().length < 50) {
      container.innerHTML = `<div class="ocr-empty">
        <div class="ei">📷</div>
        <p>Not enough text recognized.</p>
        <small>Menus with decorative or script fonts may not scan well.<br>Try a clearer photo, or type the dish name in the search box.</small>
      </div>`;
      return;
    }

    if (matchGroups.length === 0) {
      container.innerHTML = `<div class="ocr-empty">
        <div class="ei">🍽️</div>
        <p>No recognizable dishes found.</p>
        <small>Try a clearer photo or one with less stylized fonts.</small>
      </div>`;
      return;
    }

    for (const { candidate, matches } of matchGroups) {
      const group = document.createElement('div');
      group.className = 'ocr-group';

      const rawLabel = document.createElement('div');
      rawLabel.className = 'ocr-raw';
      rawLabel.textContent = `"${candidate.rawName}"`;
      group.appendChild(rawLabel);

      for (const { food, conf } of matches) {
        const card = document.createElement('div');
        card.className = 'ocr-card';
        card.innerHTML = `
          <div class="ocr-card-hdr">
            <span class="food-name">${food.name}</span>
            <span class="ocr-badge ocr-badge-${conf.toLowerCase()}">${conf}</span>
          </div>
          <span class="food-cat">${food.cat}</span>
          <span class="food-desc">${food.desc}</span>
          <div class="ocr-mini-row">${buildMiniRow(food)}</div>
        `;
        const btn = document.createElement('button');
        btn.className = 'ocr-lookup';
        btn.textContent = 'Look up in table';
        btn.addEventListener('click', () => {
          const input = document.getElementById('searchInput');
          input.value = food.name;
          input.dispatchEvent(new Event('input'));
          closePanel();
          document.querySelector('.table-wrap').scrollIntoView({ behavior: 'smooth' });
        });
        card.appendChild(btn);
        group.appendChild(card);
      }

      container.appendChild(group);
    }
  }

  // ── K. WIRING ────────────────────────────────────────────────────────────────

  function wireEvents() {
    document.getElementById('ocr-open').addEventListener('click', openPanel);
    document.getElementById('ocr-close').addEventListener('click', closePanel);
    document.getElementById('ocr-overlay').addEventListener('click', closePanel);

    const drop  = document.getElementById('ocr-drop');
    const input = document.getElementById('ocr-file');

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) runOCR(f);
      input.value = '';
    });

    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith('image/')) runOCR(f);
    });

    window.addEventListener('beforeunload', () => { if (_worker) _worker.terminate(); });
  }

  // ── INIT ─────────────────────────────────────────────────────────────────────

  injectStyles();
  injectDOM();
  wireEvents();

}());
