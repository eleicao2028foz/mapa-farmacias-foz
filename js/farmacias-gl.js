/* Desenho WebGL dos prédios de farmácia: mesma iluminação dos veículos 3D (difusa + ambiente),
   texturas de canvas agrupadas por material. Usado no render das PNGs e na camada custom do MapLibre. */
(function (root) {
  "use strict";
  const VS = "precision highp float;attribute vec3 a_pos;attribute vec3 a_normal;attribute vec3 a_color;attribute vec2 a_uv;" +
    "uniform mat4 u_matrix;uniform vec3 u_light;varying vec3 v_color;varying vec2 v_uv;" +
    "void main(){vec3 n=normalize(a_normal);float l=0.70+0.30*max(dot(n,normalize(u_light)),0.0);" +
    "float grad=abs(n.z)<0.5?(0.92+0.08*clamp(a_pos.z/6.0,0.0,1.0)):1.0;" +
    "v_color=a_color*l*grad;v_uv=a_uv;gl_Position=u_matrix*vec4(a_pos,1.0);}";
  const FS = "precision mediump float;varying vec3 v_color;varying vec2 v_uv;uniform sampler2D u_tex;" +
    "void main(){vec4 t=texture2D(u_tex,v_uv);if(t.a<0.5)discard;gl_FragColor=vec4(t.rgb*v_color,1.0);}";

  /* flipY=true converte (leste,norte,cima) para o referencial local mercator (y para o sul). */
  function pack(B, flipY, rot) {
    const groups = {};
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    const tf = p => { const x = p[0] * c - p[1] * s, y = p[0] * s + p[1] * c; return [x, flipY ? -y : y, p[2]]; };
    for (const t of B.tris) {
      const k = t.tex || "__flat";
      (groups[k] = groups[k] || []);
      const n = tf(t.n);
      const order = flipY ? [0, 2, 1] : [0, 1, 2];
      for (const i of order) {
        const p = tf(t.p[i]);
        groups[k].push(p[0], p[1], p[2], n[0], n[1], n[2], t.c[0], t.c[1], t.c[2], t.uv[i][0], t.uv[i][1]);
      }
    }
    return groups;
  }

  function program(gl) {
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
    return { p, a: ["a_pos", "a_normal", "a_color", "a_uv"].map(n => gl.getAttribLocation(p, n)),
      m: gl.getUniformLocation(p, "u_matrix"), l: gl.getUniformLocation(p, "u_light"), t: gl.getUniformLocation(p, "u_tex") };
  }

  function upload(gl, B, groups) {
    const out = [];
    for (const [k, arr] of Object.entries(groups)) {
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (k === "__flat") gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, B.textures[k]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      out.push({ buf, tex, count: arr.length / 11 });
    }
    return out;
  }

  function draw(gl, prog, items, matrix, light) {
    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(prog.m, false, matrix);
    gl.uniform3fv(prog.l, light);
    gl.uniform1i(prog.t, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (const it of items) {
      gl.bindBuffer(gl.ARRAY_BUFFER, it.buf);
      const sizes = [3, 3, 3, 2], offs = [0, 3, 6, 9];
      prog.a.forEach((a, i) => { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, sizes[i], gl.FLOAT, false, 44, offs[i] * 4); });
      gl.bindTexture(gl.TEXTURE_2D, it.tex);
      gl.drawArrays(gl.TRIANGLES, 0, it.count);
    }
    prog.a.forEach(a => gl.disableVertexAttribArray(a));
  }

  // luz no referencial (leste, norte, cima): de oeste-sudoeste, alta (como veiculos-3d.js)
  const LIGHT_ENU = [-0.45, -0.28, 0.85];
  const LIGHT_MERC = [-0.45, 0.28, 0.85];

  /* Camada custom MapLibre: lugares = [{model: B, lon, lat, rot_deg}] */
  function createLayer(map, lugares, opts) {
    opts = opts || {};
    let gl, prog, origin, unit, objs = [];
    const mb = new Float32Array(16);
    return {
      id: opts.id || "farmacias-3d", type: "custom", renderingMode: "3d",
      onAdd(m, g) {
        gl = g; prog = program(gl);
        origin = root.maplibregl.MercatorCoordinate.fromLngLat(opts.anchor || [lugares[0].lon, lugares[0].lat]);
        unit = origin.meterInMercatorCoordinateUnits();
        objs = lugares.map(L => {
          const p = root.maplibregl.MercatorCoordinate.fromLngLat([L.lon, L.lat]);
          return { items: upload(gl, L.model, pack(L.model, true, -(L.rot_deg || 0) * Math.PI / 180)), dx: (p.x - origin.x) / unit, dy: (p.y - origin.y) / unit };
        });
      },
      render(g, matrix) {
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
        for (const o of objs) {
          for (let r = 0; r < 4; r++) {
            mb[r] = matrix[r] * unit; mb[4 + r] = matrix[4 + r] * unit; mb[8 + r] = matrix[8 + r] * unit;
            mb[12 + r] = matrix[r] * (origin.x + o.dx * unit) + matrix[4 + r] * (origin.y + o.dy * unit) + matrix[12 + r];
          }
          draw(gl, prog, o.items, mb, LIGHT_MERC);
        }
      },
    };
  }

  root.FozFarmaciasGL = { pack, program, upload, draw, createLayer, LIGHT_ENU, LIGHT_MERC };
})(typeof window !== "undefined" ? window : globalThis);
