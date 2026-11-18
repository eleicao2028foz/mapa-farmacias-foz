/* Barra lateral esquerda (mesmo estilo do antigo botão de trânsito do mapa de ônibus):
   "Promoções do dia" (data/promocoes_do_dia.json) e "Mais vendidos em Foz" (data/mais_vendidos.json).
   "Últimos 7 dias" (data/promocoes_7dias.json) é a 3ª aba do painel de promoções.
   fm8: grupo "Dermo & Beleza" > "Mais vendidos online" (data/mais_vendidos_online.json, gerado por /workspace/ecommerce/coleta_online.py).
   Tocar num produto marca no mapa as farmácias com ele em promoção. Fechar o painel não apaga as marcações
   nem mexe nos modos de 1 km; "Limpar do mapa" apaga. */
(function () {
  "use strict";
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const brl = v => v == null ? "" : "R$ " + v.toFixed(2).replace(".", ",");
  const milhar = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const semAcento = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const plural = (n, s, p) => n + " " + (n === 1 ? s : p);
  const ICON_PROMO = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 15.2V6.5A2.5 2.5 0 0 1 6.5 4h8.7a2.5 2.5 0 0 1 1.77.73l10.3 10.3a2.5 2.5 0 0 1 0 3.54l-8.7 8.7a2.5 2.5 0 0 1-3.54 0L4.73 16.97A2.5 2.5 0 0 1 4 15.2z" fill="currentColor" opacity=".18" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.3" fill="currentColor"/><path d="M13.2 21.2l7.6-7.6" stroke="#DF2110" stroke-width="2.4" stroke-linecap="round"/><circle cx="14.4" cy="15" r="1.7" fill="#DF2110"/><circle cx="19.6" cy="20.2" r="1.7" fill="#DF2110"/></svg>';
  const ICON_TOP = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="17" width="6" height="11" rx="1.5" fill="currentColor" opacity=".35"/><rect x="13" y="10" width="6" height="18" rx="1.5" fill="currentColor" opacity=".6"/><rect x="22" y="4" width="6" height="24" rx="1.5" fill="currentColor"/><path d="M3 13.5l7-5 5 3 10-7.5" fill="none" stroke="#DF2110" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_DERMO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="12.2" y="3.5" width="7.6" height="5" rx="1.3" fill="currentColor"/><path d="M11 10.5h10a2 2 0 0 1 2 2v13.2a2.8 2.8 0 0 1-2.8 2.8h-8.4A2.8 2.8 0 0 1 9 25.7V12.5a2 2 0 0 1 2-2z" fill="currentColor" opacity=".18" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12.8 17.5h6.4M12.8 21h4.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M25.6 3.2l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" fill="#DF2110"/><path d="M5.6 5.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="#DF2110"/></svg>';

  /* Grupos da barra lateral: cada grupo = título + botões. Para um novo grupo (ex.: "Dermo & Beleza"),
     basta acrescentar um objeto aqui (e tratar a nova "aba" em render()). */
  const GRUPOS = [
    { id: "medicamentos", titulo: "Medicamentos", botoes: [
      { aba: "promos", nome: "Promoções do dia", rotulo: "Promoções<br>do dia", icone: ICON_PROMO, extra: '<span class="fd-dot" hidden></span>' },
      { aba: "mv", nome: "Mais vendidos em Foz", rotulo: "Mais vendidos<br>em Foz", icone: ICON_TOP } ] },
    { id: "dermo", titulo: "Dermo & Beleza", tituloHtml: "Dermo &amp;<br>Beleza", botoes: [
      { aba: "online", nome: "Mais vendidos online", rotulo: "Mais vendidos<br>online", icone: ICON_DERMO } ] }
  ];

  const D = { aba: null, view: "lista", dia: null, mv: null, q: "", ordem: "farmacias", muni: "foz", mvAba: "top", on: null, onAba: "hoje", qOn: "", sel: null, markers: [], aberto: false };
  window.__FARMACIAS_DOCK__ = D;

  function st() { return window.__FARMACIAS__; }
  function estreito() { return window.innerWidth < 1300; }
  function mobile() { return window.innerWidth < 820; }

  function montar() {
    const dock = document.createElement("aside");
    dock.id = "fd-dock";
    dock.innerHTML = `
      <div class="fd-groups">${GRUPOS.map(g => `
        <div class="fd-group" data-grupo="${g.id}">
          <div class="fd-rail" role="toolbar" aria-label="${esc(g.titulo)}">
            <span class="fd-gtitle${g.tituloHtml ? " duas" : ""}" aria-hidden="true">${g.tituloHtml || esc(g.titulo)}</span>
            ${g.botoes.map(b => `<button type="button" class="fd-btn" data-aba="${b.aba}" aria-pressed="false" aria-label="${esc(b.nome)}" title="${esc(b.nome)}">
              <span class="fd-ico">${b.icone}</span><span class="fd-lbl">${b.rotulo}</span>${b.extra || ""}</button>`).join("")}
          </div>
        </div>`).join("")}
      </div>
      <section class="fd-panel" id="fd-panel" hidden aria-live="polite"></section>`;
    document.body.appendChild(dock);
    dock.querySelectorAll(".fd-btn").forEach(b => b.addEventListener("click", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const aba = b.dataset.aba;
      if (D.aberto && D.aba === aba) return fechar();
      abrir(aba);
    }));
    ["pointerdown", "wheel", "touchstart", "dblclick"].forEach(t => dock.addEventListener(t, ev => ev.stopPropagation(), { passive: true }));
    window.addEventListener("resize", posicionar);
  }

  function posicionar() {
    const p = $("#fd-panel"), dock = $("#fd-dock"), bar = $("#fm-bar");
    if (!p || !dock) return;
    const topoBarra = bar ? bar.getBoundingClientRect().top : window.innerHeight - 140;
    dock.style.setProperty("--fd-bottom", Math.max(120, window.innerHeight - topoBarra + 8) + "px");
  }

  function abrir(aba) {
    D.aba = aba; D.aberto = true;
    if (D.sel && D.sel.aba !== aba) D.view = "lista";
    else if (D.sel) D.view = "detalhe";
    else D.view = "lista";
    document.querySelectorAll("#fd-dock .fd-btn").forEach(b => b.setAttribute("aria-pressed", b.dataset.aba === aba ? "true" : "false"));
    document.body.classList.add("fd-aberto");
    posicionar();
    render();
    $("#fd-panel").hidden = false;
  }
  function fechar() {
    D.aberto = false;
    const p = $("#fd-panel"); if (p) { p.hidden = true; }
    document.body.classList.remove("fd-aberto");
    document.querySelectorAll("#fd-dock .fd-btn").forEach(b => b.setAttribute("aria-pressed", "false"));
    marcarBotaoSel();
  }
  function marcarBotaoSel() {
    document.querySelectorAll("#fd-dock .fd-btn").forEach(b => b.classList.toggle("tem-sel", !!(D.sel && D.sel.aba === b.dataset.aba)));
    const dot = $('#fd-dock .fd-btn[data-aba="promos"] .fd-dot');
    if (dot) dot.hidden = true;
  }

  /* ---------- dados ---------- */
  function produtoPorChave(k) { return (D.dia.produtos || []).find(p => p.chave === k); }
  function lojasDe(chaves, fixas) {
    if (fixas) return fixas.slice();   // aba "Últimos 7 dias": lojas vindas do banco (promocoes_7dias.json)
    const m = new Map();
    for (const k of chaves) {
      const p = produtoPorChave(k); if (!p) continue;
      for (const l of p.lojas) {
        const a = m.get(l.site_id);
        if (!a || (l.preco != null && (a.preco == null || l.preco < a.preco))) m.set(l.site_id, Object.assign({ nomeProduto: p.nome }, l));
      }
    }
    return [...m.values()].sort((a, b) => (a.preco ?? 9e9) - (b.preco ?? 9e9) || a.dist_m - b.dist_m);
  }

  /* ---------- render ---------- */
  function render() {
    const p = $("#fd-panel");
    p.className = "fd-panel aba-" + D.aba + " view-" + D.view;
    if (D.view === "detalhe" && D.sel) return renderDetalhe(p);
    if (D.aba === "promos") renderPromos(p); else if (D.aba === "online") renderOnline(p); else renderMV(p);
  }
  function cab(titulo, meta) {
    return `<header class="fd-head"><div><h2 class="fd-title">${titulo}</h2><p class="fd-meta">${meta}</p></div>
      <button type="button" class="fd-close" aria-label="Fechar painel" title="Fechar (as marcações continuam no mapa)">×</button></header>`;
  }
  function ligarFechar(p) { p.querySelector(".fd-close").addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); fechar(); }); }

  function renderPromos(p) {
    const d = D.dia;
    if (!d) { p.innerHTML = cab("Promoções do dia", "Carregando…"); ligarFechar(p); return; }
    const s7 = D.ordem === "7dias" ? D.sete : null;
    const meta = s7 ? `Banco do radar, ${esc(s7.janela_txt || "")} · ${plural(s7.n_produtos || 0, "produto", "produtos")}`
      : `${esc(d.atualizado || "")} · ${plural(d.n_produtos, "produto", "produtos")}`;
    p.innerHTML = cab("Promoções do dia", meta) + `
      <div class="fd-tools">
        <input type="search" class="fd-busca" placeholder="Buscar produto (ex.: dipirona, fralda)" value="${esc(D.q)}" aria-label="Buscar produto">
        <div class="fd-seg" role="tablist" aria-label="Ordenar">
          <button type="button" data-ordem="farmacias" class="${D.ordem === "farmacias" ? "on" : ""}">Mais farmácias</button>
          <button type="button" data-ordem="desconto" class="${D.ordem === "desconto" ? "on" : ""}">Maior desconto</button>
          <button type="button" data-ordem="7dias" class="${D.ordem === "7dias" ? "on" : ""}">Últimos 7 dias</button>
        </div>
      </div>
      <p class="fd-explica fd-aviso7"${s7 && s7.aviso ? "" : " hidden"}>${esc(s7 && s7.aviso || "")}</p>
      <ul class="fd-list"></ul>
      <div class="fd-foot"></div>`;
    ligarFechar(p);
    const inp = p.querySelector(".fd-busca");
    inp.addEventListener("input", () => { D.q = inp.value; listaPromos(p); });
    p.querySelectorAll(".fd-seg button").forEach(b => b.addEventListener("click", () => {
      const era7 = D.ordem === "7dias"; D.ordem = b.dataset.ordem;
      if (era7 !== (D.ordem === "7dias")) { const pos = inp.selectionStart; render(); const i2 = $("#fd-panel .fd-busca"); if (i2 && document.activeElement === inp) { i2.focus(); try { i2.setSelectionRange(pos, pos); } catch (e) {} } return; }
      p.querySelectorAll(".fd-seg button").forEach(x => x.classList.toggle("on", x === b)); listaPromos(p);
    }));
    listaPromos(p);
  }
  function lista7(p, q) {
    const s7 = D.sete || { produtos: [], n_produtos: 0 };
    const itens = (s7.produtos || []).filter(x => !q.length || q.every(t => semAcento(x.nome + " " + x.variantes.join(" ") + " " + x.redes.join(" ")).includes(t)));
    const tend = x => x.tendencia === "cai" ? `<span class="fd-tend cai" title="Menor preço: primeiro x último dia">↓ preço ${fmtPct(x.var_preco_pct)}</span>`
      : x.tendencia === "sobe" ? `<span class="fd-tend sobe-p" title="Menor preço: primeiro x último dia">↑ preço ${fmtPct(x.var_preco_pct)}</span>`
      : x.tendencia === "estavel" ? `<span class="fd-tend est" title="Menor preço: primeiro x último dia">→ preço igual</span>` : "";
    const ul = p.querySelector(".fd-list"); ul.classList.add("fd-mv", "fd-7d");
    ul.innerHTML = itens.map(x => `<li><button type="button" class="fd-item${D.sel && D.sel.sete && D.sel.chave === x.chave ? " is-sel" : ""}" data-k="${esc(x.chave)}">
        <span class="fd-pos">${x.pos}º</span>
        <span class="fd-nome">${esc(x.nome)}</span>
        <span class="fd-linha"><span class="fd-badge">em promoção em ${plural(x.n_dias, "dia", "dias")}</span><span class="fd-nredes">· ${plural(x.n_redes, "rede/farmácia", "redes/farmácias")}</span>
        ${x.menor_preco != null ? `<span class="fd-preco">menor preço ${brl(x.menor_preco)}</span>` : ""}
        ${x.maior_desconto != null ? `<span class="fd-desc">até −${x.maior_desconto}%</span>` : ""}${tend(x)}
        ${x.ativo_hoje ? `<span class="fd-hoje">em promoção hoje</span>` : ""}</span>
        <span class="fd-redes">${esc(x.redes.join(" · "))}${x.n_dias > 1 ? ` · ${esc(x.primeiro)}–${esc(x.ultimo)}` : ` · ${esc(x.ultimo)}`}</span>
      </button></li>`).join("") || `<li class="fd-vazio">${D.sete ? `Nenhum produto encontrado${D.q ? ` para “${esc(D.q)}”` : ""}.` : "Carregando o banco de promoções…"}</li>`;
    ul.querySelectorAll(".fd-item").forEach(b => b.addEventListener("click", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const x = (D.sete.produtos || []).find(y => y.chave === b.dataset.k); if (!x) return;
      selecionar({ aba: "promos", sete: true, chave: x.chave, nome: x.nome, chaves: [x.chave], lojas: x.lojas, x });
    }));
    p.querySelector(".fd-foot").innerHTML = `<p class="fd-nota">${itens.length} de ${s7.n_produtos || 0} produtos. ${esc(s7.criterio || "")}${s7.banco_inicio_txt ? ` Banco iniciado em ${esc(s7.banco_inicio_txt)}; ${plural(s7.dias_com_coleta_total || 0, "dia", "dias")} com coleta até agora.` : ""} Fonte: radar de concorrentes (stories e sites).</p>`;
  }
  function listaPromos(p) {
    if (D.ordem === "7dias") return lista7(p, semAcento(D.q).trim().split(/\s+/).filter(Boolean));
    const d = D.dia, q = semAcento(D.q).trim().split(/\s+/).filter(Boolean);
    let itens = d.produtos.filter(x => !q.length || q.every(t => semAcento(x.nome + " " + x.variantes.join(" ") + " " + x.redes.join(" ")).includes(t)));
    if (D.ordem === "desconto") itens = itens.slice().sort((a, b) => (b.maior_desconto ?? -1) - (a.maior_desconto ?? -1) || b.n_farmacias - a.n_farmacias);
    const ul = p.querySelector(".fd-list");
    ul.innerHTML = itens.map(x => `<li><button type="button" class="fd-item${D.sel && D.sel.chave === x.chave ? " is-sel" : ""}" data-k="${esc(x.chave)}">
        <span class="fd-nome">${esc(x.nome)}</span>
        <span class="fd-linha"><span class="fd-badge">${plural(x.n_farmacias, "farmácia em promoção", "farmácias em promoção")}</span>
        ${x.menor_preco != null ? `<span class="fd-preco">a partir de ${brl(x.menor_preco)}</span>` : ""}
        ${x.maior_desconto != null ? `<span class="fd-desc">até −${x.maior_desconto}%</span>` : ""}</span>
        <span class="fd-redes">${esc(x.redes.map(r => r.replace(/\s*\(.*?\)\s*/g, "")).join(" · "))}</span>
      </button></li>`).join("") || `<li class="fd-vazio">Nenhum produto encontrado${D.q ? ` para “${esc(D.q)}”` : ""}.</li>`;
    ul.querySelectorAll(".fd-item").forEach(b => b.addEventListener("click", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const x = produtoPorChave(b.dataset.k);
      selecionar({ aba: "promos", chave: x.chave, nome: x.nome, chaves: [x.chave] });
    }));
    const camp = d.campanhas || [];
    p.querySelector(".fd-foot").innerHTML = (camp.length && !q.length ? `<p class="fd-sub">Campanhas sem preço por produto</p><ul class="fd-camp">${camp.map(c =>
      `<li><b>${esc(c.nome)}</b> — ${esc(c.redes.map(r => r.replace(/\s*\(.*?\)\s*/g, "")).join(", "))} (${plural(c.n_farmacias, "loja", "lojas")})${c.lojas[0] && c.lojas[0].preco_txt && c.lojas[0].preco_txt !== "sem preço" ? ": " + esc(c.lojas[0].preco_txt) : ""}</li>`).join("")}</ul>` : "") +
      `<p class="fd-nota">${itens.length} de ${d.n_produtos} produtos. ${esc(d.criterio || "")} Fonte: radar de concorrentes (stories e sites).</p>`;
  }

  function renderMV(p) {
    const m = D.mv;
    if (!m) { p.innerHTML = cab("Mais vendidos em Foz", "Carregando…"); ligarFechar(p); return; }
    const mu = m.municipios[D.muni] || m.municipios.foz;
    const titulo = D.muni === "foz" ? "Mais vendidos em Foz" : "Mais vendidos em Santa Terezinha";
    p.innerHTML = cab(titulo, `Unidades vendidas em farmácias, ${esc(m.periodo)} · promoções: ${esc((m.atualizado || "").replace("Atualizado em ", ""))}`) + `
      <div class="fd-tools">
        <div class="fd-seg" aria-label="Lista">
          <button type="button" data-mvaba="top" class="${D.mvAba === "top" ? "on" : ""}">Top 20</button>
          <button type="button" data-mvaba="oport" class="${D.mvAba === "oport" ? "on" : ""}">Oportunidades FARMAIS</button>
        </div>
        ${m.municipios.santa_terezinha ? `<div class="fd-seg fd-seg-mini" aria-label="Município">
          <button type="button" data-muni="foz" class="${D.muni === "foz" ? "on" : ""}">Foz do Iguaçu</button>
          <button type="button" data-muni="santa_terezinha" class="${D.muni === "santa_terezinha" ? "on" : ""}">Santa Terezinha</button></div>` : ""}
      </div>
      ${D.mvAba === "oport" ? `<p class="fd-explica">Remédios que vendem muito e quase ninguém está anunciando em promoção hoje (0 ou 1 farmácia).</p>` : ""}
      <ol class="fd-list fd-mv"></ol>
      <div class="fd-foot"><p class="fd-nota">${esc(m.fonte)} Tendência: ${esc(m.tendencia)}. O selo de promoção conta as farmácias do mapa com o princípio ativo em promoção hoje.</p></div>`;
    ligarFechar(p);
    p.querySelectorAll("[data-mvaba]").forEach(b => b.addEventListener("click", () => { D.mvAba = b.dataset.mvaba; render(); }));
    p.querySelectorAll("[data-muni]").forEach(b => b.addEventListener("click", () => { D.muni = b.dataset.muni; render(); }));
    let itens = mu.itens.slice(0, 20);
    if (D.mvAba === "oport") itens = mu.itens.filter(g => g.n_farmacias <= 1).slice(0, 20);
    const seta = g => g.tendencia === "sobe" ? `<span class="fd-tend sobe" title="Últimos 3 meses x 3 anteriores">↑ ${fmtPct(g.var_pct)}</span>`
      : g.tendencia === "cai" ? `<span class="fd-tend cai" title="Últimos 3 meses x 3 anteriores">↓ ${fmtPct(g.var_pct)}</span>`
      : `<span class="fd-tend est" title="Últimos 3 meses x 3 anteriores">→ ${fmtPct(g.var_pct)}</span>`;
    const ol = p.querySelector(".fd-mv");
    ol.innerHTML = itens.map(g => `<li><button type="button" class="fd-item${D.sel && D.sel.mv === g.nome ? " is-sel" : ""}" data-pos="${g.pos}">
        <span class="fd-pos">${g.pos}º</span>
        <span class="fd-nome">${esc(g.nome)}</span>
        <span class="fd-linha"><span class="fd-un">${milhar(g.unidades)} un.</span>${seta(g)}
          ${g.n_farmacias ? `<span class="fd-badge">${plural(g.n_farmacias, "farmácia em promoção", "farmácias em promoção")}</span>` : `<span class="fd-badge sem">sem promoção</span>`}
          ${g.menor_preco != null ? `<span class="fd-preco">a partir de ${brl(g.menor_preco)}</span>` : ""}</span>
      </button></li>`).join("") || `<li class="fd-vazio">Nenhum item.</li>`;
    ol.querySelectorAll(".fd-item").forEach(b => b.addEventListener("click", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const g = mu.itens.find(x => x.pos === +b.dataset.pos);
      selecionar({ aba: "mv", mv: g.nome, nome: g.nome, chaves: g.produtos || [], g });
    }));
  }
  /* ---------- Dermo & Beleza: mais vendidos online (data/mais_vendidos_online.json) ---------- */
  function precoFaixa(x) {
    if (x.preco_min == null) return "";
    return x.preco_max != null && x.preco_max - x.preco_min > 0.009 ? `de ${brl(x.preco_min)} a ${brl(x.preco_max)}` : brl(x.preco_min);
  }
  function seloOnline(pf) {
    const cls = pf.tipo === "linha" ? "" : pf.tipo === "marca" ? " marca" : pf.tipo === "sem_marca" ? " sem" : pf.n_semana ? " sem" : " oport";
    return `<span class="fd-badge${cls}">${esc(pf.selo)}</span>`;
  }
  function lojasOnline(x) {
    return x.lojas.map(l => `<a class="fd-store" href="${esc(l.url)}" target="_blank" rel="noopener" title="Abrir na ${esc(l.loja)} (${esc(l.categoria)})">${esc(l.loja)} <b>${l.melhor_posicao}º</b> ↗</a>`).join("");
  }
  function renderOnline(p) {
    const d = D.on;
    if (!d) { p.innerHTML = cab("Mais vendidos online", "Carregando…"); ligarFechar(p); return; }
    const sete = D.onAba === "7dias";
    const total = sete ? d.n_7dias : d.n_hoje;
    p.innerHTML = cab("Mais vendidos online", `Dermo, beleza e higiene · Amazon e Mercado Livre · ${plural(total || 0, "produto", "produtos")}`) + `
      <div class="fd-tools">
        <input type="search" class="fd-busca" placeholder="Buscar (ex.: protetor, CeraVe, fralda)" value="${esc(D.qOn)}" aria-label="Buscar produto">
        <div class="fd-seg" role="tablist" aria-label="Período">
          <button type="button" data-onaba="hoje" class="${!sete ? "on" : ""}">Hoje</button>
          <button type="button" data-onaba="7dias" class="${sete ? "on" : ""}">Últimos 7 dias</button>
        </div>
      </div>
      <p class="fd-explica fd-aviso7"${sete && d.aviso_7dias ? "" : " hidden"}>${esc(d.aviso_7dias || "")}</p>
      <ol class="fd-list fd-mv fd-online"></ol>
      <div class="fd-foot"></div>`;
    ligarFechar(p);
    const inp = p.querySelector(".fd-busca");
    inp.addEventListener("input", () => { D.qOn = inp.value; listaOnline(p); });
    p.querySelectorAll("[data-onaba]").forEach(b => b.addEventListener("click", () => { D.onAba = b.dataset.onaba; render(); }));
    listaOnline(p);
  }
  function listaOnline(p) {
    const d = D.on, sete = D.onAba === "7dias";
    const q = semAcento(D.qOn).trim().split(/\s+/).filter(Boolean);
    const base = (sete ? d["7dias"] : d.hoje) || [];
    const itens = base.filter(x => !q.length || q.every(t => semAcento(x.nome + " " + x.marca + " " + x.categorias.join(" ")).includes(t)));
    const tend = x => !sete ? "" : x.tendencia === "sobe" ? `<span class="fd-tend sobe" title="Melhor posição: 1º x último dia">↑ ${x.var_posicoes} pos.</span>`
      : x.tendencia === "cai" ? `<span class="fd-tend cai" title="Melhor posição: 1º x último dia">↓ ${Math.abs(x.var_posicoes)} pos.</span>`
      : x.tendencia === "estavel" ? `<span class="fd-tend est">→ estável</span>` : x.tendencia === "novo" ? `<span class="fd-hoje">novo</span>`
      : x.tendencia === "saiu" ? `<span class="fd-tend cai">saiu da lista</span>` : "";
    const ol = p.querySelector(".fd-online");
    ol.innerHTML = itens.map(x => {
      const pode = x.promo_foz.chaves && x.promo_foz.chaves.length;
      return `<li><div class="fd-item${pode ? "" : " sem-mapa"}${D.sel && D.sel.on && D.sel.chave === x.chave ? " is-sel" : ""}" data-k="${esc(x.chave)}"${pode ? ` role="button" tabindex="0" title="Marcar no mapa as farmácias com promoção"` : ""}>
        <span class="fd-pos">${x.pos}º</span>
        <span class="fd-nome">${esc(x.nome)}</span>
        <span class="fd-linha fd-stores">${lojasOnline(x)}${x.preco_min != null ? `<span class="fd-preco">${precoFaixa(x)}</span>` : ""}${tend(x)}</span>
        ${sete ? `<span class="fd-redes">no top em ${plural(x.n_dias, "dia", "dias")}${x.n_dias > 1 ? ` (${esc(x.primeiro)}–${esc(x.ultimo)})` : ` (${esc(x.ultimo)})`} · ${plural(x.n_listas, "lista", "listas")}</span>` : (x.n_listas > 1 ? `<span class="fd-redes">em ${x.n_listas} listas de mais vendidos</span>` : "")}
        <span class="fd-linha">${seloOnline(x.promo_foz)}${pode && x.promo_foz.redes && x.promo_foz.redes.length ? `<span class="fd-redes">${esc(x.promo_foz.redes.join(" · "))}</span>` : ""}</span>
      </div></li>`; }).join("") || `<li class="fd-vazio">Nenhum produto encontrado${D.qOn ? ` para “${esc(D.qOn)}”` : ""}.</li>`;
    ol.querySelectorAll(".fd-store").forEach(a => {
      a.addEventListener("click", ev => ev.stopPropagation());
      a.addEventListener("keydown", ev => ev.stopPropagation());
    });
    const escolher = el => {
      const x = base.find(y => y.chave === el.dataset.k); if (!x || !(x.promo_foz.chaves || []).length) return;
      selecionar({ aba: "online", on: x, chave: x.chave, nome: x.nome, chaves: x.promo_foz.chaves });
    };
    ol.querySelectorAll(".fd-item[role=button]").forEach(b => {
      b.addEventListener("click", ev => { if (ev.target.closest("a")) return; ev.preventDefault(); ev.stopPropagation(); escolher(b); });
      b.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); escolher(b); } });
    });
    p.querySelector(".fd-foot").innerHTML = `<p class="fd-nota">${itens.length} de ${sete ? d.n_7dias : d.n_hoje} produtos. ${esc(sete ? d.criterio_7dias : d.criterio_hoje)} ${esc(d.criterio_promo || "")}</p>
      <p class="fd-nota fd-fonte"><b>${esc(d.fonte || "Fonte: mais vendidos da Amazon e do Mercado Livre (vendas online, não de farmácia).")}</b> ${esc(d.atualizado || "")}.</p>`;
  }

  function fmtPct(v) { return v == null ? "" : (v > 0 ? "+" : v < 0 ? "−" : "") + String(Math.abs(v)).replace(".", ",") + "%"; }

  function renderDetalhe(p) {
    const s = D.sel, lojas = lojasDe(s.chaves, s.lojas);
    const precos = lojas.map(l => l.preco).filter(v => v != null);
    const sub = lojas.length ? `${plural(lojas.length, s.sete ? "farmácia (7 dias)" : "farmácia em promoção", s.sete ? "farmácias (7 dias)" : "farmácias em promoção")}${precos.length ? " · a partir de " + brl(Math.min(...precos)) : ""}` : "Nenhuma farmácia com promoção hoje";
    const extra = s.on ? `<p class="fd-explica">Mais vendido online: ${s.on.lojas.map(l => `${esc(l.loja)} ${l.melhor_posicao}º (${esc(l.categoria)})`).join(" · ")}${s.on.preco_min != null ? ` · ${precoFaixa(s.on)}` : ""}<br>${s.on.promo_foz.tipo === "marca" ? "Em Foz a marca está em promoção, mas com outro item: " : "Em promoção em Foz: "}${esc((s.on.promo_foz.nomes || []).join("; "))}</p>` : s.x ? `<p class="fd-explica">Últimos 7 dias: em promoção em ${plural(s.x.n_dias, "dia", "dias")} · ${plural(s.x.n_redes, "rede/farmácia", "redes/farmácias")} (${esc(s.x.redes.join(", "))})${s.x.menor_preco != null ? ` · menor preço ${brl(s.x.menor_preco)}` : ""}${s.x.ativo_hoje ? " · em promoção hoje" : " · não está em promoção hoje"}</p>` : s.g ? `<p class="fd-explica">${milhar(s.g.unidades)} unidades vendidas em ${D.muni === "foz" ? "Foz" : "Santa Terezinha"} (jan–out 2026) · ${s.g.pos}º lugar${s.g.produtos_nomes && s.g.produtos_nomes.length ? `<br>Em promoção: ${esc(s.g.produtos_nomes.join("; "))}` : ""}</p>` : "";
    p.innerHTML = `<header class="fd-head"><div><button type="button" class="fd-voltar">‹ ${s.on ? "Mais vendidos online" : s.sete ? "Últimos 7 dias" : s.aba === "promos" ? "Todos os produtos" : "Mais vendidos"}</button>
        <h2 class="fd-title">${esc(s.nome)}</h2><p class="fd-meta">${sub}</p></div>
        <button type="button" class="fd-close" aria-label="Fechar painel" title="Fechar (as marcações continuam no mapa)">×</button></header>
      ${extra}
      <ul class="fd-list fd-lojas">${lojas.map(l => `<li><button type="button" class="fd-item fd-loja" data-site="${esc(l.site_id)}">
          <span class="fd-nome">${esc(l.titulo)}</span>
          ${s.aba === "mv" || s.aba === "online" ? `<span class="fd-prod">${esc(l.produto)}</span>` : (l.produto !== s.nome ? `<span class="fd-prod">${esc(l.produto)}</span>` : "")}
          <span class="fd-linha">${l.preco != null ? `<span class="fd-preco forte">${l.de ? `<s>${brl(l.de)}</s> ` : ""}${brl(l.preco)}</span>` : `<span class="fd-preco">${esc(l.preco_txt || "—")}</span>`}
            ${l.desconto != null ? `<span class="fd-desc">−${l.desconto}%</span>` : ""}
            <span class="fd-dist">${milhar(l.dist_m)} m da FARMAIS ${esc(l.farmais)}</span></span>
          ${l.validade || l.visto_em ? `<span class="fd-val">${l.visto_em ? `Visto em ${esc(l.visto_em)}` : ""}${l.visto_em && l.validade ? " · " : ""}${l.validade ? `Validade: ${esc(l.validade)}` : ""}</span>` : ""}
        </button></li>`).join("") || `<li class="fd-vazio">${s.aba === "mv" ? "Nenhuma farmácia do radar está com este princípio ativo em promoção hoje — boa oportunidade para a FARMAIS anunciar." : "Nenhuma loja."}</li>`}</ul>
      <div class="fd-acoes">${lojas.length ? `<button type="button" class="fd-ver">Ver todas no mapa</button>` : ""}<button type="button" class="fd-limpar">Limpar do mapa</button></div>`;
    p.scrollTop = 0;
    ligarFechar(p);
    p.querySelector(".fd-voltar").addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); D.view = "lista"; render(); });
    p.querySelector(".fd-limpar").addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); limparSel(); D.view = "lista"; render(); });
    const ver = p.querySelector(".fd-ver"); if (ver) ver.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); enquadrar(lojas); });
    p.querySelectorAll(".fd-loja").forEach(b => b.addEventListener("click", ev => {
      ev.preventDefault(); ev.stopPropagation(); abrirLoja(b.dataset.site);
    }));
  }

  /* ---------- mapa ---------- */
  function limparMarcadores() { D.markers.forEach(m => m.remove()); D.markers = []; }
  function limparSel() { limparMarcadores(); D.sel = null; marcarBotaoSel(); }
  function selecionar(sel) {
    const S = st();
    if (S && S.desligarModo) S.desligarModo();   // evita marcadores sobrepostos com o modo de 1 km
    limparMarcadores();
    D.sel = sel; D.view = "detalhe";
    const lojas = lojasDe(sel.chaves, sel.lojas);
    for (const l of lojas) {
      const el = document.createElement("button");
      el.type = "button"; el.className = "fm-pin-promo fd-pin";
      el.innerHTML = `<span class="tag">%</span><span class="txt">${l.preco != null ? brl(l.preco) : "promoção"}</span>${l.desconto != null ? `<span class="n">−${l.desconto}%</span>` : ""}`;
      el.title = l.titulo;
      el.addEventListener("pointerdown", ev => ev.stopPropagation());
      el.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); abrirLoja(l.site_id); });
      D.markers.push(new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -14] }).setLngLat([l.lon, l.lat]).addTo(S.map));
    }
    render(); marcarBotaoSel();
    if (lojas.length) enquadrar(lojas);
  }
  function enquadrar(lojas) {
    const S = st(); if (!S || !lojas.length) return;
    const p = $("#fd-panel"), r = p && !p.hidden ? p.getBoundingClientRect() : null, bar = $("#fm-bar");
    const W = window.innerWidth, H = window.innerHeight;
    const barTop = bar ? bar.getBoundingClientRect().top : H;
    let pad;
    if (mobile()) pad = { top: 70, left: 30, right: 30, bottom: Math.max(60, H - (r ? r.top : barTop) + 20) };
    else pad = { top: 80, right: 80, bottom: H - barTop + 50, left: r ? r.right + 50 : 120 };
    // o mapa já tem um padding fixo (getPadding) que o cameraForBounds soma ao nosso
    const mp = S.map.getPadding ? S.map.getPadding() : { top: 0, bottom: 0, left: 0, right: 0 };
    for (const k of ["top", "bottom", "left", "right"]) pad[k] = Math.max(0, pad[k] - (mp[k] || 0));
    if (pad.top + pad.bottom + mp.top + mp.bottom > H - 80) pad.bottom = Math.max(0, H - 80 - pad.top - mp.top - mp.bottom);
    if (pad.left + pad.right + mp.left + mp.right > W - 80) pad.left = Math.max(0, W - 80 - pad.right - mp.left - mp.right);
    const b = new maplibregl.LngLatBounds();
    lojas.forEach(l => b.extend([l.lon, l.lat]));
    // vista de cima: com inclinação o enquadramento deixa pontos atrás da barra
    let cam = null;
    try { cam = S.map.cameraForBounds(b, { padding: pad, bearing: 0, maxZoom: 17 }); } catch (e) { cam = null; }
    if (!cam) cam = { center: b.getCenter(), zoom: 13, offset: [0, -Math.round((pad.bottom - pad.top) / 2)] };
    S.map.flyTo(Object.assign(cam, { pitch: 0, bearing: 0, duration: 1600, essential: true }));
  }
  function abrirLoja(siteId) {
    const S = st(); if (!S) return;
    const s = S.dados.sites.find(x => x.id === siteId); if (!s) return;
    if (estreito()) fechar();   // libera a tela para o cartão (as marcações ficam)
    S.abrirCard(Object.assign({}, s, { d: null }), "promo");
  }

  async function iniciar() {
    const S = st();
    if (!S || !S.pronto) return setTimeout(iniciar, 400);
    S.onModo = () => { if (D.sel) { limparSel(); if (D.aberto && D.view === "detalhe") { D.view = "lista"; render(); } } };
    montar();
    const t = Date.now();
    const q0 = new URLSearchParams(location.search);
    if (q0.get("ordem") === "7dias") D.ordem = "7dias";
    fetch("data/promocoes_7dias.json?t=" + t).then(r => r.ok ? r.json() : null).catch(() => null).then(j => {
      D.sete = j || { produtos: [], n_produtos: 0, aviso: "Banco de promoções ainda não disponível." };
      if (D.aberto && D.aba === "promos" && D.view === "lista" && D.ordem === "7dias") render();
    });
    fetch("data/mais_vendidos_online.json?t=" + t).then(r => r.ok ? r.json() : null).catch(() => null).then(j => {
      D.on = j || { hoje: [], "7dias": [], n_hoje: 0, n_7dias: 0, atualizado: "sem dados", fonte: "" };
      if (D.aberto && D.aba === "online" && D.view === "lista") render();
    });
    const [dia, mv] = await Promise.all([
      fetch("data/promocoes_do_dia.json?t=" + t).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("data/mais_vendidos.json?t=" + t).then(r => r.ok ? r.json() : null).catch(() => null)]);
    D.dia = dia || { produtos: [], campanhas: [], n_produtos: 0, atualizado: "sem dados" };
    D.mv = mv || { municipios: { foz: { itens: [] } }, fonte: "", periodo: "", tendencia: "" };
    if (D.aberto) render();
    const q = new URLSearchParams(location.search);
    if (q.get("painel") === "promos" || q.get("painel") === "mais-vendidos") abrir(q.get("painel") === "promos" ? "promos" : "mv");
    if (q.get("painel") === "online") { if (q.get("periodo") === "7dias") D.onAba = "7dias"; abrir("online"); }
  }
  iniciar();
})();
