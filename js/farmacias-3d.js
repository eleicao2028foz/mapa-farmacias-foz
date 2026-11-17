/* Prédios de farmácias low-poly para o mapa de Foz (mesmo desenho dos veículos 3D e dos prédios cívicos).
   Eixos locais: x = leste/direita, y = norte/fundo (fachada principal virada para -Y), z = cima. Metros.
   Cada modelo devolve {verts: Float32Array [x,y,z, nx,ny,nz, r,g,b, u,v], textures: {nome: canvas}}.
   As faces lisas usam a cor do vértice; as fachadas/letreiros usam texturas de canvas (como predios.js). */
(function (root) {
  "use strict";
  const FONT = '"CivicSign", "Archivo Black", "DejaVu Sans", sans-serif';

  function rgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); }
  function shade(hex, f) {
    return "#" + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)))
      .toString(16).padStart(2, "0")).join("");
  }
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  function builder() {
    const tris = [];      // {p:[[...]x3], n, c, uv:[[u,v]x3], tex}
    const textures = {};
    function addPoly(points, color, tex, uvs) {
      const c = rgb(color || "#ffffff"), a = points[0];
      const u = points[1].map((v, i) => v - a[i]);
      const v = points[2].map((vv, i) => vv - a[i]);
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(x => x / len);
      for (let i = 1; i < points.length - 1; i++)
        tris.push({ p: [a, points[i], points[i + 1]], n, c, tex: tex || null,
          uv: uvs ? [uvs[0], uvs[i], uvs[i + 1]] : [[0, 0], [0, 0], [0, 0]] });
    }
    function face(points, color) { addPoly(points, color); }
    function box(x, y, z, w, l, h, color, top) {
      const a = x - w / 2, b = x + w / 2, d = y - l / 2, e = y + l / 2, f = z + h;
      face([[a, d, z], [a, e, z], [b, e, z], [b, d, z]], color);
      face([[a, d, f], [b, d, f], [b, e, f], [a, e, f]], top || color);
      face([[a, d, z], [b, d, z], [b, d, f], [a, d, f]], color);
      face([[b, e, z], [a, e, z], [a, e, f], [b, e, f]], color);
      face([[a, e, z], [a, d, z], [a, d, f], [a, e, f]], color);
      face([[b, d, z], [b, e, z], [b, e, f], [b, d, f]], color);
    }
    function cyl(x, y, z, r, h, color, n) {
      n = n || 10;
      const ring = i => [x + Math.cos(i * 2 * Math.PI / n) * r, y + Math.sin(i * 2 * Math.PI / n) * r];
      const top = [], bot = [];
      for (let i = 0; i < n; i++) {
        const p = ring(i), q = ring(i + 1);
        face([[p[0], p[1], z], [q[0], q[1], z], [q[0], q[1], z + h], [p[0], p[1], z + h]], color);
        top.push([p[0], p[1], z + h]);
      }
      face(top, color);
    }
    /* Quad texturizado: p0 base-esq, p1 base-dir, p2 topo-dir, p3 topo-esq (vistos de fora). */
    function quad(p0, p1, p2, p3, texName, tint) {
      addPoly([p0, p1, p2, p3], tint || "#ffffff", texName, [[0, 1], [1, 1], [1, 0], [0, 0]]);
    }
    /* Painel em uma face de caixa: side = 'S','N','E','W'; u0/u1 ao longo da face, z0/z1 altura. */
    function panel(bx, side, u0, u1, z0, z1, texName, off) {
      off = off == null ? 0.03 : off;
      const [x, y, w, l] = bx;
      const xa = x - w / 2, xb = x + w / 2, ya = y - l / 2, yb = y + l / 2;
      let p0, p1;
      if (side === "S") { p0 = [xa + u0, ya - off]; p1 = [xa + u1, ya - off]; }
      if (side === "N") { p0 = [xb - u0, yb + off]; p1 = [xb - u1, yb + off]; }
      if (side === "E") { p0 = [xb + off, ya + u0]; p1 = [xb + off, ya + u1]; }
      if (side === "W") { p0 = [xa - off, yb - u0]; p1 = [xa - off, yb - u1]; }
      quad([p0[0], p0[1], z0], [p1[0], p1[1], z0], [p1[0], p1[1], z1], [p0[0], p0[1], z1], texName);
    }
    function roofPanel(x, y, z, w, l, texName) {
      quad([x - w / 2, y - l / 2, z], [x + w / 2, y - l / 2, z], [x + w / 2, y + l / 2, z], [x - w / 2, y + l / 2, z], texName);
    }
    function texture(name, w, h, draw) {
      if (!textures[name]) { const c = mkCanvas(w, h); const g = c.getContext("2d"); draw(g, w, h); textures[name] = c; }
      return name;
    }
    return { face, box, cyl, quad, panel, roofPanel, texture, tris, textures };
  }

  /* ---------- pintura das texturas (mesma linguagem de predios.js) ---------- */
  const PX = 24; // px por metro nas texturas "retrô"

  function paintStorefront(g, w, h, o) {
    // vitrine: vidro + caixilhos + porta central, estilo pixel
    g.imageSmoothingEnabled = false;
    g.fillStyle = o.wall || "#f2efe8"; g.fillRect(0, 0, w, h);
    const fr = o.frame || "#3f4a52", glass = o.glass || "#5f8f9a";
    const top = Math.round(h * 0.08), bot = h - Math.round(h * 0.07);
    g.fillStyle = fr; g.fillRect(0, top, w, bot - top);
    const n = Math.max(2, Math.round(w / (PX * 2.2)));
    const pw = w / n;
    for (let i = 0; i < n; i++) {
      const x0 = Math.round(i * pw + 3), x1 = Math.round((i + 1) * pw - 3);
      g.fillStyle = glass; g.fillRect(x0, top + 3, x1 - x0, bot - top - 6);
      g.fillStyle = "#a8c5c4"; g.fillRect(x0 + 4, top + 7, Math.max(3, (x1 - x0) * 0.12), (bot - top) * 0.55);
      g.fillStyle = "rgba(232,238,240,0.35)"; g.fillRect(x0 + (x1 - x0) * 0.55, top + 3, 3, bot - top - 6);
      // prateleiras vistas pelo vidro
      if (o.shelves !== false) {
        for (let k = 0; k < 3; k++) {
          g.fillStyle = ["#e9d9a6", "#f0b8b0", "#c9e0f0"][k % 3];
          g.fillRect(x0 + 8, Math.round(top + (bot - top) * (0.45 + k * 0.16)), x1 - x0 - 16, 3);
        }
      }
    }
    if (o.door !== false) {
      const dw = PX * 1.8, dx = Math.round(w / 2 - dw / 2);
      g.fillStyle = fr; g.fillRect(dx - 3, top, dw + 6, bot - top);
      g.fillStyle = "#7fb0b8"; g.fillRect(dx, top + 4, dw / 2 - 2, bot - top - 4); g.fillRect(dx + dw / 2 + 2, top + 4, dw / 2 - 2, bot - top - 4);
      g.fillStyle = "#dfe9ea"; g.fillRect(dx + dw / 2 - 6, top + (bot - top) * 0.5, 3, 10); g.fillRect(dx + dw / 2 + 4, top + (bot - top) * 0.5, 3, 10);
    }
    g.fillStyle = o.base || "#8f8a80"; g.fillRect(0, bot, w, h - bot);
  }

  function paintWallWindows(g, w, h, o) {
    // andares superiores: mesmas janelas de paintWall (família 2)
    g.imageSmoothingEnabled = false;
    g.fillStyle = o.wall; g.fillRect(0, 0, w, h);
    const frame = o.frame || "#6f6a62", glass = o.glass || "#4f7c88";
    const dx = 40, y = Math.round(h * 0.28);
    for (let x = 12; x + 24 < w; x += dx) {
      g.fillStyle = frame; g.fillRect(x - 2, y - 2, 28, 26);
      g.fillStyle = glass; g.fillRect(x, y, 24, 22);
      g.fillStyle = "#a8c5c4"; g.fillRect(x + 2, y + 2, 6, 14);
      g.fillStyle = "#eee5c6"; g.fillRect(x + 12, y, 2, 22); g.fillRect(x - 2, y + 22, 28, 4);
    }
    g.fillStyle = shade(o.wall, 0.85); g.fillRect(0, h - 4, w, 4);
  }

  function signGrad(g, x, y, w, h) {
    const grd = g.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, "rgba(255,255,255,0.16)"); grd.addColorStop(0.45, "rgba(255,255,255,0.02)"); grd.addColorStop(1, "rgba(60,40,30,0.16)");
    g.fillStyle = grd; g.fillRect(x, y, w, h);
  }

  function paintTextSign(g, w, h, s) {
    g.fillStyle = s.bg; g.fillRect(0, 0, w, h);
    if (s.stripe) { g.fillStyle = s.stripe; g.fillRect(0, h - h * 0.14, w, h * 0.14); }
    signGrad(g, 0, 0, w, h);
    g.strokeStyle = s.border || "rgba(255,248,238,0.35)"; g.lineWidth = Math.max(4, h * 0.03);
    g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h * 0.88 - (s.stripe ? h * 0.12 : 0));
    const lines = s.lines || [s.text];
    let iconW = 0;
    if (s.cross) {   // cruz de farmácia à esquerda
      const cs = h * 0.62, cx = h * 0.18 + cs / 2, cy = h * 0.47;
      g.fillStyle = s.crossBg || "#ffffff";
      g.beginPath(); g.arc(cx, cy, cs / 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = s.cross; const t = cs * 0.22, L = cs * 0.66;
      g.fillRect(cx - t / 2, cy - L / 2, t, L); g.fillRect(cx - L / 2, cy - t / 2, L, t);
      iconW = h * 0.18 + cs;
    }
    const avail = w - iconW - h * 0.3;
    const bandH = h * (s.stripe ? 0.84 : 1);
    const scales = s.scales || lines.map(() => 1);
    const tot = scales.reduce((a, b) => a + b, 0);
    let size = Math.floor(bandH * (lines.length > 1 ? 0.86 / (tot * 1.08) : 0.74));
    const fits = sz => lines.every((ln, i) => { g.font = "900 " + Math.round(sz * scales[i]) + "px " + FONT; return g.measureText(ln).width <= avail; });
    while (size > 10 && !fits(size)) size -= 2;
    g.textAlign = "center"; g.textBaseline = "middle";
    const cx = iconW + (w - iconW) / 2;
    const blockH = scales.reduce((a, k) => a + size * k * 1.08, 0);
    let y = bandH / 2 - blockH / 2;
    g.shadowColor = "rgba(50,30,22,0.28)"; g.shadowBlur = Math.max(2, size * 0.03); g.shadowOffsetY = Math.max(2, size * 0.025);
    lines.forEach((ln, i) => {
      const sz = Math.round(size * scales[i]);
      g.font = "900 " + sz + "px " + FONT;
      g.fillStyle = Array.isArray(s.fg) ? s.fg[i] : s.fg;
      g.fillText(ln, cx, y + sz * 1.08 / 2 + sz * 0.04);
      y += sz * 1.08;
    });
    g.shadowBlur = 0; g.shadowOffsetY = 0;
  }

  function paintRoofFlat(g, w, h, o) {
    g.imageSmoothingEnabled = false;
    g.fillStyle = o.roof; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.28)"; g.fillRect(0, 0, w, 6); g.fillRect(0, 0, 6, h);
    g.fillStyle = "rgba(90,100,100,0.22)"; g.fillRect(w - 8, 0, 8, h); g.fillRect(0, h - 8, w, 8);
  }

  function paintImage(g, w, h, img, bg, pad) {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    signGrad(g, 0, 0, w, h);
    pad = pad == null ? 0.08 : pad;
    const ar = img.width / img.height;
    let dh = h * (1 - 2 * pad), dw = dh * ar;
    if (dw > w * (1 - 2 * pad)) { dw = w * (1 - 2 * pad); dh = dw / ar; }
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function paintRoundIcon(g, w, h, img, ring) {
    g.clearRect(0, 0, w, h);
    g.save(); g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); g.closePath();
    g.fillStyle = ring || "#ffffff"; g.fill(); g.restore();
    g.save(); g.beginPath(); g.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2); g.clip();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(img, w / 2 - w * 0.465, h / 2 - h * 0.465, w * 0.93, h * 0.93); g.restore();
  }

  function paintGreenCross(g, w, h, o) {
    g.clearRect(0, 0, w, h);
    const t = w * 0.34, m = (w - t) / 2;
    const glow = o && o.glow;
    g.fillStyle = (o && o.edge) || "#e8f5e9";
    g.fillRect(m - 8, 0, t + 16, h); g.fillRect(0, m - 8, w, t + 16);
    g.fillStyle = (o && o.color) || "#1fa44a";
    g.fillRect(m, 8, t, h - 16); g.fillRect(8, m, w - 16, t);
    if (glow) { g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(m + 6, 14, t * 0.25, h - 28); }
  }

  /* ---------- peças comuns ---------- */
  const PAD = "#d7ccb6", CURB = "#efe6d2", ROOF = "#b9b6ad";

  function ground(B, w, l, color) {
    B.box(0, 0, 0, w, l, 0.12, color || PAD);
  }
  function acUnits(B, list) {
    list.forEach(([x, y, z]) => { B.box(x, y, z, 1.1, 0.8, 0.55, "#c7c9c6", "#dadcd8"); B.box(x, y - 0.41, z + 0.12, 0.7, 0.02, 0.3, "#8f9592"); });
  }
  function awning(B, x, y, z, w, depth, color, edge) {
    B.box(x, y - depth / 2, z, w, depth, 0.32, color);
    if (edge) B.box(x, y - depth + 0.03, z - 0.02, w + 0.02, 0.08, 0.2, edge);
  }

  /* ---------- FARMAIS ---------- */
  const FM = { blue: "#00428F", blueDark: "#002a63", red: "#DF2110", white: "#ffffff", yellow: "#FFC83D" };

  function farmaisSignTextures(B, A) {
    B.texture("fm-band", 1536, 256, g => paintImage(g, 1536, 256, A.logo, FM.blue, 0.03));
    B.texture("fm-logo-sq", 1024, 384, g => paintImage(g, 1024, 384, A.logo, FM.white, 0.05));
    B.texture("fm-icon", 512, 512, g => paintRoundIcon(g, 512, 512, A.icon, FM.white));
    B.texture("fm-logo-v", 1024, 832, g => paintImage(g, 1024, 832, A.logo, FM.blue, 0.06));
    B.texture("fm-side", 128, 512, g => { g.fillStyle = FM.blue; g.fillRect(0, 0, 128, 512); g.fillStyle = FM.red; g.fillRect(0, 400, 128, 40); });
    B.texture("fm-roofmark", 512, 512, g => { g.fillStyle = FM.blue; g.fillRect(0, 0, 512, 512); paintRoundIcon(g, 512, 512, A.icon, FM.white); });
  }

  function farmaisTotem(B, x, y, H) {
    // totem alto: haste azul + cabeça com logo nas duas faces + ícone redondo no topo
    B.box(x, y, 0.1, 0.5, 0.5, H - 3.0, FM.blueDark);
    const bx = [x, y, 2.6, 0.7];
    B.box(x, y, H - 3.0, 2.6, 0.7, 2.2, FM.blue);
    B.box(x, y, H - 3.05, 2.7, 0.8, 0.12, FM.red);
    B.panel(bx, "S", 0.08, 2.52, H - 2.9, H - 0.9, "fm-logo-v");
    B.panel(bx, "E", 0.05, 0.65, H - 2.9, H - 0.9, "fm-side");
    // disco do ícone
    B.cyl(x, y, H - 0.8, 0.08, 0.3, "#c8ccd2", 6);
    B.quad([x - 0.95, y - 0.02, H - 0.55], [x + 0.95, y - 0.02, H - 0.55], [x + 0.95, y - 0.02, H + 1.35], [x - 0.95, y - 0.02, H + 1.35], "fm-icon");
    B.quad([x + 0.95, y + 0.02, H - 0.55], [x - 0.95, y + 0.02, H - 0.55], [x - 0.95, y + 0.02, H + 1.35], [x + 0.95, y + 0.02, H + 1.35], "fm-icon");
  }

  function farmaisStoreBox(B, A, cx, cy, w, l, h, opts) {
    opts = opts || {};
    const bx = [cx, cy, w, l];
    B.texture("fm-store-" + w, Math.round(w * PX), Math.round(3.2 * PX), (g, W, H) => paintStorefront(g, W, H, { wall: "#f4f1ea", frame: FM.blueDark, glass: "#5d8fa0", base: "#7e8794" }));
    B.texture("fm-side-wall-" + l, Math.round(l * PX), Math.round(h * PX), (g, W, H) => {
      g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, W, H);
      g.fillStyle = FM.blue; g.fillRect(0, H * 0.72, W, H * 0.10);
      g.fillStyle = FM.red; g.fillRect(0, H * 0.82, W, H * 0.04);
      g.fillStyle = "#7e8794"; g.fillRect(0, H - 5, W, 5);
    });
    // volume principal (branco), platibanda azul com faixa vermelha
    B.box(cx, cy, 0.12, w, l, h, "#f4f1ea", ROOF);
    B.box(cx, cy, h + 0.12, w + 0.2, l + 0.2, 0.55, FM.blue, FM.blue);
    B.box(cx, cy, h + 0.12, w - 0.5, l - 0.5, 0.58, ROOF);
    B.box(cx, cy - l / 2 - 0.06, h - 0.1, w + 0.22, 0.14, 0.22, FM.red);
    // vitrine e letreiro com logo oficial
    B.panel(bx, "S", 0.0, w, 0.12, 3.3, "fm-store-" + w);
    B.box(cx, cy - l / 2 - 0.12, 3.35, w + 0.1, 0.24, h - 3.35 - 0.1, FM.blue);
    const sw = Math.min(w - 0.6, (h - 3.55) * 6.0);
    B.panel([cx, cy - 0.24, w + 0.1, l], "S", (w + 0.1 - sw) / 2, (w + 0.1 + sw) / 2, 3.45, 3.45 + sw / 6.0, "fm-band");
    // marquise azul com bordo vermelho
    awning(B, cx, cy - l / 2 - 0.24, 3.05, w + 0.6, 1.5, FM.blue, FM.red);
    // lateral leste com faixas da marca
    B.panel(bx, "E", 0, l, 0.12, h + 0.12, "fm-side-wall-" + l);
    if (opts.sideLogo !== false) B.panel(bx, "E", l * 0.25, l * 0.25 + Math.min(l * 0.5, 5.2), h - 2.2, h - 2.2 + Math.min(l * 0.5, 5.2) / 2.67, "fm-logo-sq", 0.05);
    // cruz FARMAIS pintada na laje (lida de cima)
    if (opts.roofMark !== false) {
      const s = Math.min(w, l) * (opts.roofScale || 0.55);
      B.roofPanel(cx + (opts.roofDx || 0), cy + (opts.roofDy || 0), h + 0.72, s, s, "fm-roofmark");
    }
  }

  function farmaisRua(A) {
    const B = builder();
    farmaisSignTextures(B, A);
    ground(B, 20, 19);
    B.box(0, -8.6, 0.12, 20, 1.8, 0.04, CURB);
    const w = 15, l = 12, h = 6.2;
    farmaisStoreBox(B, A, 0.6, 1.2, w, l, h);
    acUnits(B, [[-4.6, 5.2, h + 0.7], [-2.7, 5.2, h + 0.7]]);
    // totem e floreiras
    farmaisTotem(B, -8.3, -7.0, 8.5);
    B.box(7.3, -6.7, 0.12, 2.6, 0.9, 0.45, "#c8b89a", "#7fae4e");
    B.box(-4.2, -6.7, 0.12, 2.6, 0.9, 0.45, "#c8b89a", "#7fae4e");
    return B;
  }

  function gasCanopy(B, cx, cy, w, l, z) {
    // posto genérico (sem bandeira): cobertura branca/cinza, bombas e ilhas
    [[-w / 2 + 1.5, -l / 2 + 1.8], [w / 2 - 1.5, -l / 2 + 1.8], [-w / 2 + 1.5, l / 2 - 1.8], [w / 2 - 1.5, l / 2 - 1.8]].forEach(([x, y]) => B.box(cx + x, cy + y, 0.12, 0.45, 0.45, z, "#d9d9d6"));
    B.box(cx, cy, z, w, l, 0.95, "#f1f1ee", "#e4e4df");
    B.box(cx, cy - l / 2 - 0.02, z + 0.25, w + 0.04, 0.06, 0.45, "#5b6470");
    B.box(cx + w / 2 + 0.02, cy, z + 0.25, 0.06, l + 0.04, 0.45, "#5b6470");
    for (let i = -1; i <= 1; i += 2) {
      B.box(cx + i * w * 0.22, cy, 0.12, 1.2, l * 0.55, 0.22, "#c9c4b8");
      [-1, 1].forEach(j => {
        B.box(cx + i * w * 0.22, cy + j * l * 0.14, 0.34, 0.75, 0.55, 1.75, "#e9e7e2");
        B.box(cx + i * w * 0.22, cy + j * l * 0.14 - 0.28, 1.25, 0.55, 0.02, 0.45, "#3f4a52");
        B.box(cx + i * w * 0.22, cy + j * l * 0.14, 2.09, 0.8, 0.6, 0.12, "#8f969c");
      });
    }
  }

  function farmaisPosto(A) {
    const B = builder();
    farmaisSignTextures(B, A);
    ground(B, 34, 24, "#cfc8bb");
    B.box(0, -11.1, 0.12, 34, 1.8, 0.04, CURB);
    // asfalto do pátio
    B.box(-5, -2, 0.13, 22, 16, 0.02, "#77736d");
    gasCanopy(B, -5.5, -2.5, 16, 10.5, 5.3);
    // loja FARMAIS anexa ao posto
    farmaisStoreBox(B, A, 11.0, 4.0, 10, 9, 5.0, { sideLogo: true });
    farmaisTotem(B, 15.0, -8.8, 8.0);
    return B;
  }

  function farmaisMercado(A) {
    const B = builder();
    farmaisSignTextures(B, A);
    B.texture("mk-wall", 30 * PX, 9 * PX, (g, W, H) => {
      g.fillStyle = "#e6dccb"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#cdbfa8"; for (let x = 0; x < W; x += PX * 3) g.fillRect(x, 0, 4, H);
      g.fillStyle = "#8f8a80"; g.fillRect(0, H - 6, W, 6);
    });
    B.texture("mk-sign", 1600, 256, g => paintTextSign(g, 1600, 256, { bg: "#3b4a3f", fg: "#fff8ee", text: "SUPERMERCADO" }));
    B.texture("mk-entr", 8 * PX, Math.round(3.2 * PX), (g, W, H) => paintStorefront(g, W, H, { wall: "#e6dccb", frame: "#3f4a52", glass: "#5f8f9a", base: "#8f8a80", shelves: false }));
    ground(B, 38, 30, "#cfc8bb");
    B.box(0, -14.1, 0.12, 38, 1.8, 0.04, CURB);
    // galpão do supermercado (neutro, sem bandeira)
    const sx = -2, sy = 4, sw = 32, sl = 20, sh = 8.5;
    B.box(sx, sy, 0.12, sw, sl, sh, "#e6dccb", ROOF);
    B.box(sx, sy, sh + 0.12, sw + 0.2, sl + 0.2, 0.5, "#cdbfa8", "#cdbfa8");
    B.box(sx, sy, sh + 0.12, sw - 0.4, sl - 0.4, 0.52, ROOF);
    B.panel([sx, sy, sw, sl], "S", 0, sw, 0.12, sh + 0.12, "mk-wall");
    B.panel([sx, sy, sw, sl], "E", 0, sl, 0.12, sh + 0.12, "mk-wall");
    B.panel([sx, sy, sw, sl], "S", 3, 11, 0.12, 3.3, "mk-entr", 0.05);
    B.box(sx - 9, sy - sl / 2 - 0.15, 5.4, 12.5, 0.3, 2.3, "#3b4a3f");
    B.panel([sx - 9, sy - 0.3, 12.5, sl], "S", 0.2, 12.3, 5.5, 7.6, "mk-sign", 0.04);
    awning(B, sx - 9, sy - sl / 2, 3.4, 10, 2.2, "#7a8a7e", null);
    acUnits(B, [[-12, 9, sh + 0.64], [-9, 9, sh + 0.64], [-6, 9, sh + 0.64], [6, 10, sh + 0.64]]);
    // módulo FARMAIS saliente na frente do mercado (loja dentro do mercado com fachada própria)
    farmaisStoreBox(B, A, 7.5, -8.4, 11, 4.8, 5.2, { sideLogo: false, roofMark: true });
    farmaisTotem(B, 15.5, -12.0, 8.5);
    // carrinhos/vagas
    for (let i = 0; i < 5; i++) B.box(-16 + i * 2.8, -12.2, 0.13, 0.12, 4.0, 0.02, "#f4efe2");
    return B;
  }

  /* ---------- concorrentes (redes) ---------- */
  function chainStore(spec) {
    // spec: {id, name, lines, bg, fg, accent, wall, floors, w, l, awning, cross}
    const B = builder();
    const w = spec.w || 13, l = spec.l || 11, floors = spec.floors || 1;
    const h1 = 5.3, h = h1 + (floors - 1) * 3.2;
    ground(B, w + 4, l + 5);
    B.box(0, -(l + 5) / 2 + 0.9, 0.12, w + 4, 1.8, 0.04, CURB);
    const cx = 0, cy = 0.8, bx = [cx, cy, w, l];
    const wall = spec.wall || "#f2efe8";
    B.texture("store", Math.round(w * PX), Math.round(3.2 * PX), (g, W, H) => paintStorefront(g, W, H, { wall, frame: spec.frame || "#3f4a52", glass: "#5f8f9a", base: "#8f8a80" }));
    if (floors > 1) B.texture("upper", Math.round(w * PX), Math.round(3.2 * PX), (g, W, H) => paintWallWindows(g, W, H, { wall, frame: shade(wall, 0.6) }));
    B.texture("side", Math.round(l * PX), Math.round(h * PX), (g, W, H) => {
      g.fillStyle = wall; g.fillRect(0, 0, W, H);
      g.fillStyle = spec.bg; g.fillRect(0, (h + 0.12 - h1) * PX, W, (h1 - 3.35) * PX);
      if (spec.accent) { g.fillStyle = spec.accent; g.fillRect(0, (h + 0.12 - 3.35) * PX - 6, W, 6); }
      g.fillStyle = "#8f8a80"; g.fillRect(0, H - 5, W, 5);
    });
    const sgH = Math.round(1600 * (h1 + 0.1 - 3.4) / (w - 0.14));
    B.texture("sign", 1600, sgH, g => paintTextSign(g, 1600, sgH, { bg: spec.bg, fg: spec.fg, lines: spec.lines, scales: spec.scales, stripe: spec.accent, cross: spec.cross, crossBg: spec.crossBg, border: spec.border }));
    B.box(cx, cy, 0.12, w, l, h, wall, ROOF);
    B.box(cx, cy, h + 0.12, w + 0.16, l + 0.16, 0.45, spec.parapet || shade(wall, 0.92));
    B.box(cx, cy, h + 0.12, w - 0.4, l - 0.4, 0.47, ROOF);
    B.panel(bx, "S", 0, w, 0.12, 3.3, "store");
    for (let f = 1; f < floors; f++) B.panel(bx, "S", 0, w, h1 + 0.12 + (f - 1) * 3.2, h1 + 0.12 + f * 3.2, "upper");
    B.panel(bx, "E", 0, l, 0.12, h + 0.12, "side");
    // letreiro de fachada
    B.box(cx, cy - l / 2 - 0.1, 3.35, w + 0.06, 0.2, h1 - 3.35 + 0.1, spec.bg);
    B.panel([cx, cy - 0.2, w + 0.06, l], "S", 0.1, w - 0.04, 3.4, h1 + 0.1, "sign");
    if (spec.awning) awning(B, cx, cy - l / 2 - 0.2, 3.0, w + 0.4, 1.2, spec.awning, spec.accent || null);
    acUnits(B, [[-w * 0.25, cy + l * 0.25, h + 0.6], [w * 0.15, cy + l * 0.3, h + 0.6]]);
    B.roofPanel(cx + w * 0.2, cy - l * 0.05, h + 0.6, Math.min(w, l) * 0.3, Math.min(w, l) * 0.3, "roofmark");
    B.texture("roofmark", 256, 256, g => { g.fillStyle = spec.bg; g.fillRect(0, 0, 256, 256); g.fillStyle = spec.fg instanceof Array ? spec.fg[0] : spec.fg; g.font = "900 120px " + FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(spec.mono || spec.name[0], 128, 136); });
    return B;
  }

  /* ---------- independente genérica ---------- */
  function independente(v) {
    const B = builder();
    const V = [
      { w: 8, l: 10, wall: "#efe3c8", awn: "#2f8a4c", bg: "#ffffff", fg: "#1f7a3e", text: "FARMÁCIA", roof: "pitched", tile: "#c26a4a" },
      { w: 9, l: 9, wall: "#dfe8e2", awn: "#1e6f8f", bg: "#1f7a3e", fg: "#ffffff", text: "DROGARIA", roof: "flat", floors: 2 },
      { w: 7, l: 9, wall: "#f3ead6", awn: "#c25a3a", bg: "#f7f3ea", fg: "#1f7a3e", text: "FARMÁCIA", roof: "flat" },
    ][v];
    const { w, l } = V; const floors = V.floors || 1; const h1 = 4.7, h = h1 + (floors - 1) * 3.0;
    ground(B, w + 4, l + 4.5);
    B.box(0, -(l + 4.5) / 2 + 0.9, 0.12, w + 4, 1.8, 0.04, CURB);
    const cx = 0, cy = 0.6, bx = [cx, cy, w, l];
    B.texture("store", Math.round(w * PX), Math.round(3.0 * PX), (g, W, H) => paintStorefront(g, W, H, { wall: V.wall, frame: "#4a4f45", glass: "#5f8f9a", base: "#8f8a80" }));
    if (floors > 1) B.texture("upper", Math.round(w * PX), Math.round(3.0 * PX), (g, W, H) => paintWallWindows(g, W, H, { wall: V.wall, frame: shade(V.wall, 0.6) }));
    const sgH = Math.round(1200 * (h1 - 3.5) / (w - 2.0));
    B.texture("sign", 1200, sgH, g => paintTextSign(g, 1200, sgH, { bg: V.bg, fg: V.fg, text: V.text, border: "rgba(31,122,62,0.35)" }));
    B.texture("cross", 256, 256, g => paintGreenCross(g, 256, 256, { glow: true }));
    B.box(cx, cy, 0.12, w, l, h, V.wall, ROOF);
    B.panel(bx, "S", 0, w, 0.12, 3.1, "store");
    if (floors > 1) B.panel(bx, "S", 0, w, h1 + 0.12, h1 + 3.12, "upper");
    B.panel(bx, "S", 0.25, w - 1.75, 3.45, h1 - 0.05, "sign");
    awning(B, cx, cy - l / 2 - 0.05, 2.85, w - 0.2, 0.9, V.awn, shade(V.awn, 0.75));
    if (V.roof === "pitched") {
      const z = h + 0.12, r = 2.0, x0 = cx - w / 2 - 0.25, x1 = cx + w / 2 + 0.25, y0 = cy - l / 2 - 0.12, y1 = cy + l / 2 + 0.25;
      B.face([[x0, y0, z], [x1, y0, z], [x1, cy, z + r], [x0, cy, z + r]], V.tile);
      B.face([[x1, y1, z], [x0, y1, z], [x0, cy, z + r], [x1, cy, z + r]], shade(V.tile, 0.9));
      B.face([[x1, y0, z], [x1, y1, z], [x1, cy, z + r]], V.wall);
      B.face([[x0, y1, z], [x0, y0, z], [x0, cy, z + r]], V.wall);
    } else {
      B.box(cx, cy, h + 0.12, w + 0.12, l + 0.12, 0.4, shade(V.wall, 0.9));
      B.box(cx, cy, h + 0.12, w - 0.3, l - 0.3, 0.42, ROOF);
      acUnits(B, [[cx - w * 0.2, cy + l * 0.2, h + 0.55]]);
    }
    // cruz verde em bandeira, perpendicular à fachada (lê de lado e de frente)
    const px = cx + w / 2 - 0.1, py = cy - l / 2 - 0.15, pz = h1 - 0.1;
    B.box(px, py - 0.5, pz + 0.6, 0.12, 1.0, 0.1, "#5b6470");
    const s = 1.5;
    B.box(px, py - 1.0 - 0.02, pz, 0.14, 0.04, s, "#1d7a3e");
    B.quad([px - s / 2, py - 1.06, pz - 0.15], [px + s / 2, py - 1.06, pz - 0.15], [px + s / 2, py - 1.06, pz - 0.15 + s], [px - s / 2, py - 1.06, pz - 0.15 + s], "cross");
    B.quad([px + 0.08, py - 1.0 - s / 2, pz - 0.15], [px + 0.08, py - 1.0 + s / 2, pz - 0.15], [px + 0.08, py - 1.0 + s / 2, pz - 0.15 + s], [px + 0.08, py - 1.0 - s / 2, pz - 0.15 + s], "cross");
    return B;
  }

  const CHAINS = {};  // preenchido por farmacias-redes.js / config
  root.FozFarmacias = { builder, farmaisRua, farmaisPosto, farmaisMercado, chainStore, independente, CHAINS, FM, shade };
})(typeof window !== "undefined" ? window : globalThis);
