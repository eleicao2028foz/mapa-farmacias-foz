/* Porta para o navegador de pagina()/titulos()/faixa_e_rodape() de /workspace/farmais/modelos/gerar.py.
   Mantenha as duas versões iguais: o HTML gerado aqui usa as mesmas classes do estilo.css. */
(function () {
  "use strict";
  const DIAS = ["SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO", "DOMINGO"];
  const LOGO = "logo.png";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nb = t => esc(t || "").replace(/(\d) (g|ml|un|mg|UI|unidades?|cápsulas?|comprimidos?)(?![\wÀ-ú])/gi, "$1&nbsp;$2");
  const p2 = n => String(n).padStart(2, "0");
  const ddmmyyyy = d => p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear();
  const wd = d => (d.getDay() + 6) % 7; // segunda = 0, como no Python

  function parsePreco(s) {
    s = String(s || "").trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
    if (!s) return null;
    let m = s.match(/^(\d+)(?:[.,](\d{1,2}))?$/);
    if (!m) { m = s.match(/^(\d{1,3}(?:\.\d{3})+),(\d{1,2})$/); if (m) m = [m[0], m[1].replace(/\./g, ""), m[2]]; }
    if (!m) return null;
    return [String(parseInt(m[1], 10)), (m[2] || "00").padEnd(2, "0")];
  }
  function parseData(s) {
    s = String(s || "").trim();
    if (!s) return [null, ""];
    if (/\s+a\s+/i.test(s)) return [null, s];
    const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (m) {
      let y = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
      if (y < 100) y += 2000;
      const d = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
      if (!isNaN(d)) return [d, ddmmyyyy(d)];
    }
    return [null, s];
  }

  function titulos(tema, M, dt, titulo, subtitulo) {
    const dia = dt ? String(dt.getDate()) : "";
    const ddmm = dt ? p2(dt.getDate()) + "." + p2(dt.getMonth() + 1) : "";
    titulo = (titulo || "").trim(); subtitulo = (subtitulo || "").trim();
    const T = esc(titulo), S = esc(subtitulo);
    switch (tema) {
      case "sexta-feira": return [T || ("SEXTA-FEIRA <b>" + dia + "</b>").replace(" <b></b>", ""), titulo ? "" : "DA SORTE", S || "ESQUENTA BLACK FRIDAY FARMAIS"];
      case "esquenta": return [T || "ESQUENTA", "", S || "BLACK FRIDAY FARMAIS"];
      case "black-friday": return [T || "BLACK <b>FRIDAY</b>", "", S || (ddmm ? "SUPER OFERTAS " + ddmm : "SUPER OFERTAS")];
      case "super-ofertas": return [T || "SUPER OFERTAS", "", S || (ddmm || "ESPECIAL")];
      case "hero": return [T || "OFERTA DESTAQUE", "", S || "IMPERDÍVEL"];
      case "grade-6": return [T || "SUPER OFERTAS", "", S || "SEIS DESTAQUES"];
      case "cartaz": return [T || "SUPER OFERTAS", "", S || "FARMAIS"];
      case "oferta-do-dia": return [T || "FARMAIS", "", S || "OFERTA DO DIA"];
      case "dermo": return [T || "DERMO &amp; BELEZA", "", S || "CUIDADOS PREMIUM"];
      case "bebe": return [T || "DIA DO BEBÊ", "", S || "CUIDADOS PARA O BABY"];
      case "leve-2": return [T || "LEVE 2", "", S || "PAGUE MENOS"];
      case "natal": return [T || "FESTAS NA FARMAIS", "", S || "OFERTAS DE NATAL"];
      case "convenio": return [T || "CONVÊNIO EMPRESAS", "", S || "CONDIÇÕES ESPECIAIS"];
      case "etiqueta": return [T || "FARMAIS", "", S || ""];
    }
    if (M && (M.t1 || M.t2)) return [T || M.t1 || "SUPER OFERTAS", M.t13 || "", S || M.t2 || ""];
    return [T || "SUPER OFERTAS", "", S || ""];
  }

  function faixaERodape(dt, vtxt, faixa, tema) {
    faixa = (faixa || "").trim();
    const periodo = /\s+a\s+/i.test(vtxt || "");
    const dstr = dt ? ddmmyyyy(dt) : "";
    let rib;
    if (faixa) rib = faixa;
    else if (tema === "convenio") rib = "APRESENTE O CONVÊNIO NA LOJA";
    else if (tema === "leve-2") rib = dt ? `★ LEVE 2 OU MAIS – ${DIAS[wd(dt)]}, ${dstr} ★` : "★ LEVE 2 OU MAIS E PAGUE MENOS ★";
    else if (tema === "bebe") rib = dt ? `★ DIA DO BEBÊ – ${DIAS[wd(dt)]}, ${dstr} ★` : (vtxt ? `★ DIA DO BEBÊ – ${vtxt} ★` : "★ DIA DO BEBÊ ★");
    else if (tema === "natal") {
      if (periodo) rib = `★ OFERTAS DE NATAL – ${vtxt.toUpperCase()} ★`;
      else if (vtxt || dt) rib = `★ OFERTAS DE NATAL – VÁLIDAS ATÉ ${dt ? dstr : vtxt} ★`;
      else rib = "★ OFERTAS DE NATAL ★";
    }
    else if (periodo) rib = `★ OFERTAS VÁLIDAS DE ${vtxt.toUpperCase()} ★`;
    else if (dt) rib = `★ SOMENTE HOJE – ${DIAS[wd(dt)]}, ${dstr} ★`;
    else if (vtxt) rib = `★ SOMENTE HOJE – ${vtxt} ★`;
    else rib = "★ SOMENTE HOJE ★";
    let ftr;
    if (tema === "convenio") {
      ftr = "Condições especiais mediante apresentação do convênio. Imagens meramente ilustrativas.";
      if (dt || vtxt) ftr = `Ofertas para conveniados, válidas até ${dt ? dstr : vtxt}, ou enquanto durarem os estoques. Imagens meramente ilustrativas.`;
    } else if (periodo) ftr = `Ofertas válidas de ${vtxt}, ou enquanto durarem os estoques. Imagens meramente ilustrativas.`;
    else if (dt) ftr = `Ofertas válidas somente hoje, ${dstr}, ou enquanto durarem os estoques. Imagens meramente ilustrativas.`;
    else if (vtxt) ftr = `Ofertas válidas somente hoje, ${vtxt}, ou enquanto durarem os estoques. Imagens meramente ilustrativas.`;
    else ftr = "Ofertas válidas somente hoje, ou enquanto durarem os estoques. Imagens meramente ilustrativas.";
    return [rib, ftr];
  }

  const PH = ["--", "--"]; // preço ainda não digitado (a exportação é bloqueada antes)
  const priceTag = (n, cls) => `<div class="tag ${cls || ""}"><span class="por">POR</span><span class="rs">R$</span><span class="int">${esc(n[0])}</span><span class="dec">,${esc(n[1])}</span></div>`;
  const imgsH = fotos => fotos.map(u => `<img src="${esc(u)}" alt="">`).join("");
  const oldH = (p, cls) => p.de ? `<div class="${cls}">de <s>R$ ${esc(p.de[0])},${esc(p.de[1])}</s></div>` : "";

  function cardHtml(p) {
    const det = nb(p.detalhe || "");
    const fotos = p.fotos;
    const lay = fotos.length >= 2 ? "samepair" : "single";
    const duo = fotos.length >= 2 ? " duo" : "";
    const l2 = p.levando_2 ? '<div class="l2">LEVANDO 2 OU MAIS</div>' : "";
    const cada = (fotos.length >= 2 || p.cada) ? '<div class="cada">cada</div>' : "";
    return `<div class="card"><div class="ttl"><div class="brand">${nb(p.produto)}</div>${det ? `<div class="prod">${det}</div>` : ""}</div>` +
      `<div class="body ${lay}"><div class="imgbox${duo}">${imgsH(fotos)}</div>` +
      `<div class="pb">${l2}${oldH(p, "old")}${priceTag(p.por || PH)}${cada}</div></div></div>`;
  }
  function heroHtml(p) {
    const det = nb(p.detalhe || "");
    const l2 = p.levando_2 ? '<div class="l2">LEVANDO 2 OU MAIS</div>' : "";
    const cada = (p.fotos.length >= 2 || p.levando_2 || p.cada) ? '<div class="cada">cada</div>' : "";
    return `<div class="hero-stage"><div class="himg">${imgsH(p.fotos)}</div>` +
      `<div class="hname"><div class="hbrand">${nb(p.produto)}</div>${det ? `<div class="hprod">${det}</div>` : ""}</div>` +
      `<div class="hpb">${l2}${oldH(p, "old")}${priceTag(p.por || PH)}${cada}</div></div>`;
  }
  function etiquetaHtml(p, vtxt) {
    const det = nb(p.detalhe || "");
    const duo = p.fotos.length >= 2 ? " duo" : "";
    const l2 = p.levando_2 ? '<div class="el2">LEVANDO 2 OU MAIS</div>' : "";
    const n = p.por || PH;
    const tag = `<div class="etag"><span class="por">POR</span><span class="rs">R$</span><span class="int">${esc(n[0])}</span><span class="dec">,${esc(n[1])}</span></div>`;
    const val = vtxt ? `<div class="eval">Válido em ${esc(vtxt)} · FARMAIS Foz do Iguaçu</div>` : '<div class="eval">FARMAIS · Foz do Iguaçu</div>';
    return `<div class="etiqueta"><div class="ecorte">recorte</div><div class="elogo"><img src="${LOGO}" alt=""></div>` +
      `<div class="ebrand">${nb(p.produto)}</div>${det ? `<div class="eprod">${det}</div>` : ""}` +
      `<div class="ebody"><div class="eimg${duo}">${imgsH(p.fotos)}</div><div class="eprice">${l2}${oldH(p, "eold")}${tag}</div></div>${val}</div>`;
  }

  /* estado: {modelo:{tema,classe,layout,maxp,t1,t13,t2,preco_gigante,barcode}, fmt, validade, titulo, subtitulo, faixa,
              itens:[{produto, detalhe, por:"19,90", de:"", levando_2, fotos:[url]}]} */
  function montar(S) {
    const M = S.modelo, fmt = S.fmt, tema = M.tema;
    const produtos = S.itens.map(i => ({ produto: i.produto || "", detalhe: i.detalhe || "", por: parsePreco(i.por), de: parsePreco(i.de),
      levando_2: !!i.levando_2, cada: !!i.cada, fotos: (i.fotos || []).filter(Boolean) }));
    const [dt, vtxt0] = parseData(S.validade);
    const vtxt = vtxt0 || (dt ? ddmmyyyy(dt) : "");
    const [t1, t13, t2] = titulos(tema, M, dt, S.titulo, S.subtitulo);
    let [rib, ftr] = faixaERodape(dt, vtxt0, S.faixa, tema);
    const n = produtos.length;
    document.body.className = fmt + " " + M.classe;
    const wrap = document.querySelector(".wrap");
    if (M.layout === "etiqueta" && (fmt === "folha" || fmt === "a6")) {
      if (fmt === "a6") { wrap.innerHTML = n ? etiquetaHtml(produtos[0], vtxt) : ""; return; }
      wrap.innerHTML = `<div class="folha-grid n${n}">${produtos.map(p => etiquetaHtml(p, vtxt)).join("")}</div>` +
        `<div class="ftr-folha">Imprima em A4, recorte nas linhas tracejadas e cole na gôndola. ${esc(ftr)}</div>`;
      return;
    }
    if (fmt === "a4" && ftr.indexOf("Foz do Iguaçu") < 0) ftr = ftr.replace(/\.+$/, "") + ". Lojas FARMAIS · Foz do Iguaçu.";
    let extras = "";
    if (M.preco_gigante && n) {
      const pp = produtos[0].por || PH;
      extras += `<div class="preco-gigante" aria-hidden="true"><span class="rs">R$</span><span class="int">${esc(pp[0])}</span><span class="dec">,${esc(pp[1])}</span></div>`;
    }
    if (M.barcode) extras += '<div class="barcode" aria-hidden="true"></div>';
    const hdr = `<div class="hdr"><div class="logo"><img src="${LOGO}" alt=""></div><div class="tit"><div class="t1">${t1}</div>` +
      `${t13 ? `<div class="t13">${t13}</div>` : ""}${t2 ? `<div class="t2">${t2}</div>` : ""}</div></div>`;
    const ribTxt = esc(rib.replace(/^[★\s]+|[★\s]+$/g, ""));
    const ribH = `<div class="rib"><span class="star">★</span> ${ribTxt} <span class="star">★</span></div>`;
    let miolo;
    if (M.layout === "hero" && n === 1) miolo = heroHtml(produtos[0]);
    else {
      const g = M.layout === "grid6" ? "g6" : (n >= 1 && n <= 4 ? "g" + n : "g4");
      miolo = `<div class="grid ${g}">${produtos.map(cardHtml).join("")}</div>`;
    }
    wrap.innerHTML = extras + hdr + ribH + miolo + `<div class="ftr">${esc(ftr)}</div>`;
  }

  function fit(sel, minPx) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize), k = 0;
    while (el.scrollWidth > el.clientWidth + 1 && size > minPx && k < 24) { size -= 0.5; el.style.fontSize = size + "px"; k++; }
  }
  function ajustar() { fit(".rib", 16); fit(".ftr", 11); fit(".t1", 22); fit(".t2", 14); fit(".t13", 16); }

  function esperarImagens() {
    return Promise.all([...document.images].map(im => im.complete && im.naturalWidth ? null :
      new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 8000); })));
  }

  let seq = 0;
  async function render(S) {
    const my = ++seq;
    montar(S);
    await esperarImagens();
    try { await document.fonts.ready; } catch (e) { /* */ }
    if (my !== seq) return false;
    ajustar();
    return true;
  }

  /* --- exportação: html-to-image (SVG foreignObject = o próprio navegador desenha, fiel ao CSS) --- */
  const fontCache = {};
  function blobToDataURL(b) { return new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = err; r.readAsDataURL(b); }); }
  async function fontEmbedCSS() {
    const usadas = new Set();
    const add = ff => (ff || "").split(",").forEach(f => usadas.add(f.trim().replace(/^["']|["']$/g, "").toLowerCase()));
    document.querySelectorAll("body, body *").forEach(el => { add(getComputedStyle(el).fontFamily); add(getComputedStyle(el, "::before").fontFamily); add(getComputedStyle(el, "::after").fontFamily); });
    const regras = [];
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules) {
        if (r.type !== 5) continue; // CSSFontFaceRule
        const fam = r.style.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, "").toLowerCase();
        if (!usadas.has(fam)) continue;
        const m = r.style.getPropertyValue("src").match(/url\(["']?([^"')]+)["']?\)/);
        if (!m) continue;
        const url = new URL(m[1], sh.href || location.href).href;
        if (!fontCache[url]) fontCache[url] = fetch(url).then(x => x.blob()).then(blobToDataURL).catch(() => null);
        const data = await fontCache[url];
        if (!data) continue;
        regras.push(`@font-face{font-family:'${r.style.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, "")}';src:url(${data}) format('woff2');` +
          `font-weight:${r.style.getPropertyValue("font-weight") || "normal"};font-style:${r.style.getPropertyValue("font-style") || "normal"}}`);
      }
    }
    return regras.join("\n");
  }
  const ehSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent) || /iP(hone|ad|od)/.test(navigator.userAgent);
  async function exportar(F) {
    // F = {w, h, dsf}
    const css = await fontEmbedCSS();
    const opts = { width: F.w, height: F.h, pixelRatio: F.dsf,
      fontEmbedCSS: css, cacheBust: false, backgroundColor: "#ffffff", style: { transform: "none" } };
    let canvas = await htmlToImage.toCanvas(document.body, opts);
    if (ehSafari) canvas = await htmlToImage.toCanvas(document.body, opts); // Safari às vezes perde imagens na 1ª passada
    return canvas;
  }

  window.FARMAIS_ARTE = { render, exportar, parsePreco, parseData };
  window.parent && window.parent.postMessage && window.parent.postMessage({ coRenderPronto: true }, location.origin);
})();
