/* fm9: "Criar oferta" — botão à direita do mapa que abre o criador de artes promocionais FARMAIS.
   - Modelos: criar/modelos.json + criar/modelos.css (gerados por /workspace/farmais/modelos/exportar_web.py
     a partir de estilo.css e estilos/*; o modelo 22 foi descartado e não entra).
   - A arte é desenhada ao vivo num iframe (criar/render.html + render.js = porta do gerar.py) e exportada
     com html-to-image (PNG) e jsPDF (PDF), ambos em js/vendor/ (sem CDN).
   - Fotos: data/produtos_fotos.json (img/produtos/*.webp) ou "Subir foto" (fica só no navegador).
   - Concorrentes: data/precos_concorrentes.json; ideias: data/ideias_radar.json (criar_dados.py, rotina do radar).
   Atalho: ?criar=1 (opcional &modelo=17). Nada é enviado a servidor. */
(function () {
  "use strict";
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const semAcento = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const brl = v => "R$ " + Number(v).toFixed(2).replace(".", ",");
  const p2 = n => String(n).padStart(2, "0");
  const V = "fm9";
  const FMT_NOME = { quadrado: "Quadrado 1080 (feed)", vertical: "Vertical (stories / status)", a4: "Cartaz A4", folha: "Folha A4 de etiquetas", a6: "Etiqueta A6" };
  const FMT_CURTO = { quadrado: "Quadrado", vertical: "Vertical", a4: "A4", folha: "Folha A4", a6: "A6" };
  const LS = "farmais-criar-oferta-v1";
  const ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="4" width="22" height="24" rx="3.5" fill="currentColor" opacity=".16" stroke="currentColor" stroke-width="2.2"/><path d="M9.5 10h13M9.5 14h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="9" y="18" width="14" height="6.5" rx="2" fill="#DF2110"/><path d="M12 21.3h8" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M26.5 2.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" fill="#DF2110"/></svg>';

  const C = { aberto: false, montado: false, dados: null, M: null, fmt: null, itens: [], validade: "", validadeAte: "", titulo: "", subtitulo: "", faixa: "",
    frame: null, pronto: false, sheetSlot: null, timer: null, ocupado: false };
  window.__CRIAR_OFERTA__ = C;

  /* ---------- botão no mapa ---------- */
  function botao() {
    const b = document.createElement("button");
    b.id = "co-btn"; b.type = "button";
    b.setAttribute("aria-label", "Criar oferta"); b.title = "Criar oferta (arte para postar ou imprimir)";
    b.innerHTML = `<span class="co-btn-ico">${ICON}</span><span class="co-btn-lbl">Criar <br>oferta</span>`;
    ["pointerdown", "wheel", "touchstart", "dblclick"].forEach(t => b.addEventListener(t, ev => ev.stopPropagation(), { passive: true }));
    b.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); abrir(); });
    document.body.appendChild(b);
    const pos = () => {
      const bar = $("#fm-bar");
      const topo = bar ? bar.getBoundingClientRect().top : window.innerHeight - 100;
      b.style.setProperty("--co-bottom", Math.max(90, window.innerHeight - topo + 12) + "px");
    };
    pos(); window.addEventListener("resize", pos); setTimeout(pos, 1500); setTimeout(pos, 5000);
  }

  /* ---------- dados ---------- */
  async function carregar() {
    if (C.dados) return C.dados;
    const t = Date.now();
    const j = (u, fb) => fetch(u).then(r => r.ok ? r.json() : fb).catch(() => fb);
    const [modelos, fotos, precos, ideias] = await Promise.all([
      j("criar/modelos.json?v=" + V + "&t=" + t, { modelos: [], formatos: {} }),
      j("data/produtos_fotos.json?t=" + t, { produtos: [] }),
      j("data/precos_concorrentes.json?t=" + t, { itens: [] }),
      j("data/ideias_radar.json?t=" + t, { ideias: [] })]);
    fotos.produtos.forEach(p => { p._busca = semAcento(p.nome + " " + p.detalhe + " " + (p.busca || "")); });
    precos.itens.forEach(p => { p._t = toks(p.n); });
    C.dados = { modelos: modelos.modelos, formatos: modelos.formatos, fotos: fotos.produtos, precos, ideias };
    return C.dados;
  }

  /* ---------- casamento aproximado de nomes (mesmas regras do criar_dados.py) ---------- */
  const STOP = new Set(["com", "de", "da", "do", "das", "dos", "e", "ou", "para", "o", "a", "os", "as", "em", "no", "na", "kit", "un", "unidades", "ml", "g", "mg", "cada", "generico", "combo", "leve", "pague"]);
  function toks(s) {
    s = semAcento(s).replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2");
    return s.split(/[^a-z0-9]+/).filter(t => t && !STOP.has(t));
  }
  /* palavras genéricas não servem de "marca" (ex.: em "Lenço Baby Free" a marca é Baby Free) */
  const GENERICO = new Set(["lenco", "lencos", "fralda", "fraldas", "sabonete", "desodorante", "creme", "dental", "shampoo", "condicionador", "escova", "protetor", "solar",
    "vitamina", "absorvente", "hidratante", "locao", "oleo", "mascara", "pomada", "gel", "spray", "aerossol", "aerosol", "roll", "on", "sal", "fruta", "agua", "enxaguante",
    "bucal", "liquido", "barra", "pasta", "aparelho", "kit", "suplemento", "comprimidos", "capsulas", "cp", "caps", "infantil", "baby", "original"]);
  const TIPO = new Set(["lenco", "lencos", "fralda", "fraldas", "sabonete", "desodorante", "creme", "shampoo", "condicionador", "escova", "protetor", "vitamina",
    "absorvente", "hidratante", "locao", "oleo", "mascara", "pomada", "enxaguante", "agua", "whey", "creatina", "melatonina"]);
  function bate(t, ct, junto) { return ct.includes(t) || (t.length >= 4 && junto.includes(t)); }
  function concorrentes(nome, detalhe) {
    const q = toks(nome);
    if (!q.length || !C.dados) return [];
    const marca = q.find(t => t.length >= 3 && !/^\d+$/.test(t) && !GENERICO.has(t)) || q.find(t => t.length >= 3 && !/^\d+$/.test(t));
    const tipos = [...new Set(toks(nome + " " + (detalhe || "")).filter(t => TIPO.has(t)))];
    const letras = q.filter(t => t.length === 1 && !/^\d$/.test(t)); // "Vitamina C" não pode virar "Vitamina D3"
    if (!marca) return [];
    const resto = q.filter(t => t !== marca && !/^\d+$/.test(t));
    const medidas = toks(nome + " " + (detalhe || "")).filter(t => /^\d+$/.test(t) && +t >= 5);
    const out = [];
    for (const c of C.dados.precos.itens) {
      const ct = c._t, junto = c._j || (c._j = ct.join(""));
      if (!bate(marca, ct, junto)) continue;
      if (tipos.some(t => !bate(t, ct, junto))) continue;
      if (letras.some(t => !ct.includes(t))) continue;
      const comuns = resto.filter(t => bate(t, ct, junto)).length;
      if (resto.length && comuns === 0) continue;
      if (resto.length >= 3 && comuns / resto.length < 0.34) continue;
      const cm = ct.filter(t => /^\d+$/.test(t) && +t >= 5);
      if (medidas.length && cm.length && !cm.some(t => medidas.includes(t))) continue;
      out.push(c);
    }
    out.sort((a, b) => (b.hoje - a.hoje) || (a.p - b.p));
    return out;
  }
  function linhaConcorrente(it) {
    if (!it.produto) return "";
    const ms = concorrentes(it.produto, it.detalhe);
    if (!ms.length) return `<div class="co-conc nada">sem preço de concorrente</div>`;
    const min = ms.reduce((a, b) => (b.p < a.p ? b : a));
    const quando = min.hoje ? "hoje" : "visto em " + min.d.slice(8, 10) + "/" + min.d.slice(5, 7);
    const outros = ms.length > 1 ? ` · ${ms.length} ofertas parecidas` : "";
    return `<div class="co-conc"><b>Menor preço de concorrente em Foz: ${brl(min.p)}</b> · ${esc(min.f)} · ${quando}${outros}` +
      `<span class="co-conc-n">“${esc(min.n)}”</span></div>`;
  }

  /* ---------- montagem do painel ---------- */
  function montar() {
    const el = document.createElement("div");
    el.id = "co"; el.hidden = true;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Criar oferta");
    el.innerHTML = `
      <div class="co-box">
        <header class="co-top">
          <div class="co-tt"><b>Criar oferta</b><span>Escolha o modelo, os produtos e os preços. A arte sai pronta para postar ou imprimir.</span></div>
          <button type="button" class="co-x" aria-label="Fechar">×</button>
        </header>
        <div class="co-main">
          <section class="co-prev">
            <div class="co-stage"><div class="co-scaler"><iframe title="Prévia da arte" src="criar/render.html?v=${V}"></iframe></div>
              <div class="co-carreg">Carregando modelos…</div></div>
            <div class="co-info" aria-live="polite"></div>
            <div class="co-acoes">
              <button type="button" class="co-b pri" data-acao="png">Baixar PNG</button>
              <button type="button" class="co-b" data-acao="pdf">Baixar PDF</button>
              <button type="button" class="co-b" data-acao="share" hidden>Compartilhar</button>
            </div>
            <div class="co-msg" aria-live="polite"></div>
          </section>
          <section class="co-form">
            <div class="co-step"><h3><span>1</span> Modelo</h3><div class="co-modelos" role="listbox" aria-label="Modelos"></div></div>
            <div class="co-step"><h3><span>2</span> Formato</h3><div class="co-fmts"></div></div>
            <div class="co-step"><h3><span>3</span> Produtos <small class="co-max"></small></h3>
              <button type="button" class="co-b radar" data-acao="radar">Usar ideia do radar</button>
              <div class="co-itens"></div>
              <button type="button" class="co-b add" data-acao="add">+ Adicionar produto</button></div>
            <div class="co-step"><h3><span>4</span> Validade</h3>
              <div class="co-datas"><label>Válido em<input type="date" class="co-dt1"></label><label>até (opcional)<input type="date" class="co-dt2"></label></div>
              <p class="co-dica">Um dia só: “Somente hoje”. Com a data final: “Ofertas válidas de … a …”.</p></div>
            <details class="co-step co-textos"><summary>Textos da arte (opcional)</summary>
              <label>Título<input type="text" class="co-tit" maxlength="40" placeholder="padrão do modelo"></label>
              <label>Subtítulo<input type="text" class="co-sub" maxlength="50" placeholder="padrão do modelo"></label>
              <label>Faixa<input type="text" class="co-fx" maxlength="70" placeholder="automática pela validade"></label></details>
            <p class="co-rodape">Nada é enviado: as fotos que você sobe ficam só neste aparelho. Preços de concorrentes vêm do radar (promoções de hoje e últimos 7 dias).</p>
          </section>
        </div>
      </div>
      <div class="co-sheet" hidden><div class="co-sheet-box"></div></div>
      <button type="button" class="co-ver" hidden>Ver arte ▲</button>`;
    document.body.appendChild(el);
    ["pointerdown", "wheel", "touchstart", "dblclick", "keydown"].forEach(t => el.addEventListener(t, ev => ev.stopPropagation(), { passive: true }));
    C.frame = $("iframe", el);
    $(".co-x", el).addEventListener("click", fechar);
    el.addEventListener("click", ev => { if (ev.target === el) fechar(); });
    el.addEventListener("keydown", ev => {
      if (!C.aberto || ev.key !== "Escape") return;
      if (!$(".co-sheet", el).hidden) fecharSheet(); else fechar();
    });
    el.addEventListener("click", onClick);
    el.addEventListener("input", onInput);
    el.addEventListener("change", onInput);
    window.addEventListener("resize", escalar);
    window.addEventListener("message", ev => { if (ev.origin === location.origin && ev.data && ev.data.coRenderPronto) { C.pronto = true; agendar(0); } });
    C.frame.addEventListener("load", () => { if (C.frame.contentWindow.FARMAIS_ARTE) { C.pronto = true; agendar(0); } });
    const main = $(".co-main", el), ver = $(".co-ver", el);
    main.addEventListener("scroll", () => { ver.hidden = !(window.innerWidth < 900 && main.scrollTop > $(".co-prev", el).offsetHeight); }, { passive: true });
    ver.addEventListener("click", () => main.scrollTo({ top: 0, behavior: "smooth" }));
    try {
      const f = new File([new Blob(["x"], { type: "image/png" })], "x.png", { type: "image/png" });
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) $('[data-acao="share"]', el).hidden = false;
    } catch (e) { /* sem Web Share */ }
    C.montado = true;
  }

  function hojeISO() { const d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function isoParaBR(s) { const m = (s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; }
  function validadeTxt() {
    const a = isoParaBR(C.validade), b = isoParaBR(C.validadeAte);
    if (a && b && b > a && C.validadeAte > C.validade) {
      const [d1, m1, y1] = a.split("/"), [d2, m2, y2] = b.split("/");
      return (y1 === y2 ? `${d1}/${m1}` : a) + " a " + `${d2}/${m2}/${y2}`;
    }
    return a;
  }

  function salvar() {
    try {
      localStorage.setItem(LS, JSON.stringify({ n: C.M && C.M.n, fmt: C.fmt, titulo: C.titulo, subtitulo: C.subtitulo, faixa: C.faixa,
        itens: C.itens.map(i => Object.assign({}, i, { fotos: i.upload ? [] : i.fotos, upload: false, fotoNome: i.upload ? "" : i.fotoNome })) }));
    } catch (e) { /* cheio ou bloqueado */ }
  }
  function restaurar() {
    try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) { return null; }
  }

  async function abrir(opts) {
    opts = opts || {};
    if (!C.montado) montar();
    C.aberto = true;
    document.body.classList.add("co-aberto");
    $("#co").hidden = false;
    const D = await carregar();
    if (!C.M) {
      const salvo = restaurar();
      const pedido = opts.modelo && D.modelos.find(m => m.n === +opts.modelo);
      C.M = pedido || (salvo && D.modelos.find(m => m.n === salvo.n)) || D.modelos.find(m => m.tema === "super-ofertas") || D.modelos[0];
      C.fmt = (!pedido && salvo && C.M.fmts.includes(salvo.fmt)) ? salvo.fmt : C.M.fmts[0];
      C.itens = (salvo && salvo.itens && salvo.itens.length) ? salvo.itens.slice(0, 8) : [novoItem()];
      if (salvo) { C.titulo = salvo.titulo || ""; C.subtitulo = salvo.subtitulo || ""; C.faixa = salvo.faixa || ""; }
      C.validade = hojeISO(); C.validadeAte = "";
      $(".co-dt1").value = C.validade;
      $(".co-tit").value = C.titulo; $(".co-sub").value = C.subtitulo; $(".co-fx").value = C.faixa;
    }
    pintarModelos(); pintarFormatos(); pintarItens();
    escalar(); agendar(0);
    setTimeout(() => { // centraliza o modelo escolhido na faixa sem rolar a janela
      const s = $(".co-modelos .sel"), f = $(".co-modelos");
      if (s && f) f.scrollLeft = s.offsetLeft - f.offsetLeft - (f.clientWidth - s.offsetWidth) / 2;
      $(".co-main").scrollTop = 0;
    }, 50);
  }
  function fechar() {
    C.aberto = false;
    fecharSheet();
    $("#co").hidden = true;
    document.body.classList.remove("co-aberto");
    const b = $("#co-btn"); if (b) b.focus({ preventScroll: true });
  }

  function novoItem() { return { id: null, produto: "", detalhe: "", por: "", de: "", levando_2: false, fotos: [], fotoNome: "", upload: false, dica: "" }; }
  function maxItens() { return C.fmt === "a6" ? 1 : C.M.maxp; }

  function pintarModelos() {
    const D = C.dados;
    $(".co-modelos").innerHTML = D.modelos.map(m => `<button type="button" class="co-mod${m.n === C.M.n ? " sel" : ""}" data-n="${m.n}" role="option" aria-selected="${m.n === C.M.n}" title="${p2(m.n)} · ${esc(m.titulo)}">
      <span class="co-mod-img">${m.thumb ? `<img loading="lazy" src="criar/${esc(m.thumb)}?v=${V}" alt="">` : ""}</span>
      <span class="co-mod-n">${p2(m.n)}</span><span class="co-mod-t">${esc(m.titulo)}</span></button>`).join("");
  }
  function pintarFormatos() {
    $(".co-fmts").innerHTML = C.M.fmts.map(f => `<button type="button" class="co-chip${f === C.fmt ? " sel" : ""}" data-fmt="${f}" aria-pressed="${f === C.fmt}">${esc(FMT_NOME[f] || f)}</button>`).join("");
    const mx = maxItens();
    $(".co-max").textContent = mx === 1 ? "(1 produto neste modelo)" : `(1 a ${mx})`;
  }
  function pintarItens() {
    const mx = maxItens();
    $(".co-itens").innerHTML = C.itens.map((it, i) => {
      const fora = i >= mx;
      const foto = it.fotos[0];
      return `<div class="co-item${fora ? " fora" : ""}" data-i="${i}">
        <div class="co-item-top"><span class="co-num">${i + 1}</span>
          <button type="button" class="co-foto" data-acao="foto" aria-label="Escolher foto">${foto ? `<img src="${esc(foto)}" alt="">` : "<span>escolher<br>foto</span>"}</button>
          <div class="co-item-campos">
            <input type="text" class="co-in" data-k="produto" value="${esc(it.produto)}" placeholder="Nome do produto" maxlength="60" aria-label="Nome do produto">
            <input type="text" class="co-in fino" data-k="detalhe" value="${esc(it.detalhe)}" placeholder="Detalhe (ex.: 36 comprimidos)" maxlength="70" aria-label="Detalhe">
          </div>
          <button type="button" class="co-rm" data-acao="rm" aria-label="Tirar produto ${i + 1}" title="Tirar">×</button></div>
        <div class="co-precos">
          <label class="por"><span>Por R$</span><input type="text" inputmode="decimal" class="co-in" data-k="por" value="${esc(it.por)}" placeholder="${it.dica ? "radar: " + esc(it.dica) : "ex.: 19,90"}" maxlength="9"></label>
          <label><span>De R$ <small>(opcional)</small></span><input type="text" inputmode="decimal" class="co-in" data-k="de" value="${esc(it.de)}" placeholder="ex.: 25,90" maxlength="9"></label>
          <label class="co-l2"><input type="checkbox" data-k="levando_2" ${it.levando_2 ? "checked" : ""}> Levando 2 ou mais</label>
        </div>
        ${it.dica ? `<div class="co-dica-radar">O radar citou R$ ${esc(it.dica)} (referência, não é o seu preço). Confirme o valor.</div>` : ""}
        <div class="co-conc-wrap">${linhaConcorrente(it)}</div>
        ${fora ? `<div class="co-fora">Este modelo usa só ${mx} produto${mx > 1 ? "s" : ""}; este fica de fora.</div>` : ""}
      </div>`;
    }).join("");
    $('[data-acao="add"]').hidden = C.itens.length >= Math.max(mx, 1) || C.itens.length >= 8;
  }

  /* ---------- prévia ---------- */
  function estado() {
    const mx = maxItens();
    return { modelo: C.M, fmt: C.fmt, validade: validadeTxt(), titulo: C.titulo, subtitulo: C.subtitulo, faixa: C.faixa,
      itens: C.itens.slice(0, mx).map(i => ({ produto: i.produto || "Produto", detalhe: i.detalhe, por: i.por, de: i.de, levando_2: i.levando_2,
        fotos: i.fotos.map(u => /^(data:|blob:)/.test(u) ? u : "../" + u) })) };
  }
  function view() { const F = C.dados.formatos[C.fmt]; return { w: F.view[0], h: F.view[1], dsf: F.dsf, page_mm: F.page_mm }; }
  function escalar() {
    if (!C.aberto || !C.dados || !C.M) return;
    const F = view(), stage = $(".co-stage"), sc = $(".co-scaler");
    const larg = stage.clientWidth || 300;
    const alt = window.innerWidth < 900 ? Math.min(window.innerHeight * 0.56, 640) : Math.max(260, window.innerHeight - 250);
    const s = Math.min(larg / F.w, alt / F.h);
    C.frame.style.width = F.w + "px"; C.frame.style.height = F.h + "px";
    sc.style.transform = `scale(${s})`;
    sc.style.width = F.w + "px"; sc.style.height = F.h + "px";
    stage.style.height = Math.round(F.h * s) + "px";
    sc.style.left = Math.max(0, Math.round((larg - F.w * s) / 2)) + "px";
  }
  function agendar(ms) {
    clearTimeout(C.timer);
    C.timer = setTimeout(desenhar, ms == null ? 180 : ms);
  }
  async function desenhar() {
    if (!C.aberto || !C.M) return;
    const A = C.frame.contentWindow && C.frame.contentWindow.FARMAIS_ARTE;
    if (!A) return agendar(300); // iframe ainda carregando
    C.pronto = true;
    escalar();
    await A.render(estado());
    $(".co-carreg").hidden = true;
    const F = view();
    const px = `${Math.round(F.w * F.dsf)}×${Math.round(F.h * F.dsf)} px`;
    $(".co-info").innerHTML = `<b>${p2(C.M.n)} · ${esc(C.M.titulo)}</b> · ${esc(FMT_CURTO[C.fmt] || C.fmt)} · ${px}${F.page_mm ? ` · PDF ${F.page_mm[0]}×${F.page_mm[1]} mm` : ""}`;
    salvar();
  }

  /* ---------- eventos ---------- */
  function onInput(ev) {
    const t = ev.target;
    if (t.classList.contains("co-dt1")) { C.validade = t.value; return agendar(); }
    if (t.classList.contains("co-dt2")) { C.validadeAte = t.value; return agendar(); }
    if (t.classList.contains("co-tit")) { C.titulo = t.value; return agendar(); }
    if (t.classList.contains("co-sub")) { C.subtitulo = t.value; return agendar(); }
    if (t.classList.contains("co-fx")) { C.faixa = t.value; return agendar(); }
    if (t.classList.contains("co-busca")) { if (ev.type === "input") pintarCatalogo(t.value); return; }
    if (t.classList.contains("co-upload") && ev.type === "change") return subirFoto(t);
    const box = t.closest(".co-item");
    if (box && t.dataset.k) {
      const it = C.itens[+box.dataset.i];
      if (t.type === "checkbox") it.levando_2 = t.checked;
      else it[t.dataset.k] = t.value;
      if (t.dataset.k === "por" || t.dataset.k === "de") {
        const ok = !t.value || (C.frame.contentWindow.FARMAIS_ARTE && C.frame.contentWindow.FARMAIS_ARTE.parsePreco(t.value));
        t.classList.toggle("erro", !ok);
      }
      if ((t.dataset.k === "produto" || t.dataset.k === "detalhe") && ev.type === "input") $(".co-conc-wrap", box).innerHTML = linhaConcorrente(it);
      agendar();
    }
  }
  function onClick(ev) {
    const b = ev.target.closest("button,[data-acao]");
    if (!b) return;
    const box = b.closest(".co-item");
    if (b.classList.contains("co-mod")) {
      const m = C.dados.modelos.find(x => x.n === +b.dataset.n);
      if (!m || m === C.M) return;
      C.M = m;
      if (!m.fmts.includes(C.fmt)) C.fmt = m.fmts[0];
      $$(".co-mod").forEach(x => { x.classList.toggle("sel", x === b); x.setAttribute("aria-selected", x === b); });
      pintarFormatos(); pintarItens(); escalar(); agendar(0);
      return;
    }
    if (b.dataset.fmt) { C.fmt = b.dataset.fmt; pintarFormatos(); pintarItens(); escalar(); agendar(0); return; }
    const a = b.dataset.acao;
    if (a === "add") { if (C.itens.length < Math.min(maxItens(), 8)) { C.itens.push(novoItem()); pintarItens(); agendar(); abrirCatalogo(C.itens.length - 1); } return; }
    if (a === "rm" && box) { C.itens.splice(+box.dataset.i, 1); if (!C.itens.length) C.itens.push(novoItem()); pintarItens(); agendar(); return; }
    if (a === "foto" && box) return abrirCatalogo(+box.dataset.i);
    if (a === "radar") return abrirRadar();
    if (a === "png" || a === "pdf" || a === "share") return exportar(a);
    if (a === "fechar-sheet") return fecharSheet();
    if (a === "pick") return escolherCatalogo(b.dataset.id);
    if (a === "semfoto") { const it = C.itens[C.sheetSlot]; if (it) { it.fotos = []; it.upload = false; it.fotoNome = ""; } fecharSheet(); pintarItens(); agendar(); return; }
    if (a === "usar-ideia") return usarIdeia(+b.dataset.k);
  }

  /* ---------- catálogo de fotos ---------- */
  function abrirSheet(html) {
    const sh = $(".co-sheet");
    $(".co-sheet-box", sh).innerHTML = html;
    sh.hidden = false;
  }
  function fecharSheet() { const sh = $("#co .co-sheet"); if (sh) sh.hidden = true; C.sheetSlot = null; }
  function abrirCatalogo(i) {
    C.sheetSlot = i;
    const it = C.itens[i];
    abrirSheet(`<header class="co-sh-top"><b>Foto do produto ${i + 1}</b><button type="button" class="co-x" data-acao="fechar-sheet" aria-label="Fechar">×</button></header>
      <div class="co-sh-tools">
        <input type="search" class="co-in co-busca" placeholder="Buscar pelo nome (ex.: dorflex, protetor, fralda)" value="${esc(it && it.id ? "" : (it && it.produto) || "")}" aria-label="Buscar produto">
        <label class="co-b up">Subir foto<input type="file" class="co-upload" accept="image/*" hidden></label>
      </div>
      <label class="co-fundo"><input type="checkbox" class="co-tirafundo" checked> Tirar fundo branco da foto enviada</label>
      <div class="co-cat" role="list"></div>
      <div class="co-sh-pe"><span class="co-cat-n"></span><button type="button" class="co-b" data-acao="semfoto">Sem foto</button></div>`);
    pintarCatalogo($(".co-busca").value);
    if (window.innerWidth >= 900) setTimeout(() => $(".co-busca") && $(".co-busca").focus(), 30);
  }
  function pintarCatalogo(q) {
    const t = semAcento(q).split(/\s+/).filter(Boolean);
    const lista = C.dados.fotos.filter(p => t.every(w => p._busca.includes(w)));
    $(".co-cat").innerHTML = lista.map(p => `<button type="button" class="co-cat-it" data-acao="pick" data-id="${esc(p.id)}" role="listitem">
      <span class="co-cat-img"><img loading="lazy" src="${esc(p.arquivo)}" alt=""></span><b>${esc(p.nome)}</b><small>${esc(p.detalhe)}</small></button>`).join("") ||
      `<p class="co-vazio">Nenhuma foto com “${esc(q)}”. Use “Subir foto” para mandar uma do celular.</p>`;
    $(".co-cat-n").textContent = `${lista.length} de ${C.dados.fotos.length} fotos`;
  }
  function escolherCatalogo(id) {
    const p = C.dados.fotos.find(x => x.id === id), it = C.itens[C.sheetSlot];
    if (!p || !it) return;
    const trocouProduto = it.id !== p.id;
    it.id = p.id; it.fotos = [p.arquivo]; it.fotoNome = p.nome; it.upload = false;
    if (trocouProduto || !it.produto) { it.produto = p.nome; it.detalhe = p.detalhe; }
    fecharSheet(); pintarItens(); agendar(0);
  }
  function subirFoto(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    const tira = $(".co-tirafundo") ? $(".co-tirafundo").checked : true;
    const slot = C.sheetSlot;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      const max = 900, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d"); ctx.drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let out = cv;
      if (tira) { try { out = tirarFundo(cv); } catch (e) { out = cv; } }
      const it = C.itens[slot];
      if (!it) return;
      it.fotos = [out.toDataURL("image/png")]; it.upload = true; it.id = null; it.fotoNome = f.name;
      fecharSheet(); pintarItens(); agendar(0);
    };
    im.onerror = () => { URL.revokeObjectURL(url); alert("Não consegui abrir essa imagem. Tente uma foto JPG ou PNG."); };
    im.src = url;
  }
  /* fundo branco ligado às bordas vira transparente (mesma ideia do _flood_branco do gerar.py) e recorta as sobras */
  function tirarFundo(cv) {
    const w = cv.width, h = cv.height, ctx = cv.getContext("2d");
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    const branco = i => d[i + 3] > 0 && d[i] > 236 && d[i + 1] > 236 && d[i + 2] > 236;
    // só tira se as bordas forem majoritariamente brancas
    let nb = 0, tot = 0;
    for (let x = 0; x < w; x += 4) { tot += 2; if (branco((x) * 4)) nb++; if (branco(((h - 1) * w + x) * 4)) nb++; }
    for (let y = 0; y < h; y += 4) { tot += 2; if (branco((y * w) * 4)) nb++; if (branco((y * w + w - 1) * 4)) nb++; }
    if (nb / tot < 0.6) return cv;
    const vis = new Uint8Array(w * h), pilha = [];
    for (let x = 0; x < w; x++) { pilha.push(x, (h - 1) * w + x); }
    for (let y = 0; y < h; y++) { pilha.push(y * w, y * w + w - 1); }
    while (pilha.length) {
      const p = pilha.pop();
      if (vis[p]) continue;
      vis[p] = 1;
      if (!branco(p * 4)) continue;
      d[p * 4 + 3] = 0;
      const x = p % w, y = (p / w) | 0;
      if (x > 0) pilha.push(p - 1); if (x < w - 1) pilha.push(p + 1);
      if (y > 0) pilha.push(p - w); if (y < h - 1) pilha.push(p + w);
    }
    // suaviza a borda: pixels quase brancos vizinhos do transparente ficam semitransparentes
    for (let p = 0; p < w * h; p++) {
      if (d[p * 4 + 3] === 0) continue;
      const x = p % w, y = (p / w) | 0;
      const viz = (x > 0 && d[(p - 1) * 4 + 3] === 0) || (x < w - 1 && d[(p + 1) * 4 + 3] === 0) || (y > 0 && d[(p - w) * 4 + 3] === 0) || (y < h - 1 && d[(p + w) * 4 + 3] === 0);
      if (viz) { const m = Math.min(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); if (m > 210) d[p * 4 + 3] = Math.round(255 * (255 - m) / 45); }
    }
    ctx.putImageData(img, 0, 0);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) return cv;
    const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext("2d").drawImage(cv, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o;
  }

  /* ---------- ideias do radar ---------- */
  function abrirRadar() {
    const R = C.dados.ideias || {};
    const ideias = R.ideias || [];
    const foto = id => { const p = C.dados.fotos.find(x => x.id === id); return p ? `<img src="${esc(p.arquivo)}" alt="">` : ""; };
    abrirSheet(`<header class="co-sh-top"><b>Ideias do radar</b><button type="button" class="co-x" data-acao="fechar-sheet" aria-label="Fechar">×</button></header>
      <p class="co-sh-sub">${esc(R.titulo || "Sem relatório do radar")}${R.relatorio ? ` · ${esc(R.relatorio)}` : ""}</p>
      <div class="co-ideias">${ideias.map((d, k) => `<div class="co-ideia">
        <p>${k + 1}. ${esc(d.texto)}</p>
        ${d.itens.length ? `<div class="co-ideia-its">${d.itens.map(i => `<span class="co-tag">${foto(i.foto_id)}${esc(i.nome)}${i.valor_citado ? ` <small>· citado R$ ${esc(i.valor_citado)}</small>` : ""}</span>`).join("")}</div>
        <button type="button" class="co-b pri" data-acao="usar-ideia" data-k="${k}">Usar esta ideia</button>` : `<small class="co-vazio">Nenhum produto identificado nesta ideia.</small>`}
      </div>`).join("") || `<p class="co-vazio">Ainda não há ideias do radar.</p>`}</div>
      <p class="co-dica">Os produtos entram sem preço: o valor citado no radar é só referência (preço de concorrente ou sugestão). Confira antes de publicar.</p>`);
  }
  function usarIdeia(k) {
    const d = (C.dados.ideias.ideias || [])[k];
    if (!d) return;
    const mx = Math.max(1, Math.min(maxItens(), 4));
    C.itens = d.itens.slice(0, mx).map(i => {
      const p = i.foto_id && C.dados.fotos.find(x => x.id === i.foto_id);
      const nome = i.nome.charAt(0).toUpperCase() + i.nome.slice(1);
      return Object.assign(novoItem(), p ? { id: p.id, produto: p.nome, detalhe: p.detalhe, fotos: [p.arquivo], fotoNome: p.nome } : { produto: nome },
        { dica: i.valor_citado || "" });
    });
    if (!C.itens.length) C.itens = [novoItem()];
    fecharSheet(); pintarItens(); agendar(0);
    msg(`Ideia ${k + 1} aplicada. Digite os preços${C.itens.some(i => !i.fotos.length) ? " e escolha as fotos que faltam" : ""}.`);
  }

  /* ---------- exportação ---------- */
  function msg(t, erro) { const m = $(".co-msg"); m.textContent = t || ""; m.classList.toggle("erro", !!erro); }
  function validar() {
    const A = C.frame.contentWindow.FARMAIS_ARTE;
    const its = C.itens.slice(0, maxItens());
    for (let i = 0; i < its.length; i++) {
      if (!its[i].produto.trim()) return `Falta o nome do produto ${i + 1}.`;
      if (!A.parsePreco(its[i].por)) return `Falta o preço “por” do produto ${i + 1} (ex.: 19,90).`;
      if (its[i].de && !A.parsePreco(its[i].de)) return `O preço “de” do produto ${i + 1} não é um valor (ex.: 25,90).`;
    }
    return "";
  }
  function nomeArquivo(ext) {
    const d = C.validade ? C.validade.slice(8, 10) + C.validade.slice(5, 7) : "";
    return `farmais_${p2(C.M.n)}-${C.M.tema}_${C.fmt}${d ? "_" + d : ""}.${ext}`;
  }
  function baixar(blob, nome) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  let jspdfP = null;
  function carregarJsPDF() {
    if (window.jspdf) return Promise.resolve(window.jspdf);
    if (!jspdfP) jspdfP = new Promise((ok, err) => {
      const s = document.createElement("script"); s.src = "js/vendor/jspdf.umd.min.js?v=" + V;
      s.onload = () => ok(window.jspdf); s.onerror = () => { jspdfP = null; err(new Error("jsPDF")); };
      document.head.appendChild(s);
    });
    return jspdfP;
  }
  async function exportar(tipo) {
    if (C.ocupado) return;
    const erro = validar();
    if (erro) { msg(erro, true); return; }
    const semFoto = C.itens.slice(0, maxItens()).findIndex(i => !i.fotos.length);
    C.ocupado = true;
    const bts = $$(".co-acoes .co-b"); bts.forEach(b => b.disabled = true);
    msg(tipo === "pdf" ? "Gerando o PDF…" : "Gerando a imagem…");
    try {
      clearTimeout(C.timer);
      const A = C.frame.contentWindow.FARMAIS_ARTE;
      await A.render(estado());
      const F = view();
      const cv = await A.exportar(F);
      if (tipo === "pdf") {
        const { jsPDF } = await carregarJsPDF();
        let pw, ph, un;
        if (F.page_mm) { pw = F.page_mm[0]; ph = F.page_mm[1]; un = "mm"; }
        else { pw = cv.width / 300 * 72; ph = cv.height / 300 * 72; un = "pt"; }
        const doc = new jsPDF({ orientation: pw > ph ? "landscape" : "portrait", unit: un, format: [pw, ph], compress: true });
        doc.setProperties({ title: nomeArquivo("pdf").replace(/\.pdf$/, ""), author: "FARMAIS Foz do Iguaçu", creator: "Criar oferta — mapa FARMAIS" });
        doc.addImage(cv.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, pw, ph, undefined, "FAST");
        baixar(doc.output("blob"), nomeArquivo("pdf"));
        msg(`PDF pronto: ${nomeArquivo("pdf")}${F.page_mm ? ` (${F.page_mm[0]}×${F.page_mm[1]} mm)` : ""}.`);
      } else {
        const blob = await new Promise(ok => cv.toBlob(ok, "image/png"));
        if (tipo === "share") {
          const file = new File([blob], nomeArquivo("png"), { type: "image/png" });
          try { await navigator.share({ files: [file], title: "Oferta FARMAIS" }); msg("Arte compartilhada."); }
          catch (e) { if (e && e.name !== "AbortError") { baixar(blob, nomeArquivo("png")); msg("Não deu para compartilhar; a imagem foi baixada."); } else msg(""); }
        } else {
          baixar(blob, nomeArquivo("png"));
          msg(`Imagem pronta: ${nomeArquivo("png")} (${cv.width}×${cv.height} px).`);
        }
      }
      if (semFoto >= 0) msg($(".co-msg").textContent + ` Atenção: o produto ${semFoto + 1} está sem foto.`);
    } catch (e) {
      console.error(e);
      msg("Não consegui gerar o arquivo neste aparelho. Tente de novo ou use outro navegador.", true);
    } finally {
      C.ocupado = false; bts.forEach(b => b.disabled = false);
    }
  }

  /* ---------- início ---------- */
  function iniciar() {
    botao();
    const q = new URLSearchParams(location.search);
    if (q.get("criar") === "1" || q.get("painel") === "criar") abrir({ modelo: q.get("modelo") });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
