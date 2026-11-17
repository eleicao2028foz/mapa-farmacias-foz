/* Mapa das farmácias: prédios 3D alinhados ao meio-fio, barra FARMAIS e modos "Promoções" / "Farmácias próximas".
   Dados: data/farmacias.json (geocodificação + posicionamento) e data/promocoes.json (gerar_promocoes.py). */
(function () {
  "use strict";
  const RAIO_M = 1000;
  const FM = { blue: "#00428F", red: "#DF2110" };
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const st = { map: null, dados: null, promos: { por_site: {} }, loja: null, modo: null, markers: [], popup: null };
  window.__FARMACIAS__ = st;

  function img(src) { return new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; }); }
  function dist(a, b) {
    const R = 6371008.8, r = Math.PI / 180, dLa = (b[1] - a[1]) * r, dLo = (b[0] - a[0]) * r;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function circulo(c, m, n) {
    const out = [], r = Math.PI / 180;
    for (let i = 0; i <= (n || 96); i++) {
      const a = i / (n || 96) * 2 * Math.PI;
      out.push([c[0] + (m * Math.sin(a)) / (111320 * Math.cos(c[1] * r)), c[1] + (m * Math.cos(a)) / 110574]);
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [out] }, properties: {} };
  }

  /* ---------- prédios: uma malha por modelo, desenhada por instância ---------- */
  function construirModelos(A) {
    const F = window.FozFarmacias, R = window.REDES, M = {};
    M.farmais_rua = F.farmaisRua(A); M.farmais_posto = F.farmaisPosto(A); M.farmais_supermercado = F.farmaisMercado(A);
    for (const k of Object.keys(R)) M["rede_" + k] = F.chainStore(Object.assign({ id: k }, R[k]));
    for (let v = 0; v < 3; v++) M["independente_" + (v + 1)] = F.independente(v);
    return M;
  }
  function camada(map, sites, modelos) {
    const GLL = window.FozFarmaciasGL;
    let gl, prog, origin, unit, malhas = {}, inst = [];
    const mb = new Float32Array(16), lt = new Float32Array(3), L = GLL.LIGHT_MERC;
    return {
      id: "farmacias-3d", type: "custom", renderingMode: "3d",
      onAdd(m, g) {
        gl = g; prog = GLL.program(gl);
        origin = maplibregl.MercatorCoordinate.fromLngLat([-54.56, -25.52]);
        unit = origin.meterInMercatorCoordinateUnits();
        const usados = new Set(sites.map(s => s.model));
        for (const k of usados) if (modelos[k]) malhas[k] = GLL.upload(gl, modelos[k], GLL.pack(modelos[k], true, 0));
        inst = sites.filter(s => malhas[s.model]).map(s => {
          const p = maplibregl.MercatorCoordinate.fromLngLat([s.lon, s.lat]);
          const phi = s.phi, c = Math.cos(phi), sn = Math.sin(phi);
          return { k: s.model, x: p.x, y: p.y, c, sn, sc: s.scale || 1,
            light: [L[0] * c - L[1] * sn, L[0] * sn + L[1] * c, L[2]] };
        });
      },
      render(g, M) {
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
        for (const o of inst) {
          const s = unit * o.sc;
          for (let r = 0; r < 4; r++) {
            mb[r] = M[r] * s * o.c - M[4 + r] * s * o.sn;
            mb[4 + r] = M[r] * s * o.sn + M[4 + r] * s * o.c;
            mb[8 + r] = M[8 + r] * s;
            mb[12 + r] = M[r] * o.x + M[4 + r] * o.y + M[12 + r];
          }
          lt[0] = o.light[0]; lt[1] = o.light[1]; lt[2] = o.light[2];
          GLL.draw(gl, prog, malhas[o.k], mb, lt);
        }
      },
    };
  }
  function esconderPredios(map, d) {
    const ids = d.hide_ids || [];
    const poly = d.hide_poly;
    for (const L of map.getStyle().layers) {
      const sl = L["source-layer"];
      let novo = null;
      if (sl === "buildings" && ids.length) novo = ["!", ["in", ["id"], ["literal", ids]]];
      else if ((sl === "retro-details" || L.source === "vegetation") && poly) novo = ["!", ["within", poly]];
      if (!novo) continue;
      const f = map.getFilter(L.id);
      try { map.setFilter(L.id, f ? ["all", f, novo] : novo); } catch (e) { console.warn("filtro", L.id, e); }
    }
  }
  function visaoCidade(jump) {
    const b = new maplibregl.LngLatBounds();
    st.dados.sites.forEach(s => b.extend([s.lon, s.lat]));
    const cam = st.map.cameraForBounds(b, { padding: { top: 60, bottom: 170, left: 60, right: 60 }, bearing: -15 });
    const c = Object.assign(cam, { zoom: cam.zoom + 1.25, pitch: 40, bearing: -15 });
    jump ? st.map.jumpTo(c) : st.map.flyTo(Object.assign(c, { duration: 1800 }));
  }
  st.visaoCidade = visaoCidade;
  function primeiroSimbolo(map) {
    const l = map.getStyle().layers.find(L => L.type === "symbol");
    return l ? l.id : undefined;
  }

  /* ---------- barra FARMAIS ---------- */
  function montarBarra(lojas) {
    const bar = document.createElement("nav");
    bar.id = "fm-bar"; bar.setAttribute("aria-label", "Lojas FARMAIS");
    bar.innerHTML = `
      <div class="fm-acoes" hidden>
        <button type="button" class="fm-acao fm-acao-promo" data-modo="promo"><span class="fm-acao-ico">%</span>Promoções próximo a mim</button>
        <button type="button" class="fm-acao fm-acao-perto" data-modo="perto"><span class="fm-acao-ico">✚</span>Farmácias próximas a mim</button>
      </div>
      <div class="fm-hud"><div class="fm-tools">
        <div class="fm-tab" aria-hidden="true"><img src="img/farmais-logo.png" alt=""><div class="sub">Nossas lojas em Foz</div></div>
        <div class="fm-vdiv"></div>
        <div class="fm-btns">${lojas.map(l => `
          <button type="button" class="fm-item" data-id="${esc(l.id)}" aria-label="${esc(l.botao)}" title="${esc(l.endereco)}">
            <div class="fm-ring"><div class="fm-btn"><img src="img/farmais-icone.png" alt=""></div></div>
            <span class="fm-label">${esc(l.botao)}</span>
          </button>`).join("")}
        </div></div></div>`;
    document.body.appendChild(bar);
    bar.querySelectorAll(".fm-item").forEach(b => b.addEventListener("click", () => selecionarLoja(b.dataset.id)));
    bar.querySelectorAll(".fm-acao").forEach(b => b.addEventListener("click", () => alternarModo(b.dataset.modo)));
    const painel = document.createElement("aside");
    painel.id = "fm-painel"; painel.hidden = true; document.body.appendChild(painel);
  }
  function selecionarLoja(id, jump) {
    const l = st.dados.farmais.find(x => x.id === id); if (!l) return;
    st.loja = l;
    document.querySelectorAll("#fm-bar .fm-item").forEach(b => b.classList.toggle("is-active", b.dataset.id === id));
    $("#fm-bar .fm-acoes").hidden = false;
    const cam = { center: [(l.lon + l.front[0]) / 2, (l.lat + l.front[1]) / 2], zoom: 19, pitch: 55, bearing: -l.phi * 180 / Math.PI + 22 };
    jump ? st.map.jumpTo(cam) : st.map.flyTo(Object.assign(cam, { duration: 2200, essential: true }));
    if (st.modo) { const m = st.modo; st.modo = null; alternarModo(m, true); }
  }

  /* ---------- modos 1 km ---------- */
  function limparModo() {
    st.markers.forEach(m => m.remove()); st.markers = [];
    if (st.popup) { st.popup.remove(); st.popup = null; }
    const src = st.map.getSource("fm-raio"); if (src) src.setData({ type: "FeatureCollection", features: [] });
    $("#fm-painel").hidden = true;
    document.querySelectorAll("#fm-bar .fm-acao").forEach(b => b.classList.remove("is-active"));
  }
  function vizinhos() {
    const c = [st.loja.lon, st.loja.lat];
    return st.dados.sites.filter(s => s.id !== st.loja.site_id)
      .map(s => Object.assign({ d: dist(c, [s.lon, s.lat]) }, s)).filter(s => s.d <= RAIO_M).sort((a, b) => a.d - b.d);
  }
  function alternarModo(modo, keepCam) {
    if (!st.loja) return;
    const mesmo = st.modo === modo;
    limparModo(); st.modo = null;
    if (mesmo) return;
    st.modo = modo;
    document.querySelector(`#fm-bar .fm-acao[data-modo="${modo}"]`).classList.add("is-active");
    const c = [st.loja.lon, st.loja.lat];
    st.map.getSource("fm-raio").setData({ type: "FeatureCollection", features: [circulo(c, RAIO_M)] });
    st.map.setPaintProperty("fm-raio-fill", "fill-color", modo === "promo" ? FM.red : FM.blue);
    st.map.setPaintProperty("fm-raio-line", "line-color", modo === "promo" ? FM.red : FM.blue);
    const viz = vizinhos();
    const lista = modo === "promo" ? viz.filter(s => (st.promos.por_site[s.id] || []).length) : viz;
    for (const s of lista) {
      const el = document.createElement("button");
      el.type = "button";
      if (modo === "promo") {
        const n = st.promos.por_site[s.id].length;
        el.className = "fm-pin-promo";
        el.innerHTML = `<span class="tag">%</span><span class="txt">aqui tem promoção</span><span class="n">${n}</span>`;
      } else {
        el.className = "fm-pin-perto" + (s.model.startsWith("farmais") ? " is-farmais" : "");
        el.innerHTML = `<span class="dot">✚</span><span class="nome">${esc(s.titulo)}</span><span class="km">${Math.round(s.d)} m</span>`;
      }
      el.addEventListener("click", ev => { ev.stopPropagation(); abrirCard(s, modo); });
      st.markers.push(new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -14] }).setLngLat(s.front || [s.lon, s.lat]).addTo(st.map));
    }
    resumo(modo, lista);
    if (!keepCam) enquadrarRaio(false);
  }
  function enquadrarRaio(jump) {
    if (!st.loja) return;
    const c = [st.loja.lon, st.loja.lat], dx = RAIO_M / (111320 * Math.cos(c[1] * Math.PI / 180)), dy = RAIO_M / 110574;
    const narrow = window.innerWidth < 820;
    st.map.fitBounds([[c[0] - dx, c[1] - dy], [c[0] + dx, c[1] + dy]], { padding: { top: 70, bottom: 210, left: 50, right: narrow ? 50 : 340 },
      pitch: 30, bearing: 0, duration: jump ? 0 : 1800, essential: true });
  }
  st.enquadrarRaio = enquadrarRaio;
  function htmlPromos(s) {
    const ps = st.promos.por_site[s.id] || [];
    if (!ps.length) return `<p class="fm-vazio">Nenhuma promoção válida registrada no radar.</p>`;
    return `<table class="fm-promos"><thead><tr><th>Produto</th><th>Preço</th><th>Condição</th><th>Validade</th><th>Fonte</th></tr></thead><tbody>${ps.map(p =>
      `<tr><td>${esc(p.produto)}</td><td class="pr">${p.preco ? "R$ " + esc(p.preco) : "—"}</td><td>${esc(p.condicao || "—")}</td><td>${esc(p.validade || "não informada")}</td><td>${p.fonte && /^https?:/.test(p.fonte) ? `<a href="${esc(p.fonte)}" target="_blank" rel="noopener">abrir</a>` : esc(p.fonte || "—")}</td></tr>`).join("")}</tbody></table>`;
  }
  function htmlContato(s) {
    const e = s.entradas[0] || {};
    const ig = e.instagram ? (/^https?:/.test(e.instagram) ? e.instagram : "https://instagram.com/" + e.instagram.replace(/^@/, "")) : null;
    const igTxt = e.instagram ? "@" + e.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/?].*$/, "").replace(/^@/, "") : null;
    return `<dl class="fm-ficha">
      <dt>Endereço</dt><dd>${esc(e.endereco || "—")}</dd>
      <dt>Distância</dt><dd>${s.d != null ? Math.round(s.d) + " m da FARMAIS " + esc(st.loja.curto) : "—"}</dd>
      <dt>Telefone</dt><dd>${e.telefone ? `<a href="tel:${esc(e.telefone.replace(/\D/g, ""))}">${esc(e.telefone)}</a>` : "—"}</dd>
      <dt>Instagram</dt><dd>${ig ? `<a href="${esc(ig)}" target="_blank" rel="noopener">${esc(igTxt)}</a>` : "—"}</dd>
      <dt>Site</dt><dd>${e.site ? `<a href="${esc(e.site)}" target="_blank" rel="noopener">${esc(e.site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>` : "—"}</dd>
    </dl>${s.entradas.length > 1 ? `<p class="fm-obs">Mesmo endereço também listado como: ${s.entradas.slice(1).map(x => esc(x.nome)).join(", ")}.</p>` : ""}`;
  }
  function abrirCard(s, modo) {
    if (st.popup) st.popup.remove();
    st.map.flyTo({ center: s.front || [s.lon, s.lat], zoom: 17.8, pitch: 58, bearing: -s.phi * 180 / Math.PI + 15, duration: 1600, essential: true, offset: [0, 120] });
    const n = (st.promos.por_site[s.id] || []).length;
    const html = `<div class="fm-card ${modo}"><header><span class="fm-card-kicker">${modo === "promo" ? n + " promoç" + (n === 1 ? "ão" : "ões") + " ativas" : "Farmácia a " + Math.round(s.d) + " m"}</span>
      <h3>${esc(s.titulo)}</h3></header>${modo === "promo" ? htmlPromos(s) + `<details><summary>Contato</summary>${htmlContato(s)}</details>` : htmlContato(s) + (n ? `<p class="fm-obs promo">Tem ${n} promoç${n === 1 ? "ão" : "ões"} no radar — veja em “Promoções próximo a mim”.</p>` : "")}</div>`;
    st.popup = new maplibregl.Popup({ maxWidth: modo === "promo" ? "560px" : "340px", offset: 48, className: "fm-popup", focusAfterOpen: false })
      .setLngLat(s.front || [s.lon, s.lat]).setHTML(html).addTo(st.map);
  }
  function resumo(modo, lista) {
    const p = $("#fm-painel");
    const tot = lista.reduce((a, s) => a + (st.promos.por_site[s.id] || []).length, 0);
    p.className = modo;
    p.innerHTML = `<header><b>${modo === "promo" ? "Promoções em 1 km" : "Farmácias em 1 km"}</b><span>FARMAIS ${esc(st.loja.curto)}</span>
      <button type="button" class="fm-x" aria-label="Fechar">×</button></header>
      <p class="fm-sum">${modo === "promo" ? `${lista.length} farmácia${lista.length === 1 ? "" : "s"} com promoção · ${tot} oferta${tot === 1 ? "" : "s"}` : `${lista.length} farmácia${lista.length === 1 ? "" : "s"} no raio de 1 km`}</p>
      <ol>${lista.map(s => `<li><button type="button" data-id="${esc(s.id)}"><span class="nm">${esc(s.titulo)}</span><span class="mt">${Math.round(s.d)} m${modo === "promo" ? " · " + st.promos.por_site[s.id].length + " promo" : ""}</span></button></li>`).join("") || `<li class="vazio">Nada encontrado no raio.</li>`}</ol>
      ${modo === "promo" ? `<p class="fm-nota">Fonte: radar de concorrentes (${esc(st.promos.gerado_em || "")}). Ofertas de rede valem para todas as lojas da rede, salvo indicação.</p>` : ""}`;
    p.hidden = false;
    p.querySelector(".fm-x").onclick = () => alternarModo(st.modo);
    p.querySelectorAll("li button").forEach(b => b.onclick = () => { const s = lista.find(x => x.id === b.dataset.id); abrirCard(s, modo); });
  }

  async function iniciar() {
    const S = window.__FOZ_CITY_SIM__;
    if (!S || !S.ready || !window.maplibregl) return setTimeout(iniciar, 300);
    const map = st.map = S.map;
    const [dados, promos, logo, icon] = await Promise.all([
      fetch("data/farmacias.json").then(r => r.json()),
      fetch("data/promocoes.json").then(r => r.ok ? r.json() : { por_site: {} }).catch(() => ({ por_site: {} })),
      img("img/farmais-logo.png"), img("img/farmais-icone.png")]);
    st.dados = dados; st.promos = promos;
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const modelos = construirModelos({ logo, icon });
    esconderPredios(map, dados);
    map.addLayer(camada(map, dados.sites, modelos), primeiroSimbolo(map));
    map.addSource("fm-raio", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "fm-raio-fill", type: "fill", source: "fm-raio", paint: { "fill-color": FM.red, "fill-opacity": 0.08 } }, primeiroSimbolo(map));
    map.addLayer({ id: "fm-raio-line", type: "line", source: "fm-raio", paint: { "line-color": FM.red, "line-width": 3, "line-dasharray": [2, 1.2], "line-opacity": 0.9 } });
    // visão geral (zoom baixo): um ponto por farmácia, FARMAIS em destaque
    const R = window.REDES, sl = map.getLayer("street-labels") ? map.getLayoutProperty("street-labels", "text-font") : null;
    const feats = dados.sites.map(s => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: { id: s.id, fm: s.model.startsWith("farmais") ? 1 : 0, cor: s.model.startsWith("farmais") ? FM.red : (s.rede && R[s.rede] ? (R[s.rede].bg === "#ffffff" ? R[s.rede].fg : R[s.rede].bg) : "#1f7a3e"),
        nome: s.model.startsWith("farmais") ? (dados.farmais.find(f => f.site_id === s.id) || {}).botao || "FARMAIS" : s.titulo } }));
    map.addSource("fm-pontos", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
    const fade = (a, b) => ["interpolate", ["linear"], ["zoom"], 15.4, a, 16.4, b];
    map.addLayer({ id: "fm-pontos", type: "circle", source: "fm-pontos", maxzoom: 16.4, filter: ["==", ["get", "fm"], 0],
      paint: { "circle-color": ["get", "cor"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.2, 12, 4.6, 15, 7],
        "circle-stroke-color": "#ffffff", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 14, 1.6], "circle-opacity": fade(1, 0), "circle-stroke-opacity": fade(1, 0) } });
    map.addLayer({ id: "fm-pontos-farmais", type: "circle", source: "fm-pontos", maxzoom: 16.4, filter: ["==", ["get", "fm"], 1],
      paint: { "circle-color": FM.red, "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 7, 12, 9, 15, 12],
        "circle-stroke-color": FM.blue, "circle-stroke-width": 3, "circle-opacity": fade(1, 0), "circle-stroke-opacity": fade(1, 0) } });
    if (sl) map.addLayer({ id: "fm-farmais-nomes", type: "symbol", source: "fm-pontos", maxzoom: 16.4, filter: ["==", ["get", "fm"], 1],
      layout: { "text-field": ["get", "nome"], "text-font": sl, "text-size": 13, "text-offset": [0, 1.3], "text-anchor": "top", "text-allow-overlap": true },
      paint: { "text-color": FM.blue, "text-halo-color": "#ffffff", "text-halo-width": 2, "text-opacity": fade(1, 0) } });
    montarBarra(dados.farmais);
    st.pronto = true;
    const q = new URLSearchParams(location.search);
    if (!q.get("loja")) visaoCidade(true);
    if (q.get("loja")) selecionarLoja(q.get("loja"), true);
    if (q.get("loja") && q.get("raio")) alternarModo(q.get("raio"), true);
  }
  iniciar();
})();
