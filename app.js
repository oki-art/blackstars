/* Academia Blackstars · app de gestión (PWA)
   Una sola página: el contenido cambia según la dirección (#/alumnas, #/caja...). */
'use strict';

const sb = supabase.createClient(window.BS_CONFIG.url, window.BS_CONFIG.key, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const $app = document.getElementById('app');
const S = { usuario: null, perfil: null, permisos: {}, admin: false, nombres: {}, noLeidas: 0 };

const MODULOS = [
  ['alumnas', 'Alumnas'], ['profesoras', 'Profesoras'], ['clases', 'Clases'],
  ['inscripciones', 'Inscripciones'], ['incidencias', 'Incidencias'], ['normas', 'Normas'],
  ['caja', 'Caja'], ['eventos', 'Eventos'], ['formularios', 'Formularios'],
  ['escuelas_amigas', 'Escuelas amigas'], ['logros', 'Logros'], ['iniciativas', 'Iniciativas'], ['documentos', 'Documentos']
];
const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_C = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_ABR = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const SEL_HOR = 'clase_horarios(dia_semana,hora_inicio,hora_fin)';
const METODOS = [['efectivo', 'Efectivo'], ['tarjeta', 'Tarjeta'], ['bizum', 'Bizum'], ['transferencia', 'Transferencia']];

/* ---------- utilidades ---------- */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (v) => (Number(v) || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
const pad = (n) => String(n).padStart(2, '0');
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const aFecha = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fechaLarga = (iso) => aFecha(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const fechaCorta = (iso) => iso ? aFecha(iso.slice(0, 10)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const hora = (t) => t ? t.slice(0, 5) : '';
const diaISO = (d = new Date()) => ((d.getDay() + 6) % 7) + 1;
const iniciales = (n) => String(n || '?').trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const edad = (iso) => { if (!iso) return null; const n = aFecha(iso), h = new Date(); let e = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) e--; return e; };
const toMin = (h) => { const [a, b] = String(h || '0:0').split(':').map(Number); return a * 60 + b; };
const horariosDe = (c) => (c.clase_horarios || []).slice().sort((a, b) => a.dia_semana - b.dia_semana || toMin(a.hora_inicio) - toMin(b.hora_inicio));
const ordenClase = (c) => { const h = horariosDe(c)[0]; return h ? h.dia_semana * 1440 + toMin(h.hora_inicio) : 99999; };
// "Lun y Mié · 17:00–18:00" (agrupa los días que comparten horario)
function textoHorario(c, largo = false) {
  const g = {};
  horariosDe(c).forEach((h) => { const k = `${hora(h.hora_inicio)}–${hora(h.hora_fin)}`; (g[k] = g[k] || []).push(h.dia_semana); });
  const n = largo ? DIAS : DIAS_ABR;
  const lista = (ds) => ds.length === 1 ? n[ds[0]] : ds.slice(0, -1).map((d) => n[d]).join(', ') + ' y ' + n[ds[ds.length - 1]];
  return Object.entries(g).map(([k, ds]) => `${lista(ds)} · ${k}`).join(' / ') || 'Sin horario';
}
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function ico(nombre, t = 20) {
  const p = {
    arriba: '<path d="M6 15l6-6 6 6"/>', abajo: '<path d="M6 9l6 6 6-6"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    subir: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    bajar: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v4h16v-4"/>',
    campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    volver: '<path d="M15 5l-7 7 7 7"/>', sig: '<path d="M9 5l7 7-7 7"/>', mas: '<path d="M12 5v14M5 12h14"/>',
    casa: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>', clases: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    alumnas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 6 4.8"/>',
    papelera: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    caja: '<rect x="2.5" y="6" width="19" height="13" rx="3"/><path d="M2.5 10h19"/><circle cx="16.5" cy="14.5" r="1.4"/>',
    puntos: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    ojo: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lapiz: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14 7l3 3"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    evento: '<path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.3l7.1-.7z"/>',
    normas: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/>', form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    escuela: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M10 21v-5h4v5"/>', llave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
    insc: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M16 11h6"/>',
    profe: '<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    wa: '<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.4z"/>', copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    trofeo: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
    euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  }[nombre] || '';
  return `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

function aviso(msg, error = false) {
  const el = document.getElementById('aviso');
  el.textContent = msg; el.className = 'ver' + (error ? ' error' : '');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => { el.className = ''; }, error ? 4500 : 2200);
}
function traducirError(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/coerce the result to a single JSON object|PGRST116/i.test(m)) return 'Esto ya no existe o no tienes acceso a ello.';
  if (/exclusion|conflicting key value violates exclusion/i.test(m)) return 'La sala ya está ocupada ese día a esa hora por otra clase.';
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer esto.';
  if (/evento_coordinadoras/i.test(m) && /duplicate key/i.test(m)) return 'Esa persona ya coordina este evento.';
  if (/inscripcion_activa_unica|duplicate key/i.test(m)) return 'Ese registro ya existe.';
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/hora_fin|check constraint/i.test(m)) return 'Revisa los datos: hay algún valor no válido (por ejemplo, la hora de fin antes que la de inicio).';
  if (/foreign key/i.test(m)) return 'No se puede: hay otros datos que dependen de este registro.';
  if (/PGRST205|Could not find the table|relation .* does not exist/i.test(m)) return 'Esta parte aún no está activada en la base de datos.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión. Inténtalo de nuevo.';
  return m;
}
async function q(promesa) {
  const { data, error } = await promesa;
  if (error) throw error;
  return data;
}

/* ---------- permisos ---------- */
const puedeVer = (m) => S.admin || !!(S.permisos[m] && S.permisos[m].puede_ver);
// Las profesoras nunca dan altas ni bajas en clases (eso es de recepción y administración), aunque se les marque por error
const puedeEditar = (m) => S.admin || (!(m === 'inscripciones' && esProfesora(S.permisos)) && !!(S.permisos[m] && S.permisos[m].puede_escribir));

async function cargarSesion() {
  const { data } = await sb.auth.getSession();
  S.usuario = data.session ? data.session.user : null;
  if (!S.usuario) return;
  const [perfil, permisos] = await Promise.all([
    q(sb.from('perfiles').select('*').eq('id', S.usuario.id).maybeSingle()),
    q(sb.from('permisos').select('*').eq('perfil_id', S.usuario.id))
  ]);
  S.perfil = perfil; S.admin = !!(perfil && perfil.rol === 'admin' && perfil.activo);
  S.permisos = {}; (permisos || []).forEach((p) => { S.permisos[p.modulo] = p; });
  S.cargadoEn = Date.now();
  if (S.admin) {
    const ps = await q(sb.from('perfiles').select('id,nombre'));
    S.nombres = {}; ps.forEach((p) => { S.nombres[p.id] = p.nombre; });
  }
}

/* ---------- plantilla de pantalla ---------- */
function cabecera(titulo, { sub = '', volver = null, insignia = null } = {}) {
  const izq = volver
    ? `<button class="volver" data-volver="${esc(volver)}" aria-label="Volver">${ico('volver')}</button>`
    : `<img class="logo" src="icons/logo.png" alt="Blackstars">`;
  // Insignia: el papel (Admin, Gestión, Profesora…) arriba y el nombre de pila debajo (dos líneas cortas)
  const nombrePila = S.perfil ? esc(String(S.perfil.nombre).trim().split(/\s+/)[0]) : '';
  const rol = insignia != null ? esc(insignia) : !nombrePila ? (S.admin ? 'Admin' : '')
    : `<small>${S.admin ? 'Admin' : papel(S.permisos)}</small>${nombrePila}`;
  // En "Ver como…" la campana solo se enseña (no abre tus avisos)
  const campana = !S.usuario ? '' : insignia == null ? `<a class="campana ${S.noLeidas ? 'con' : ''}" id="campana" href="#/avisos" aria-label="Avisos">${ico('campana', 22)}<i></i></a>`
    : `<span class="campana" aria-hidden="true">${ico('campana', 22)}<i></i></span>`;
  return `<header class="cab">${izq}<div class="t"><div class="sup">Academia Blackstars</div><h1>${esc(titulo)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="cab-der">${campana}${rol && !(volver && campana && insignia == null) ? `<span class="insignia${insignia == null && nombrePila ? ' dos' : ''}">${rol}</span>` : ''}</div></header>`;
}
function navegacion(activa, ver = puedeVer) {
  const items = [['inicio', 'Inicio', 'casa', null], ['clases', 'Clases', 'clases', 'clases'], ['alumnas', 'Alumnas', 'alumnas', 'alumnas'], ['caja', 'Caja', 'caja', 'caja'], ['mas', 'Más', 'puntos', null]];
  return `<nav class="nav" aria-label="Navegación">${items.filter((i) => !i[3] || ver(i[3])).map((i) => `<a href="#/${i[0]}" class="${activa === i[0] ? 'on' : ''}">${ico(i[2], 22)}${i[1]}</a>`).join('')}</nav>`;
}
// Ojito en las contraseñas: mientras se mantiene pulsado se ve lo escrito; al soltar se oculta otra vez
function ojoClaves() {
  $app.querySelectorAll('input[type="password"]:not([data-ojo])').forEach((inp) => {
    inp.dataset.ojo = '1';
    const caja = document.createElement('div'); caja.className = 'clave-ojo';
    inp.parentNode.insertBefore(caja, inp); caja.appendChild(inp);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ojo-btn'; b.setAttribute('aria-label', 'Mantén pulsado para ver la contraseña'); b.innerHTML = ico('ojo', 22);
    caja.appendChild(b);
    const ver = (si) => { inp.type = si ? 'text' : 'password'; b.classList.toggle('on', si); };
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ver(true); });
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((t) => b.addEventListener(t, () => ver(false)));
    b.addEventListener('keydown', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); ver(true); } });
    b.addEventListener('keyup', () => ver(false));
    b.addEventListener('contextmenu', (ev) => ev.preventDefault());
  });
}
function pintar(html, nav = null, botonMas = null) {
  $app.innerHTML = html + (botonMas ? `<button class="mas-flotante" aria-label="Añadir" data-ir="${esc(botonMas)}">${ico('mas', 26)}</button>` : '') + (nav !== false ? navegacion(nav) : '');
  window.scrollTo(0, 0);
  ojoClaves();
  if (document.getElementById('campana')) actualizarCampana();
}
// Punto de la campana: hay avisos sin leer
async function actualizarCampana() {
  try {
    const { count } = await sb.from('notificaciones').select('id', { count: 'exact', head: true }).is('leida_en', null);
    S.noLeidas = count || 0;
    const c = document.getElementById('campana'); if (c) c.classList.toggle('con', S.noLeidas > 0);
  } catch (e) { /* sin avisos todavía */ }
}
function fila({ href, ini, tit, det = '', der = '', iconoHtml = '' }) {
  return `<a class="fila" href="${esc(href)}">${iconoHtml || `<span class="ini">${esc(ini ?? iniciales(tit))}</span>`}<span class="txt"><div class="tit">${esc(tit)}</div>${det ? `<div class="det">${det}</div>` : ''}</span>${der}</a>`;
}
const vacio = (t) => `<div class="vacio">${t}</div>`;
const autorDe = (r) => S.admin && r && r.creado_por ? `<div class="autor">Registrado por ${esc(S.nombres[r.creado_por] || '¿?')} · ${fechaCorta(r.creado_en)}${r.modificado_por ? ` · Modificado por ${esc(S.nombres[r.modificado_por] || '¿?')} · ${fechaCorta(r.modificado_en)}` : ''}</div>` : '';
function sinPermiso() {
  pintar(cabecera('Sin acceso', { volver: '#/inicio' }) + `<main class="cont">${vacio('No tienes permiso para ver esta sección. Pídeselo a la administración.')}</main>`, 'mas');
}

/* ---------- formularios genéricos ---------- */
function campoHtml(c, valor) {
  if (c.tipo === 'html') return c.html;
  const id = 'f_' + c.k, v = valor ?? c.def ?? '';
  const req = c.req ? 'required' : '';
  let input;
  if (c.tipo === 'textarea') input = `<textarea id="${id}" name="${c.k}" ${req} placeholder="${esc(c.ph || '')}">${esc(v)}</textarea>`;
  else if (c.tipo === 'select') input = `<select id="${id}" name="${c.k}" ${req}>${c.vacio !== false ? `<option value="">${esc(c.vacio || '—')}</option>` : ''}${(c.opciones || []).map(([val, txt]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(txt)}</option>`).join('')}</select>`;
  else if (c.tipo === 'bool') return `<label class="check"><input type="checkbox" name="${c.k}" ${v === true || v === 'true' ? 'checked' : ''}><span>${esc(c.label)}</span></label>`;
  else {
    const tipo = { fecha: 'date', hora: 'time', numero: 'number', dinero: 'number', email: 'email', tel: 'tel' }[c.tipo] || 'text';
    const extra = c.tipo === 'dinero' ? 'step="0.01" min="0" inputmode="decimal"' : c.tipo === 'numero' ? 'step="any" inputmode="decimal"' : '';
    input = `<input id="${id}" name="${c.k}" type="${tipo}" value="${esc(tipo === 'time' ? hora(v) : v)}" ${req} ${extra} placeholder="${esc(c.ph || '')}">`;
  }
  return `<div class="campo"><label for="${id}">${esc(c.label)}${c.req ? ' *' : ''}</label>${input}${c.ayuda ? `<div class="ayuda">${esc(c.ayuda)}</div>` : ''}</div>`;
}
function leerForm(form, campos) {
  const fd = new FormData(form), out = {};
  campos.forEach((c) => {
    if (c.tipo === 'html') return;
    if (c.tipo === 'bool') { out[c.k] = form.elements[c.k].checked; return; }
    let v = fd.get(c.k); v = v == null ? '' : String(v).trim();
    if (v === '') out[c.k] = null;
    else if (c.tipo === 'numero' || c.tipo === 'dinero') out[c.k] = Number(v.replace(',', '.'));
    else out[c.k] = v;
  });
  return out;
}

/* Pantalla de alta / edición reutilizable */
async function pantallaForm({ titulo, tabla, modulo, campos, id = null, volver, despues, valoresIniciales = {}, transformar = (d) => d, alGuardar = null }) {
  if (!puedeEditar(modulo)) return sinPermiso();
  let reg = null;
  if (id) reg = await q(sb.from(tabla).select('*').eq('id', id).single());
  const vals = Object.assign({}, valoresIniciales, reg || {});
  pintar(cabecera(titulo, { volver }) + `<main class="cont"><form class="form tarjeta" id="frm">${campos.map((c) => campoHtml(c, vals[c.k])).join('')}
    <button class="btn pri ancho" type="submit">Guardar</button>
    ${id && S.admin ? '<button class="btn peligro ancho" type="button" id="borrar">Borrar definitivamente</button>' : ''}
  </form>${autorDe(reg)}</main>`, false);
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const datos = transformar(leerForm(form, campos), reg);
      const r = id
        ? await q(sb.from(tabla).update(datos).eq('id', id).select().single())
        : await q(sb.from(tabla).insert(datos).select().single());
      if (alGuardar) { try { await alGuardar(r); } catch (e2) { aviso(traducirError(e2), true); } }
      aviso('Guardado');
      location.hash = despues ? despues(r) : volver;
    } catch (e) { aviso(traducirError(e), true); btn.disabled = false; }
  };
  const b = document.getElementById('borrar');
  if (b) b.onclick = async () => {
    if (!confirm('¿Borrar definitivamente? No se puede deshacer.')) return;
    try { await q(sb.from(tabla).delete().eq('id', id)); aviso('Borrado'); location.hash = volver.replace(/\/[^/]+$/, '') || volver; }
    catch (e) { aviso(traducirError(e), true); }
  };
}

/* Opciones para desplegables */
async function opcionesProfesoras() { return (await q(sb.from('profesoras').select('id,nombre').eq('activa', true).order('nombre'))).map((p) => [p.id, p.nombre]); }
async function opcionesAlumnas() { return (await q(sb.from('alumnas').select('id,nombre,apellidos').eq('estado', 'activa').order('nombre'))).map((a) => [a.id, `${a.nombre} ${a.apellidos || ''}`.trim()]); }
async function opcionesClases(propias = true) {
  let r = sb.from('clases').select('id,nombre,' + SEL_HOR).eq('activa', true);
  if (propias) r = r.is('escuela_amiga_id', null);
  return (await q(r)).sort((a, b) => ordenClase(a) - ordenClase(b)).map((c) => [c.id, `${c.nombre} · ${textoHorario(c)}`]);
}
async function opcionesEscuelas() { return (await q(sb.from('escuelas_amigas').select('id,nombre').order('nombre'))).map((e) => [e.id, e.nombre]); }
const intentar = async (f) => { try { return await f(); } catch (e) { return []; } };

/* ======================================================================
   PANTALLAS
   ====================================================================== */

/* ---------- login ---------- */
function pantallaLogin() {
  $app.innerHTML = `<div class="login"><img class="logo-g" src="icons/logo.png" alt="Blackstars"><h1>Academia Blackstars</h1><p>Entra con tu correo y tu contraseña</p>
  <form class="form tarjeta" id="frm">
    <div class="campo"><label for="em">Correo</label><input id="em" type="email" autocomplete="username" required></div>
    <div class="campo"><label for="pw">Contraseña</label><input id="pw" type="password" autocomplete="current-password" required></div>
    <button class="btn pri ancho" type="submit">Entrar</button>
    <button class="btn sec ancho" type="button" id="olvido">He olvidado la contraseña</button>
  </form></div>`;
  ojoClaves();
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
    const { error } = await sb.auth.signInWithPassword({ email: form.em.value.trim(), password: form.pw.value });
    if (error) { aviso(traducirError(error), true); btn.disabled = false; btn.textContent = 'Entrar'; return; }
    await cargarSesion(); location.hash = '#/inicio'; router();
  };
  document.getElementById('olvido').onclick = async () => {
    const email = form.em.value.trim();
    if (!email) { aviso('Escribe primero tu correo', true); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/nueva-clave' });
    aviso(error ? traducirError(error) : 'Te hemos enviado un correo para cambiarla', !!error);
  };
}
function pantallaNuevaClave() {
  // Primera vez que entra con la contraseña que le dio la administración: tiene que poner la suya
  const primera = !!(S.usuario.user_metadata && S.usuario.user_metadata.cambiar_clave);
  pintar(cabecera(primera ? 'Crea tu contraseña' : 'Nueva contraseña', primera ? { sub: '¡Bienvenida a Blackstars!' } : { volver: '#/inicio' }) + `<main class="cont">
    ${primera ? '<div class="tarjeta"><p style="margin:0">Es tu primera vez en la app. Elige una contraseña tuya, que solo sepas tú. A partir de ahora entrarás con tu email y esta contraseña.</p></div>' : ''}
    <form class="form tarjeta" id="frm">
    <div class="campo"><label for="pw">Nueva contraseña</label><input id="pw" type="password" minlength="8" autocomplete="new-password" required><div class="ayuda">Mínimo 8 caracteres.</div></div>
    <button class="btn pri ancho">Guardar</button></form></main>`, false);
  document.getElementById('frm').onsubmit = async (ev) => {
    ev.preventDefault();
    const { data, error } = await sb.auth.updateUser({ password: ev.target.pw.value, data: { cambiar_clave: false } });
    if (error) aviso(traducirError(error), true); else { if (data && data.user) S.usuario = data.user; aviso('Contraseña guardada'); location.hash = '#/inicio'; router(); }
  };
}

/* ---------- inicio ---------- */
async function pantallaInicio(vista = null) {
  const hoy = hoyISO(), dia = diaISO();
  // vista = { profesora, permisos }: la administración ve el Inicio tal como lo vería esa profesora
  const ver = vista ? (m) => !!(vista.permisos[m] && vista.permisos[m].puede_ver) : puedeVer;
  const editar = vista ? (m) => !!(vista.permisos[m] && vista.permisos[m].puede_escribir) : puedeEditar;
  const profesora = vista ? esProfesora(vista.permisos) : !S.admin && esProfesora(S.permisos);
  // Todas las clases activas propias (a una profesora con "solo lo suyo" la base de datos solo le da las suyas).
  let consulta = sb.from('clases')
    .select('id,nombre,profesoras(nombre),inscripciones(count),' + SEL_HOR)
    .eq('activa', true).is('escuela_amiga_id', null);
  if (vista && profesora) consulta = consulta.eq('profesora_id', vista.profesora.id);
  const clases = ver('clases') ? await intentar(() => q(consulta)) : [];
  // Orden: empezando por la próxima clase de la semana (o la que está en curso).
  const ahora = new Date().toTimeString().slice(0, 5);
  const minutos = (h) => { const d = (h.dia_semana - dia + 7) % 7; return (d === 0 && hora(h.hora_fin) <= ahora ? 7 : d) * 1440 + toMin(hora(h.hora_inicio)); };
  // Cada clase se coloca según su próximo horario de la semana
  clases.forEach((c) => { c._h = horariosDe(c).sort((a, b) => minutos(a) - minutos(b))[0]; c._m = c._h ? minutos(c._h) : 1e9; });
  clases.sort((x, y) => x._m - y._m);
  const cuando = (c) => {
    const h = c._h; if (!h) return 'Sin horario';
    if (h.dia_semana === dia && hora(h.hora_fin) > ahora) return hora(h.hora_inicio) <= ahora ? 'Ahora' : 'Hoy';
    if (h.dia_semana === (dia % 7) + 1) return 'Mañana';
    return DIAS[h.dia_semana];
  };
  const n = clases.length;
  const tarjetas = clases.map((c, i) => {
    const alumnas = c.inscripciones && c.inscripciones[0] ? c.inscripciones[0].count : 0;
    const dias = [...new Set(horariosDe(c).map((h) => h.dia_semana))];
    const textoDias = dias.length ? (dias.length === 1 ? DIAS[dias[0]] : dias.slice(0, -1).map((d) => DIAS[d]).join(', ') + ' y ' + DIAS[dias[dias.length - 1]]) : 'Sin horario';
    return `<a class="clase-hero" href="#/clase/${c.id}">
    <div class="k"><span>${i === 0 ? 'Próxima clase · ' : ''}${cuando(c)}</span><span class="hora">${c._h ? hora(c._h.hora_inicio) : ''}</span></div>
    <h2>${esc(c.nombre)}</h2>
    <div class="ch-pie"><div class="ch-izq"><div class="ch-dias">${esc(textoDias)}</div><div class="ch-prof">Profesora ${esc(c.profesoras ? c.profesoras.nombre : 'sin asignar')}</div></div>
      <div class="ch-num"><span>Alumnas</span><b>${alumnas}</b></div></div></a>`;
  }).join('');
  const bloqueClases = !ver('clases') ? '' : n
    ? `<div class="slider"><div class="carrusel uno" id="carrusel">${tarjetas}</div>${n > 1 ? `<div class="puntos-slider" id="puntos">${clases.map((c, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>`
    : `<div class="clase-hero vacia"><div class="k"><span>Clases</span></div><h2>Aún no hay clases</h2><div class="d">${editar('clases') ? 'Crea la primera y aparecerá aquí.' : 'Cuando tengas clases asignadas aparecerán aquí.'}</div>
       ${editar('clases') ? `<a class="btn-hero" href="#/clase/nueva">${ico('mas', 16)} Crear clase</a>` : ''}</div>`;
  // Barra de Logros de la profesora (su progreso del mes)
  let barraLogros = '';
  if (profesora && ver('logros')) {
    const yo = vista ? vista.profesora : await miProfesora();
    if (yo) {
      const mes = mesDe();
      const retos = await intentar(() => q(sb.from('logros_retos').select('id').eq('mes', mes)));
      const hechos = retos.length ? await intentar(() => q(sb.from('logros_cumplidos').select('reto_id').eq('profesora_id', yo.id).in('reto_id', retos.map((r) => r.id)))) : [];
      const v = pct(hechos.length, retos.length * SEMANAS);
      barraLogros = `<a class="tarjeta logros-inicio" href="#/logros/profesora/${yo.id}"><div class="li-cab"><span><b>Mis logros</b> · ${nombreMes(mes)}</span><span class="li-pct">${v}%</span></div>${barra(v)}
        <div class="nota">${retos.length ? `${hechos.length} de ${retos.length * SEMANAS} conseguidos` : 'Aún no hay retos este mes'}</div></a>`;
    }
  }
  // Tarjeta de Documentos: lo pendiente de firmar o leer, y el historial
  let tarjetaDocs = '';
  if (!vista) {
    const pend = await intentar(async () => { const { count } = await sb.from('documentos').select('id', { count: 'exact', head: true }).eq('para_perfil', S.usuario.id).eq('estado', 'pendiente'); return count || 0; });
    tarjetaDocs = `<a class="tarjeta-docs" href="#/documentos"><span class="ico-caja">${ico('doc', 24)}</span><span class="txt"><b>Documentos</b><span>${pend ? `${pend} pendiente${pend === 1 ? '' : 's'} de firmar o leer` : 'Subir, firmar y ver el historial'}</span></span>${pend ? `<span class="nv-n">${pend}</span>` : ico('sig', 22)}</a>`;
  } else tarjetaDocs = `<span class="tarjeta-docs"><span class="ico-caja">${ico('doc', 24)}</span><span class="txt"><b>Documentos</b><span>Subir, firmar y ver el historial</span></span>${ico('sig', 22)}</span>`;
  const tarjetaCaja = ver('caja') ? `<a class="tarjeta-caja" href="#/caja"><span class="ico-caja">${ico('caja', 26)}</span><span class="txt"><b>Caja</b><span>Ingresos y gastos por día</span></span>${ico('sig', 22)}</a>` : '';
  const accesos = (profesora ? [
    ['iniciativas', '#/iniciativas', 'idea', 'Iniciativas', 'Propón una idea', false],
    ['alumnas', '#/alumnas', 'alumnas', 'Mis alumnas', 'Fichas y contacto', false],
    ['logros', '#/logros', 'trofeo', 'Logros', 'Mis retos y estrellas', false],
    ['incidencias', '#/incidencias', 'alerta', 'Incidencias', 'Ver y apuntar', false],
    ['eventos', '#/eventos', 'evento', 'Mis eventos', 'Próximos', false],
    ['normas', '#/normas', 'normas', 'Normas', 'Reglas de la escuela', false]
  ] : [
    ['alumnas', '#/alumna/nueva', 'insc', 'Nueva alumna', 'Dar de alta', true],
    ['inscripciones', '#/inscripciones', 'clases', 'Inscripciones', 'Altas y bajas en clases', false],
    ['caja', `#/caja/nuevo?fecha=${hoy}`, 'euro', 'Movimiento', 'Ingreso o gasto', true],
    ['incidencias', '#/incidencias', 'alerta', 'Incidencias', 'Ver y apuntar', false],
    ['profesoras', '#/profesoras', 'profe', 'Profesoras', 'Equipo y clases', false],
    ['eventos', '#/eventos', 'evento', 'Eventos', 'Próximos', false],
    ['logros', '#/logros', 'trofeo', 'Logros', 'Retos y estrellas', false],
    ['iniciativas', '#/iniciativas', 'idea', 'Iniciativas', 'Ideas y propuestas', false],
    ['normas', '#/normas', 'normas', 'Normas', 'Reglas de la escuela', false],
    ['formularios', '#/formularios', 'form', 'Formularios', 'Enlaces por WhatsApp', false],
    ['escuelas_amigas', '#/escuelas', 'escuela', 'Escuela amiga', 'Clases y cuota', false]
  ]).filter((x) => x[0] === '*' || (x[5] ? editar(x[0]) : ver(x[0])));
  pintar((vista ? `<div class="banda-vista">${ico('ojo', 18)}<span>Vista de <b>${esc(vista.profesora.nombre)}</b>${vista.recomendada ? ' · permisos recomendados' : ''}</span><button data-ir="${vista.salir || '#/vista'}">Salir</button></div>` : '') + cabecera('Inicio', { sub: capital(fechaLarga(hoy)), insignia: vista ? (profesora ? 'Profesora' : vista.profesora.nombre.split(' ')[0]) : null }) + `<main class="cont">
    ${bloqueClases}
    ${barraLogros}
    ${tarjetaCaja}
    ${tarjetaDocs}
    ${accesos.length ? `<div class="seccion">Accesos rápidos</div><div class="accesos">${accesos.map((x) => `<a class="acceso" href="${x[1]}"><span class="ico">${ico(x[2])}</span><b>${x[3]}</b><span>${x[4]}</span></a>`).join('')}</div>` : ''}
    ${(vista ? !Object.values(vista.permisos).some((p) => p.puede_ver) : !S.admin && !Object.values(S.permisos).some((p) => p.puede_ver)) ? vacio('Aún no tienes ningún módulo asignado. La administración te dará acceso.') : ''}
  </main>` + (vista ? navegacion('inicio', ver) : ''), vista ? false : 'inicio');
  const car = document.getElementById('carrusel'), puntos = document.getElementById('puntos');
  if (car && puntos) {
    const paso = () => car.clientWidth + 14;   // ancho de tarjeta + separación
    const actual = () => Math.round(car.scrollLeft / paso());
    car.addEventListener('scroll', () => { const k = actual(); puntos.querySelectorAll('i').forEach((p, j) => p.classList.toggle('on', j === k)); }, { passive: true });
    // Tocar un punto lleva a esa tarjeta
    puntos.querySelectorAll('i').forEach((p, j) => p.onclick = () => car.scrollTo({ left: j * paso(), behavior: 'smooth' }));
  }
}

/* Vista previa: la administración ve el Inicio como una profesora */
const PERMISOS_PROFE = { clases: 1, alumnas: 1, inscripciones: 1, incidencias: 2, normas: 1, eventos: 1, logros: 2, iniciativas: 2 };
async function pantallaVista(id) {
  if (!S.admin) return sinPermiso();
  if (!id) {
    const ps = await q(sb.from('profesoras').select('id,nombre,perfil_id').eq('activa', true).order('nombre'));
    return pintar(cabecera('Ver como profesora', { volver: '#/mas', sub: 'Así verá el Inicio cada una' }) + `<main class="cont">
      <div class="lista">${ps.map((p) => fila({ href: `#/vista/${p.id}`, tit: p.nombre, det: p.perfil_id ? 'Con usuario: se ven sus permisos reales' : 'Sin usuario aún: se ven los permisos recomendados', der: ico('sig') })).join('') || vacio('Aún no hay profesoras. Créalas en Más › Profesoras.')}</div>
      <p class="nota">Los permisos recomendados para una profesora son: ver sus clases, sus alumnas, normas y eventos; apuntar incidencias; Logros (dar estrellas) e Iniciativas (proponer ideas). Nunca Caja.</p>
    </main>`, 'mas');
  }
  if (id === 'p') return vistaPersona(location.hash.split('/')[3]);
  const profesora = await q(sb.from('profesoras').select('id,nombre,perfil_id').eq('id', id).single());
  const filas = profesora.perfil_id ? await q(sb.from('permisos').select('*').eq('perfil_id', profesora.perfil_id)) : [];
  const permisos = {}; filas.forEach((f) => { permisos[f.modulo] = f; });
  const recomendada = !filas.length;
  if (recomendada) Object.entries(PERMISOS_PROFE).forEach(([m, n]) => { permisos[m] = { puede_ver: true, puede_escribir: n > 1, solo_propias: true }; });
  return pantallaInicio({ profesora, permisos, recomendada });
}

// "Ver su Inicio" de cualquier persona del equipo, con sus permisos reales
async function vistaPersona(perfilId) {
  if (!S.admin) return sinPermiso();
  const [p, filas, prof] = await Promise.all([
    q(sb.from('perfiles').select('id,nombre').eq('id', perfilId).single()),
    q(sb.from('permisos').select('*').eq('perfil_id', perfilId)),
    intentar(() => q(sb.from('profesoras').select('id,nombre').eq('perfil_id', perfilId)))
  ]);
  const permisos = {}; filas.forEach((f) => { permisos[f.modulo] = f; });
  return pantallaInicio({ profesora: { id: prof[0] ? prof[0].id : null, nombre: p.nombre }, permisos, salir: `#/permisos?p=${perfilId}` });
}

/* ---------- equipo ---------- */
// Plantillas de permisos de un toque: [ver=1 / editar=2, solo lo suyo]
// "Solo lo suyo" en Iniciativas no hace a nadie profesora: recepción propone ideas y ve las suyas
// Papel que se enseña en la insignia: Profesora, Gestión (casi todo editable, o recepción con la caja abierta) o Equipo
const papel = (per) => esProfesora(per) ? 'Profesora'
  : MODULOS.filter(([m]) => m !== 'documentos').every(([m]) => per[m] && per[m].puede_escribir) ? 'Gestión'
  : per.caja && per.caja.puede_escribir ? 'Gestión' : 'Equipo';
const esProfesora = (permisos) => Object.entries(permisos).some(([m, p]) => p && p.solo_propias && m !== 'iniciativas');
const PLANTILLAS = {
  profesora: { nombre: 'Profesora', solo: true, mods: PERMISOS_PROFE },
  caja: { nombre: 'Caja y recepción', solo: false, soloEn: ['iniciativas'], mods: { caja: 2, alumnas: 2, inscripciones: 2, clases: 1, formularios: 1, normas: 1, eventos: 1, iniciativas: 2 } },
  // Documentos no va en ninguna plantilla: solo lo da la administración a mano
  gestion: { nombre: 'Gestión', solo: false, mods: Object.fromEntries(MODULOS.filter(([m]) => m !== 'documentos').map(([m]) => [m, 2])) }
};
const filasPlantilla = (t, perfil_id) => Object.entries(t.mods).map(([m, n]) => ({ ...(perfil_id ? { perfil_id } : {}), modulo: m, puede_ver: true, puede_escribir: n > 1, solo_propias: t.solo || (t.soloEn || []).includes(m) }));
function resumenPersona(p, filas) {
  if (p.rol === 'admin') return { tipo: 'Administración total', chip: '<span class="chip oro">Todo</span>' };
  if (!p.activo) return { tipo: 'Acceso quitado', chip: '<span class="chip no">Sin acceso</span>' };
  if (!filas.length) return { tipo: 'Sin permisos todavía', chip: '<span class="chip gris">Nada</span>' };
  const ver = filas.filter((f) => f.puede_ver).length, ed = filas.filter((f) => f.puede_escribir).length;
  const caja = filas.find((f) => f.modulo === 'caja');
  const tipo = esProfesora(Object.fromEntries(filas.map((f) => [f.modulo, f]))) ? 'Profesora · solo lo suyo' : `Gestión · ${ver} de ${MODULOS.length} secciones`;
  return { tipo, chip: caja ? `<span class="chip ${caja.puede_escribir ? 'ok' : 'mor'}">Caja ${caja.puede_escribir ? 'abierta' : 'solo ver'}</span>` : ed ? '' : '<span class="chip gris">Solo ver</span>' };
}
async function pantallaEquipo() {
  if (!S.admin) return sinPermiso();
  const [ps, per, profs] = await Promise.all([q(sb.from('perfiles').select('*').order('nombre')), q(sb.from('permisos').select('*')),
    intentar(() => q(sb.from('profesoras').select('id,nombre,perfil_id').eq('activa', true).is('perfil_id', null).order('nombre')))]);
  const de = (id) => per.filter((f) => f.perfil_id === id);
  ps.sort((a, b) => (b.rol === 'admin') - (a.rol === 'admin') || a.nombre.localeCompare(b.nombre, 'es'));
  pintar(cabecera('Equipo', { volver: '#/mas', sub: 'Todas las personas con acceso' }) + `<main class="cont">
    <div class="lista">${ps.map((p) => { const r = resumenPersona(p, de(p.id)), yo = p.id === S.usuario.id;
      return fila({ href: yo ? '#/equipo' : `#/permisos?p=${p.id}`, tit: p.nombre + (yo ? ' (tú)' : ''), det: esc(r.tipo), der: `<span class="chips">${r.chip}</span>` }); }).join('')}</div>
    ${profs.length ? `<div class="seccion">Profesoras sin acceso a la app</div>
    <div class="lista">${profs.map((x) => fila({ href: `#/acceso?prof=${x.id}`, tit: x.nombre, det: 'Aún no puede entrar', der: '<span class="chip oro">Darle acceso</span>' })).join('')}</div>` : ''}
    <button class="btn pri ancho" data-ir="#/acceso">${ico('mas')} Añadir persona</button>
  </main>`, 'mas');
}

// Dar acceso a una persona: se crea su usuario desde la app (servicio crear-acceso)
async function formAcceso(params) {
  if (!S.admin) return sinPermiso();
  const prof = params.get('prof') ? await q(sb.from('profesoras').select('id,nombre,email,telefono').eq('id', params.get('prof')).single()) : null;
  const clave = 'Blackstars-' + String(Math.floor(1000 + Math.random() * 9000));
  pintar(cabecera(prof ? 'Darle acceso' : 'Añadir persona', { volver: '#/equipo', sub: prof ? esc(prof.nombre) : 'Entrará con su email y contraseña' }) + `<main class="cont"><form class="form tarjeta" id="frm">
    ${campoHtml({ k: 'nombre', label: 'Nombre', req: true }, prof ? prof.nombre : '')}
    ${campoHtml({ k: 'email', label: 'Email', tipo: 'email', req: true, ph: 'nombre@gmail.com' }, prof ? prof.email : '')}
    ${campoHtml({ k: 'clave', label: 'Contraseña provisional', req: true, ayuda: 'Solo sirve para la primera vez: al entrar, la app le pide crear la suya.' }, clave)}
    ${campoHtml({ k: 'plantilla', label: 'Permisos', tipo: 'select', req: true, opciones: Object.entries(PLANTILLAS).map(([k, t]) => [k, t.nombre]) }, prof ? 'profesora' : 'gestion')}
    <button class="btn pri ancho" type="submit">Dar acceso</button></form></main>`, false);
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const d = leerForm(form, [{ k: 'nombre' }, { k: 'email' }, { k: 'clave' }, { k: 'plantilla' }]), t = PLANTILLAS[d.plantilla];
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Creando…';
    try {
      const { data, error } = await sb.functions.invoke('crear-acceso', { body: { nombre: d.nombre, email: d.email, clave: d.clave, profesora_id: prof ? prof.id : null,
        permisos: filasPlantilla(t) } });
      if (error || !data || !data.ok) {
        let msg = 'No se pudo dar acceso'; try { msg = (await error.context.json()).error || msg; } catch (e) { if (data && data.error) msg = data.error; }
        throw new Error(msg);
      }
      const url = location.origin + location.pathname;
      const texto = `Hola ${d.nombre.split(' ')[0]}, ya tienes acceso a la app de Academia Blackstars.\n\nEntra en: ${url}\nEmail: ${d.email}\nContraseña provisional: ${d.clave}\n\nAl entrar la primera vez te pedirá crear tu propia contraseña. Te recomiendo añadirla a la pantalla de inicio del móvil y activar los avisos en la campana.`;
      const tel = prof && prof.telefono ? prof.telefono.replace(/\D/g, '') : '';
      pintar(cabecera('¡Acceso creado!', { volver: '#/equipo' }) + `<main class="cont"><div class="tarjeta"><h2>${esc(d.nombre)} ya puede entrar</h2>
        <p class="nota" style="margin:8px 0 0">Mándale estos datos. Tiene los permisos de "${esc(t.nombre)}"; puedes cambiarlos en Equipo.</p>
        <pre class="msj-acceso">${esc(texto)}</pre></div>
        <a class="btn verde ancho" href="https://wa.me/${tel ? (tel.length === 9 ? '34' + tel : tel) : ''}?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>
        <button class="btn sec ancho" id="copiar">Copiar mensaje</button>
        <button class="btn sec ancho" data-ir="#/permisos?p=${data.id}">Ver sus permisos</button></main>`, 'mas');
      document.getElementById('copiar').onclick = async () => { try { await navigator.clipboard.writeText(texto); aviso('Copiado'); } catch (e) { aviso('No se pudo copiar', true); } };
    } catch (e) { aviso(e.message || traducirError(e), true); btn.disabled = false; btn.textContent = 'Dar acceso'; }
  };
}

/* ---------- más ---------- */
// Recepción y gestión tienen todo en los accesos del Inicio: en Más solo queda su ficha y la contraseña
const EN_INICIO = ['*', 'logros', 'eventos', 'profesoras', 'incidencias', 'inscripciones', 'formularios', 'escuelas_amigas'];
// Las profesoras tienen Documentos, Logros, Eventos e Incidencias en el Inicio; Inscripciones no lo ven
const EN_INICIO_PROFE = ['*', 'logros', 'eventos', 'incidencias', 'inscripciones'];
// La administración también: en Más solo su ficha, Ver como profesora, Equipo y permisos y la contraseña
const enMas = (m) => !(!S.admin && esProfesora(S.permisos) ? EN_INICIO_PROFE : EN_INICIO).includes(m);
const volverDe = (m) => enMas(m) ? '#/mas' : '#/inicio';
function pantallaMas() {
  const items = [
    ['logros', '#/logros', 'trofeo', 'Logros', 'Retos del mes y estrellas de alumnas'],
    // Iniciativas y Normas están en los accesos rápidos del Inicio
    ['*', '#/documentos', 'doc', 'Documentos', 'Enviar, firmar y devolver'],
    ['eventos', '#/eventos', 'evento', 'Eventos', 'Talleres, shows y fiestas'],
    ['profesoras', '#/profesoras', 'profe', 'Profesoras', 'Equipo y clases asignadas'],
    ['incidencias', '#/incidencias', 'alerta', 'Incidencias', 'Lo que pasa en clase'],
    ['inscripciones', '#/inscripciones', 'insc', 'Inscripciones', 'Altas y bajas en clases'],
    ['formularios', '#/formularios', 'form', 'Formularios', 'Enlaces para alumnas y respuestas'],
    ['escuelas_amigas', '#/escuelas', 'escuela', 'Escuelas amigas', 'Clases externas, cuota y coincidencias']
  ].filter((i) => (i[0] === '*' || puedeVer(i[0])) && enMas(i[0]));
  const ic = (n) => `<span class="ini">${ico(n)}</span>`;
  // Tu ficha: al pulsar, tus datos personales (DNI, cuenta, tallas...), que solo ves tú y la administración
  pintar(cabecera('Más', { sub: 'Todo lo demás, a un toque' }) + `<main class="cont">
    <a class="tarjeta mi-ficha" href="#/mis-datos"><span class="ini-g">${esc(iniciales(S.perfil && S.perfil.nombre))}</span>
      <span class="txt"><b>${esc(S.perfil ? S.perfil.nombre : '')}</b><span>${S.admin ? 'Administración · acceso completo' : esc(S.usuario.email)}</span><span class="mf-pie">${ico('llave', 14)} Mi ficha · DNI, cuenta y tallas</span></span>${ico('sig', 22)}</a>
    <div class="lista">${items.map((i) => fila({ href: i[1], tit: i[3], det: i[4], iconoHtml: ic(i[2]), der: ico('sig') })).join('')}
    ${S.admin ? fila({ href: '#/vista', tit: 'Ver como profesora', det: 'Comprueba qué ve cada profesora en el Inicio', iconoHtml: ic('ojo'), der: '<span class="chip oro">Solo admin</span>' }) : ''}
    ${S.admin ? fila({ href: '#/equipo', tit: 'Equipo y permisos', det: 'Todas las personas y lo que puede ver cada una', iconoHtml: ic('alumnas'), der: '<span class="chip oro">Solo admin</span>' }) : ''}
    ${fila({ href: '#/nueva-clave', tit: 'Cambiar mi contraseña', iconoHtml: ic('llave'), der: ico('sig') })}
    </div>
    <button class="btn sec ancho" id="salir">${ico('salir')} Cerrar sesión</button>
  </main>`, 'mas');
  document.getElementById('salir').onclick = async () => { await sb.auth.signOut(); S.usuario = null; location.hash = ''; router(); };
}

/* ---------- clases ---------- */
/* Editor de horarios: cada fila = días (L M X J V S D) + hora de inicio y fin. */
function editorHorarios(horarios) {
  // Agrupa los horarios guardados por franja horaria para mostrarlos como filas con varios días
  const g = {};
  (horarios || []).forEach((h) => { const k = hora(h.hora_inicio) + '-' + hora(h.hora_fin); (g[k] = g[k] || { ini: hora(h.hora_inicio), fin: hora(h.hora_fin), dias: [] }).dias.push(h.dia_semana); });
  const filas = Object.values(g);
  if (!filas.length) filas.push({ ini: '', fin: '', dias: [] });
  return `<div class="campo"><label>Días y horario *</label><div id="horarios" class="horarios">${filas.map(filaHorario).join('')}</div>
    <button type="button" class="btn sec" id="otroHorario">${ico('mas')} Añadir otro horario</button>
    <div class="ayuda">Marca todos los días que tienen el mismo horario. Si un día tiene otra hora, añade otro horario. Si son grupos distintos (con otras alumnas), crea otra clase.</div></div>`;
}
function filaHorario(f) {
  return `<div class="horario"><div class="dias-sel">${DIAS_C.map((d, i) => `<button type="button" data-dia="${i + 1}" class="${f.dias.includes(i + 1) ? 'on' : ''}" aria-pressed="${f.dias.includes(i + 1)}" aria-label="${DIAS[i + 1]}">${d}</button>`).join('')}</div>
    <div class="horas"><label>De<input type="time" class="h-ini" value="${esc(f.ini)}"></label><label>a<input type="time" class="h-fin" value="${esc(f.fin)}"></label></div>
    <button type="button" class="quitar-h">Quitar este horario</button></div>`;
}
function activarEditorHorarios() {
  const cont = document.getElementById('horarios');
  cont.addEventListener('click', (ev) => {
    const d = ev.target.closest('[data-dia]');
    if (d) { d.classList.toggle('on'); d.setAttribute('aria-pressed', d.classList.contains('on')); return; }
    const x = ev.target.closest('.quitar-h');
    if (x && cont.children.length > 1) x.closest('.horario').remove();
  });
  document.getElementById('otroHorario').onclick = () => cont.insertAdjacentHTML('beforeend', filaHorario({ ini: '', fin: '', dias: [] }));
}
function leerHorarios() {
  const out = [];
  for (const el of document.querySelectorAll('#horarios .horario')) {
    const dias = [...el.querySelectorAll('[data-dia].on')].map((b) => +b.dataset.dia);
    const ini = el.querySelector('.h-ini').value, fin = el.querySelector('.h-fin').value;
    if (!dias.length && !ini && !fin) continue;
    if (!dias.length) throw new Error('Marca al menos un día en cada horario.');
    if (!ini || !fin) throw new Error('Pon la hora de inicio y de fin de cada horario.');
    if (fin <= ini) throw new Error('La hora de fin tiene que ser después de la de inicio.');
    dias.forEach((d) => out.push({ dia_semana: d, hora_inicio: ini, hora_fin: fin }));
  }
  if (!out.length) throw new Error('Marca al menos un día y su horario.');
  return out;
}

/* Alta / edición de una clase (propia o de escuela amiga) */
async function formClase(id, escuela = null) {
  if (!puedeEditar('clases')) return sinPermiso();
  const reg = id ? await q(sb.from('clases').select('*,' + SEL_HOR).eq('id', id).single()) : null;
  escuela = escuela || (reg && reg.escuela_amiga_id);
  const profes = escuela ? [] : await intentar(opcionesProfesoras);
  const campos = escuela
    ? [{ k: 'nombre', label: 'Nombre de la clase', req: true }, { k: 'profesora_externa', label: 'Su profesora' }, { k: 'alumnas_externas', label: 'Número de alumnas', tipo: 'numero' }, { k: 'activa', label: 'Clase activa', tipo: 'bool', def: true }]
    : [{ k: 'nombre', label: 'Nombre de la clase', req: true, ph: 'STARSDANCE' }, { k: 'nivel', label: 'Nivel', ph: 'Iniciación' },
       { k: 'profesora_id', label: 'Profesora', tipo: 'select', opciones: profes, vacio: profes.length ? 'Sin asignar' : 'Aún no hay profesoras',
         ayuda: profes.length ? '' : 'Primero da de alta a las profesoras en Más › Profesoras.' },
       { k: 'activa', label: 'Clase activa', tipo: 'bool', def: true }];
  const volver = id ? `#/clase/${id}` : escuela ? `#/escuela/${escuela}` : '#/clases';
  const vals = Object.assign({}, reg || {});
  pintar(cabecera(id ? 'Editar clase' : escuela ? 'Nueva clase externa' : 'Nueva clase', { volver }) + `<main class="cont"><form class="form tarjeta" id="frm">
    ${campoHtml(campos[0], vals.nombre)}
    ${editorHorarios(reg ? reg.clase_horarios : [])}
    ${campos.slice(1).map((c) => campoHtml(c, vals[c.k])).join('')}
    ${!escuela && !profes.length && puedeEditar('profesoras') ? `<a class="btn sec" href="#/profesora/nueva">${ico('mas')} Añadir profesora</a>` : ''}
    <button class="btn pri ancho" type="submit">Guardar</button>
    ${id && S.admin ? '<button class="btn peligro ancho" type="button" id="borrar">Borrar definitivamente</button>' : ''}
  </form>${autorDe(reg)}</main>`, false);
  activarEditorHorarios();
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('[type=submit]');
    let horarios;
    try { horarios = leerHorarios(); } catch (e) { aviso(e.message, true); return; }
    btn.disabled = true;
    const datos = leerForm(form, campos);
    if (escuela) Object.assign(datos, { escuela_amiga_id: escuela, profesora_id: null });
    // Copia del primer horario en la clase (columnas antiguas); la sala ya no se usa: hay una sola.
    Object.assign(datos, { dia_semana: horarios[0].dia_semana, hora_inicio: horarios[0].hora_inicio, hora_fin: horarios[0].hora_fin, sala: null });
    let claseId = id;
    try {
      if (id) await q(sb.from('clases').update(datos).eq('id', id));
      else claseId = (await q(sb.from('clases').insert(datos).select('id').single())).id;
      try { await guardarHorarios(claseId, horarios); }
      catch (e) { if (!id) await sb.from('clases').delete().eq('id', claseId); throw e; }
      aviso('Guardado'); location.hash = escuela && !id ? `#/escuela/${escuela}` : `#/clase/${claseId}`;
    } catch (e) { aviso(traducirError(e), true); btn.disabled = false; }
  };
  const b = document.getElementById('borrar');
  if (b) b.onclick = async () => {
    if (!confirm('¿Borrar la clase definitivamente? Se perderán sus inscripciones. Si solo deja de darse, mejor desmarca "Clase activa".')) return;
    try { await q(sb.from('clases').delete().eq('id', id)); aviso('Borrada'); location.hash = escuela ? `#/escuela/${escuela}` : '#/clases'; } catch (e) { aviso(traducirError(e), true); }
  };
}

// Cambia los horarios de una clase; si alguno choca con otra clase, deja los que tenía
async function guardarHorarios(claseId, horarios) {
  const antes = await q(sb.from('clase_horarios').select('dia_semana,hora_inicio,hora_fin').eq('clase_id', claseId));
  await q(sb.from('clase_horarios').delete().eq('clase_id', claseId));
  try { await q(sb.from('clase_horarios').insert(horarios.map((h) => ({ clase_id: claseId, ...h })))); }
  catch (e) { if (antes.length) await sb.from('clase_horarios').insert(antes.map((h) => ({ clase_id: claseId, ...h }))); throw e; }
}

async function pantallaClases(params) {
  if (!puedeVer('clases')) return sinPermiso();
  const f = params.get('f') || 'propias';
  const clases = await q(sb.from('clases').select('id,nombre,activa,escuela_amiga_id,profesora_externa,profesoras(nombre),escuelas_amigas(nombre),inscripciones(count),' + SEL_HOR));
  const lista = clases.filter((c) => f === 'propias' ? !c.escuela_amiga_id && c.activa : f === 'amigas' ? c.escuela_amiga_id && c.activa : !c.activa)
    .sort((a, b) => ordenClase(a) - ordenClase(b));
  // Horas de este mes de cada clase (quien lleva la caja): las da su profesora, salvo faltas y cambios
  const mesH = hoyISO().slice(0, 7), horas = f === 'propias' && puedeVer('caja') ? await intentar(async () => horasPorClase(calcularHoras(mesH, await datosHoras(mesH)))) : {};
  const tarjetas = lista.map((c) => {
    const n = c.inscripciones && c.inscripciones[0] ? c.inscripciones[0].count : 0;
    const quien = c.escuela_amiga_id ? `${esc(c.escuelas_amigas ? c.escuelas_amigas.nombre : '')}${c.profesora_externa ? ' · ' + esc(c.profesora_externa) : ''}` : (c.profesoras ? 'Prof. ' + esc(c.profesoras.nombre) : 'Sin profesora');
    return `<a class="tarjeta-clase ${c.escuela_amiga_id ? 'externa' : ''}" href="#/clase/${c.id}">
      <div class="tc-cab"><h2>${esc(c.nombre)}</h2>${c.escuela_amiga_id ? '<span class="chip oro">Externa</span>' : `<span class="chip mor">${n} ${n === 1 ? 'alumna' : 'alumnas'}</span>`}</div>
      <div class="tc-hor">${ico('clases', 16)} ${esc(textoHorario(c))}</div>
      <div class="tc-pie"><span>${quien}</span>${horas[c.id] ? `<span class="tc-horas">${horasTxt(horas[c.id].min)} este mes</span>` : ''}${ico('sig', 18)}</div>
      ${horas[c.id] && horas[c.id].otras.length ? `<div class="tc-cubre">${horas[c.id].otras.map((o) => esc(o)).join(' · ')}</div>` : ''}</a>`;
  }).join('');
  const titulo = S.admin || !(S.permisos.clases && S.permisos.clases.solo_propias) ? 'Clases' : 'Mis clases';
  pintar(cabecera(titulo, { sub: `${lista.length} ${f === 'inactivas' ? 'inactivas' : (lista.length === 1 ? 'activa' : 'activas')}` }) + `<main class="cont">
    ${titulo === 'Clases' ? `<div class="filtros">${[['propias', 'Nuestras'], ['amigas', 'Escuela amiga'], ['inactivas', 'Inactivas']].map(([k, t]) => `<button data-ir="#/clases?f=${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}
    ${f === 'propias' && puedeVer('caja') ? `<a class="tarjeta horas-enlace" href="#/horas?mes=${mesH}"><span><small>Horas de las profesoras · ${nombreMes(mesH + '-01')}</small><b>${horasTxt(Object.values(horas).reduce((t, h) => t + h.min, 0))}</b></span><span class="he-mas">Faltas, cambios y festivos ${ico('sig', 16)}</span></a>` : ''}
    <div class="lista">${tarjetas || vacio(titulo === 'Mis clases' ? 'Todavía no tienes clases asignadas.' : 'No hay clases todavía.' + (puedeEditar('clases') ? ' Pulsa + para crear la primera.' : ''))}</div></main>`,
    'clases', puedeEditar('clases') && f === 'propias' ? '#/clase/nueva' : null);
}
async function pantallaClase(id) {
  if (!puedeVer('clases')) return sinPermiso();
  const c = await q(sb.from('clases').select('*,profesoras(nombre),escuelas_amigas(id,nombre),' + SEL_HOR).eq('id', id).single());
  const ins = puedeVer('inscripciones') ? await intentar(() => q(sb.from('inscripciones').select('id,fecha_alta,alumnas(id,nombre,apellidos,telefono,cuota)').eq('clase_id', id).is('fecha_baja', null))) : [];
  ins.sort((a, b) => (a.alumnas.nombre || '').localeCompare(b.alumnas.nombre || '', 'es'));
  pintar(cabecera(c.nombre, { volver: c.escuela_amiga_id ? `#/escuela/${c.escuela_amiga_id}` : '#/clases', sub: esc(textoHorario(c, true)) }) + `<main class="cont">
    <div class="tarjeta"><dl class="datos">
      <dt>Horario</dt><dd>${horariosDe(c).map((h) => `${DIAS[h.dia_semana]} ${hora(h.hora_inicio)}–${hora(h.hora_fin)}`).join('<br>') || '—'}</dd>
      ${c.escuela_amiga_id ? `<dt>Escuela</dt><dd>${esc(c.escuelas_amigas.nombre)}</dd><dt>Profesora</dt><dd>${esc(c.profesora_externa || '—')}</dd><dt>Alumnas</dt><dd>${c.alumnas_externas ?? '—'}</dd>`
        : `<dt>Profesora</dt><dd>${esc(c.profesoras ? c.profesoras.nombre : 'Sin asignar')}</dd><dt>Nivel</dt><dd>${esc(c.nivel || '—')}</dd>`}
      <dt>Estado</dt><dd>${c.activa ? '<span class="chip ok">Activa</span>' : '<span class="chip gris">Inactiva</span>'}</dd>
    </dl></div>
    ${puedeEditar('clases') ? `<a class="btn sec" href="#/clase/${id}/editar">${ico('lapiz')} Editar clase</a>` : ''}
    ${!c.escuela_amiga_id && puedeVer('logros') ? `<a class="btn sec" href="#/logros/clase/${id}">${ico('trofeo')} ${puedeEditar('logros') ? 'Dar estrellas' : 'Ver estrellas'}</a>` : ''}
    ${!c.escuela_amiga_id && puedeVer('inscripciones') ? `<div class="seccion">Alumnas (${ins.length})</div>
      <div class="lista">${ins.map((i) => fila({ href: `#/alumna/${i.alumnas.id}`, tit: `${i.alumnas.nombre} ${i.alumnas.apellidos || ''}`, det: 'Desde ' + fechaCorta(i.fecha_alta), der: (i.alumnas.cuota === 'media' ? '<span class="chip oro">½ mes</span>' : '') + (puedeEditar('inscripciones') ? `<button class="ins-editar" data-ir="#/inscripcion/${i.id}?clase=${id}" aria-label="Corregir fechas">${ico('lapiz', 18)}</button>` : '') })).join('') || vacio('Nadie inscrita todavía.')}</div>
      ${puedeEditar('inscripciones') ? `<a class="btn pri" href="#/inscripcion/nueva?clase=${id}">${ico('mas')} Inscribir alumna</a>` : ''}` : ''}
    ${autorDe(c)}
  </main>`, 'clases');
}

/* ---------- alumnas ---------- */
const CAMPOS_ALUMNA = [
  { k: 'nombre', label: 'Nombre', req: true }, { k: 'apellidos', label: 'Apellidos' },
  { k: 'fecha_nacimiento', label: 'Fecha de nacimiento', tipo: 'fecha' },
  { k: 'telefono', label: 'Teléfono', tipo: 'tel' }, { k: 'email', label: 'Correo', tipo: 'email' },
  { k: 'tutor_nombre', label: 'Madre / padre / tutor (si es menor)' }, { k: 'tutor_telefono', label: 'Teléfono del tutor', tipo: 'tel' },
  { k: 'cuota', label: 'Mensualidad', tipo: 'select', vacio: false, opciones: [['completa', 'Mes completo'], ['media', 'Medio mes']] },
  { k: 'fecha_alta', label: 'Fecha de alta', tipo: 'fecha', def: hoyISO() },
  { k: 'notas', label: 'Notas', tipo: 'textarea' }
];
async function pantallaAlumnas(params) {
  if (!puedeVer('alumnas')) return sinPermiso();
  const f = params.get('f') || 'activa';
  let claseSel = params.get('clase');
  const [todas, clases] = await Promise.all([
    q(sb.from('alumnas').select('id,nombre,apellidos,estado,telefono,cuota,inscripciones(clase_id,fecha_baja,clases(nombre))').order('nombre')),
    puedeVer('clases') ? intentar(() => q(sb.from('clases').select('id,nombre,activa,escuela_amiga_id,' + SEL_HOR).is('escuela_amiga_id', null))) : []
  ]);
  // Alumnas de cada clase: activas = inscripción en curso; bajas = estuvo en la clase y ya no.
  const enClase = (a, cid) => (a.inscripciones || []).some((i) => i.clase_id === cid && !i.fecha_baja);
  const bajaDeClase = (a, cid) => (a.inscripciones || []).some((i) => i.clase_id === cid && i.fecha_baja) && !enClase(a, cid);
  const sinClase = (a) => !(a.inscripciones || []).some((i) => !i.fecha_baja);
  const deClase = (cid) => todas.filter((a) => cid === 'sin'
    ? (f === 'activa' ? a.estado === 'activa' && sinClase(a) : a.estado === 'baja' && !(a.inscripciones || []).length)
    : (f === 'activa' ? a.estado === 'activa' && enClase(a, cid) : bajaDeClase(a, cid) || (a.estado === 'baja' && enClase(a, cid))));
  const nActivas = todas.filter((a) => a.estado === 'activa').length;
  // Con una sola clase (lo normal en una profesora) se va directo a la lista de sus alumnas
  const unica = !claseSel && f !== 'todas' && clases.filter((c) => c.activa).length === 1 && !deClase('sin').length ? clases.find((c) => c.activa) : null;
  if (unica) claseSel = unica.id;
  const claseObj = clases.find((c) => c.id === claseSel);
  // Estrellas del mes de cada alumna de la clase (barra de progreso) y orden de la lista
  const enUnaClase = claseSel && claseSel !== 'sin';
  const est = enUnaClase && puedeVer('logros') ? await intentar(() => q(sb.from('logros_estrellas').select('alumna_id,esfuerzo,tareas,actitud').eq('clase_id', claseSel).eq('mes', mesDe()))) : null;
  const pctAlumna = (a) => est ? pct(est.filter((e) => e.alumna_id === a.id).reduce((t, e) => t + totalEstrellas(e), 0), MAX_ALUMNA) : 0;
  let orden = 'az';
  try { orden = localStorage.getItem('bs-orden-alumnas') === 'nota' ? 'nota' : 'az'; } catch (e) { /* sin almacenamiento */ }
  const titulo = unica ? 'Alumnas' : claseSel ? (claseSel === 'sin' ? 'Sin clase' : claseObj ? claseObj.nombre : 'Clase') : 'Alumnas';
  const sub = claseSel ? `${unica ? esc(unica.nombre) + ' · ' : ''}${deClase(claseSel).length} ${f === 'activa' ? 'activas' : 'de baja'}` : `${nActivas} activas · ${todas.length - nActivas} de baja`;
  pintar(cabecera(titulo, { sub, volver: claseSel && !unica ? `#/alumnas?f=${f}` : null }) + `<main class="cont">
    <div class="buscar">${ico('buscar')}<input id="buscar" type="search" placeholder="${claseSel && !unica ? 'Buscar en esta clase' : 'Buscar alumna'}" autocomplete="off"></div>
    ${est ? `<div class="filtros" id="orden">${[['az', 'A–Z'], ['nota', 'Más estrellas']].map(([k, t]) => `<button type="button" data-orden="${k}" class="${orden === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}
    ${claseSel && !unica ? '' : `<div class="filtros">${[['activa', 'Activas'], ['baja', 'Bajas'], ['todas', 'Todas']].map(([k, t]) => `<button data-ir="#/alumnas?f=${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>`}
    <div class="lista" id="lista"></div></main>`, 'alumnas', puedeEditar('alumnas') ? '#/alumna/nueva' : null);
  const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filaAlumna = (a) => {
    const cls = (a.inscripciones || []).filter((i) => !i.fecha_baja && i.clases).map((i) => i.clases.nombre).join(' · ');
    const chips = (a.estado === 'activa' ? '<span class="chip ok">Activa</span>' : '<span class="chip gris">Baja</span>') + (a.cuota === 'media' ? '<span class="chip oro">½ mes</span>' : '');
    if (est) {
      const v = pctAlumna(a);
      return fila({ href: `#/alumna/${a.id}`, tit: `${a.nombre} ${a.apellidos || ''}`, det: `<span class="estr-alumna">${barra(v)}<b>${v}%</b></span>`, der: `<span class="chips">${chips}</span>` });
    }
    return fila({ href: `#/alumna/${a.id}`, tit: `${a.nombre} ${a.apellidos || ''}`, det: esc(cls || 'Sin clase'), der: `<span class="chips">${chips}</span>` });
  };
  const ordenar = (l) => l.slice().sort((x, y) => (orden === 'nota' ? pctAlumna(y) - pctAlumna(x) : 0) || `${x.nombre} ${x.apellidos || ''}`.localeCompare(`${y.nombre} ${y.apellidos || ''}`, 'es'));
  const tarjetaClase = (id, nombre, horario, n) => `<a class="tarjeta-clase" href="#/alumnas?f=${f}&clase=${id}">
    <div class="tc-cab"><h2>${esc(nombre)}</h2><span class="contador ${f === 'baja' ? 'gris' : ''}">${n}</span></div>
    ${horario ? `<div class="tc-hor">${ico('clases', 16)} ${esc(horario)}</div>` : ''}
    <div class="tc-pie"><span>${n === 1 ? '1 alumna' : n + ' alumnas'} ${f === 'activa' ? (n === 1 ? 'activa' : 'activas') : 'de baja'}</span>${ico('sig', 18)}</div></a>`;
  const dibujar = () => {
    const t = quitarTildes(document.getElementById('buscar').value.trim());
    const coincide = (a) => quitarTildes(`${a.nombre} ${a.apellidos || ''} ${a.telefono || ''}`).includes(t);
    let html;
    if (claseSel) html = ordenar(deClase(claseSel).filter((a) => !t || coincide(a))).map(filaAlumna).join('') || vacio(t ? 'No hay coincidencias.' : 'No hay alumnas aquí.');
    else if (t || f === 'todas') html = todas.filter((a) => (f === 'todas' || a.estado === f) && (!t || coincide(a))).map(filaAlumna).join('') || vacio(todas.length ? 'No hay coincidencias.' : 'Aún no hay alumnas. Pulsa + para dar de alta la primera.');
    else {
      const visibles = clases.filter((c) => f === 'activa' ? c.activa : true).sort((a, b) => ordenClase(a) - ordenClase(b));
      html = visibles.map((c) => ({ c, n: deClase(c.id).length })).filter((x) => f === 'activa' || x.n > 0)
        .map((x) => tarjetaClase(x.c.id, x.c.nombre, textoHorario(x.c), x.n)).join('');
      const ns = deClase('sin').length;
      if (ns) html += tarjetaClase('sin', 'Sin clase', '', ns);
      html = html || vacio(f === 'activa' ? 'Aún no hay clases ni alumnas.' : 'No hay alumnas de baja.');
    }
    document.getElementById('lista').innerHTML = html;
  };
  document.getElementById('buscar').oninput = dibujar;
  $app.querySelectorAll('[data-orden]').forEach((b) => b.onclick = () => {
    orden = b.dataset.orden; try { localStorage.setItem('bs-orden-alumnas', orden); } catch (e) { /* nada */ }
    $app.querySelectorAll('[data-orden]').forEach((x) => x.classList.toggle('on', x === b)); dibujar();
  });
  dibujar();
}
async function pantallaAlumna(id) {
  if (!puedeVer('alumnas')) return sinPermiso();
  const a = await q(sb.from('alumnas').select('*').eq('id', id).single());
  const ins = puedeVer('inscripciones') ? await intentar(() => q(sb.from('inscripciones').select('id,fecha_alta,fecha_baja,clases(id,nombre,' + SEL_HOR + ')').eq('alumna_id', id).order('fecha_alta', { ascending: false }))) : [];
  const notas = await intentar(() => q(sb.from('alumnas_notas').select('*').eq('alumna_id', id).order('creado_en', { ascending: false })));
  const e = edad(a.fecha_nacimiento);
  const tel = (t) => t ? `<a href="tel:${esc(t)}" style="color:var(--morado3)">${esc(t)}</a> · <a href="https://wa.me/${esc(t.replace(/\D/g, '').replace(/^(?!34)(\d{9})$/, '34$1'))}" target="_blank" rel="noopener" style="color:#1FA855">WhatsApp</a>` : '—';
  pintar(cabecera(`${a.nombre} ${a.apellidos || ''}`, { volver: '#/alumnas', sub: (a.estado === 'activa' ? 'Activa desde ' + fechaCorta(a.fecha_alta) : 'De baja') + (a.cuota === 'media' ? ' · Medio mes' : '') }) + `<main class="cont">
    <div class="tarjeta"><dl class="datos">
      <dt>Mensualidad</dt><dd>${a.cuota === 'media' ? '<span class="chip oro">Medio mes</span>' : 'Mes completo'}</dd>
      <dt>Edad</dt><dd>${e != null ? e + ' años' : '—'}</dd>
      <dt>Teléfono</dt><dd>${tel(a.telefono)}</dd><dt>Correo</dt><dd>${esc(a.email || '—')}</dd>
      ${a.tutor_nombre || (e != null && e < 18) ? `<dt>Tutor</dt><dd>${esc(a.tutor_nombre || '—')}</dd><dt>Tel. tutor</dt><dd>${tel(a.tutor_telefono)}</dd>` : ''}
      ${a.notas ? `<dt>Notas</dt><dd>${esc(a.notas)}</dd>` : ''}
    </dl></div>
    ${bloqueNotas(notas)}
    ${puedeVer('inscripciones') ? `<div class="seccion">Clases</div><div class="lista">${ins.filter((i) => !i.fecha_baja).map((i) => fila({ href: `#/clase/${i.clases.id}`, tit: i.clases.nombre, det: `${esc(textoHorario(i.clases))} · desde ${fechaCorta(i.fecha_alta)}`, der: puedeEditar('inscripciones') ? `<button class="ins-editar" data-ir="#/inscripcion/${i.id}?alumna=${id}" aria-label="Corregir fechas">${ico('lapiz', 18)}</button>` + `<button class="chip no" data-baja-ins="${i.id}" style="border:0;cursor:pointer;min-height:32px">Quitar</button>` : '' })).join('') || vacio('No está en ninguna clase.')}</div>
      ${ins.some((i) => i.fecha_baja) ? `<div class="seccion">Clases anteriores</div><div class="lista">${ins.filter((i) => i.fecha_baja).map((i) => fila({ href: `#/clase/${i.clases.id}`, tit: i.clases.nombre, det: `${fechaCorta(i.fecha_alta)} – ${fechaCorta(i.fecha_baja)}`, der: puedeEditar('inscripciones') ? `<button class="ins-editar" data-ir="#/inscripcion/${i.id}?alumna=${id}" aria-label="Corregir fechas">${ico('lapiz', 18)}</button>` : '' })).join('')}</div>` : ''}
      ${puedeEditar('inscripciones') && a.estado === 'activa' ? `<a class="btn sec" href="#/inscripcion/nueva?alumna=${id}">${ico('mas')} Añadir a una clase</a>` : ''}` : ''}
    ${puedeEditar('alumnas') ? `<div class="botones"><a class="btn sec" href="#/alumna/${id}/editar">${ico('lapiz')} Editar</a>
      ${a.estado === 'activa' ? `<button class="btn peligro" id="baja">Dar de baja</button>` : `<button class="btn sec" id="alta">Volver a dar de alta</button>`}</div>` : ''}
    ${autorDe(a)}
  </main>`, 'alumnas');
  activarNotas(id);
  $app.querySelectorAll('[data-baja-ins]').forEach((b) => b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    if (!confirm('¿Quitar de esta clase? Se guarda en el historial.')) return;
    try { await q(sb.from('inscripciones').update({ fecha_baja: hoyISO() }).eq('id', b.dataset.bajaIns)); aviso('Quitada de la clase'); router(); } catch (e) { aviso(traducirError(e), true); }
  });
  const bb = document.getElementById('baja');
  if (bb) bb.onclick = async () => {
    if (!confirm('¿Dar de baja a esta alumna? Se la quitará de todas sus clases (queda en el historial).')) return;
    try {
      await q(sb.from('alumnas').update({ estado: 'baja' }).eq('id', id));
      if (puedeEditar('inscripciones')) await q(sb.from('inscripciones').update({ fecha_baja: hoyISO() }).eq('alumna_id', id).is('fecha_baja', null));
      aviso('Alumna dada de baja'); router();
    } catch (e) { aviso(traducirError(e), true); }
  };
  const ba = document.getElementById('alta');
  if (ba) ba.onclick = async () => { try { await q(sb.from('alumnas').update({ estado: 'activa' }).eq('id', id)); aviso('Alumna activa de nuevo'); router(); } catch (e) { aviso(traducirError(e), true); } };
}

/* Notas de la profesora (desplegable en la ficha de la alumna) */
const TIPOS_NOTA = [['avance', 'Avance', 'ok'], ['esfuerzo', 'Esfuerzo', 'mor'], ['incidencia', 'Incidencia', 'no'], ['familia', 'Familia', 'oro'], ['otra', 'Otra', 'gris']];
function bloqueNotas(notas) {
  const tipo = (k) => TIPOS_NOTA.find((t) => t[0] === k) || TIPOS_NOTA[4];
  const mia = (n) => S.admin || n.creado_por === S.usuario.id;
  const nota = (n) => `<div class="nota"><div class="nota-cab"><span class="chip ${tipo(n.tipo)[2]}">${tipo(n.tipo)[1]}</span>
      <small>${esc(n.autor_nombre || 'Administración')} · ${fechaCorta(n.creado_en)}</small>
      ${mia(n) ? `<button class="nota-borrar" data-borrar-nota="${n.id}" aria-label="Borrar nota">Borrar</button>` : ''}</div>
    <p>${esc(n.texto)}</p></div>`;
  return `<details class="caja-clase notas-alumna"><summary class="cc-cab"><span><h3>Notas de la profesora</h3>
      <small>${notas.length ? `${notas.length} nota${notas.length === 1 ? '' : 's'} · última el ${fechaCorta(notas[0].creado_en)}` : 'Avances, esfuerzo, algo a tener en cuenta…'}</small></span>
      <span class="cc-flecha">${ico('sig', 18)}</span></summary>
    <div class="notas-cuerpo">
      <div class="nota-tipos" role="radiogroup" aria-label="Tipo de nota">${TIPOS_NOTA.map(([k, t]) => `<button type="button" data-tipo="${k}" class="${k === 'otra' ? 'on' : ''}">${t}</button>`).join('')}</div>
      <textarea id="nota-texto" rows="3" maxlength="2000" placeholder="Escribe aquí… (por ejemplo: ha avanzado mucho en los giros)"></textarea>
      <button class="btn pri" id="nota-guardar">Guardar nota</button>
      ${porMes(notas).map(([m, l]) => `<details class="nota-mes"><summary><span>${capital(nombreMes(m + '-01'))}</span><span class="chip mor">${l.length} nota${l.length === 1 ? '' : 's'}</span><span class="cc-flecha">${ico('sig', 16)}</span></summary>
        ${l.map(nota).join('')}</details>`).join('')}
    </div></details>`;
}
// [['2026-10', [notas...]], ...] de la más reciente a la más antigua
function porMes(notas) {
  const g = new Map();
  notas.forEach((n) => { const m = n.creado_en.slice(0, 7); if (!g.has(m)) g.set(m, []); g.get(m).push(n); });
  return [...g];
}
function activarNotas(alumnaId) {
  const caja = $app.querySelector('.notas-alumna'); if (!caja) return;
  let tipo = 'otra';
  caja.querySelectorAll('[data-tipo]').forEach((b) => b.onclick = () => {
    tipo = b.dataset.tipo; caja.querySelectorAll('[data-tipo]').forEach((x) => x.classList.toggle('on', x === b));
  });
  document.getElementById('nota-guardar').onclick = async (ev) => {
    const txt = document.getElementById('nota-texto').value.trim();
    if (!txt) return aviso('Escribe algo antes de guardar', true);
    ev.target.disabled = true;
    try { await q(sb.from('alumnas_notas').insert({ alumna_id: alumnaId, tipo, texto: txt })); aviso('Nota guardada'); router(); }
    catch (e) { ev.target.disabled = false; aviso(traducirError(e), true); }
  };
  caja.querySelectorAll('[data-borrar-nota]').forEach((b) => b.onclick = async () => {
    if (!confirm('¿Borrar esta nota?')) return;
    try { await q(sb.from('alumnas_notas').delete().eq('id', b.dataset.borrarNota)); aviso('Nota borrada'); router(); } catch (e) { aviso(traducirError(e), true); }
  });
}

/* ---------- inscripciones ---------- */
async function pantallaInscripciones() {
  if (!puedeVer('inscripciones') || (!S.admin && esProfesora(S.permisos))) return sinPermiso();
  const l = await q(sb.from('inscripciones').select('id,fecha_alta,fecha_baja,alumnas(id,nombre,apellidos),clases(nombre)').order('creado_en', { ascending: false }).limit(100));
  pintar(cabecera('Inscripciones', { volver: volverDe('inscripciones'), sub: 'Últimos movimientos en clases' }) + `<main class="cont"><div class="lista">${l.map((i) => fila({
    href: `#/alumna/${i.alumnas.id}`, tit: `${i.alumnas.nombre} ${i.alumnas.apellidos || ''}`, det: `${esc(i.clases.nombre)} · ${i.fecha_baja ? 'baja ' + fechaCorta(i.fecha_baja) : 'alta ' + fechaCorta(i.fecha_alta)}`,
    der: i.fecha_baja ? '<span class="chip gris">Baja</span>' : '<span class="chip ok">Alta</span>' })).join('') || vacio('Sin inscripciones todavía.')}</div></main>`, 'mas', puedeEditar('inscripciones') ? '#/inscripcion/nueva' : null);
}
async function formInscripcion(params) {
  const clase = params.get('clase'), alumna = params.get('alumna');
  await pantallaForm({
    titulo: 'Inscribir en clase', tabla: 'inscripciones', modulo: 'inscripciones',
    volver: clase ? `#/clase/${clase}` : alumna ? `#/alumna/${alumna}` : '#/inscripciones',
    valoresIniciales: { clase_id: clase, alumna_id: alumna },
    campos: [
      { k: 'alumna_id', label: 'Alumna', tipo: 'select', req: true, opciones: await intentar(opcionesAlumnas) },
      { k: 'clase_id', label: 'Clase', tipo: 'select', req: true, opciones: await intentar(() => opcionesClases(true)) },
      { k: 'fecha_alta', label: 'Desde', tipo: 'fecha', def: hoyISO() }
    ]
  });
}

// Corregir las fechas de una alumna en una clase (si se puso mal al inscribirla)
async function formFechasInscripcion(id, params) {
  if (!puedeEditar('inscripciones')) return sinPermiso();
  const i = await q(sb.from('inscripciones').select('id,alumna_id,clase_id,fecha_alta,fecha_baja,alumnas(nombre,apellidos),clases(nombre)').eq('id', id).single());
  const volver = params.get('clase') ? `#/clase/${params.get('clase')}` : `#/alumna/${i.alumna_id}`;
  pintar(cabecera('Corregir fechas', { volver, sub: `${nomAlumna(i.alumnas)} · ${i.clases.nombre}` }) + `<main class="cont"><form class="form tarjeta" id="frm">
    <div class="campo"><label for="f_alta">En la clase desde</label><input id="f_alta" type="date" required value="${esc(i.fecha_alta)}"></div>
    ${i.fecha_baja ? `<div class="campo"><label for="f_baja">Hasta (día que la dejó)</label><input id="f_baja" type="date" required value="${esc(i.fecha_baja)}"></div>` : ''}
    <p class="nota">Esta fecha cuenta para saber en qué meses tiene que pagar la mensualidad de esta clase.</p>
    <button class="btn pri ancho" type="submit">Guardar</button>
  </form></main>`, false);
  document.getElementById('frm').onsubmit = async (ev) => {
    ev.preventDefault();
    const alta = document.getElementById('f_alta').value, fb = document.getElementById('f_baja'), baja = fb ? fb.value : null;
    if (baja && baja < alta) { aviso('La fecha de salida no puede ser antes de la de entrada', true); return; }
    try { await q(sb.from('inscripciones').update(baja ? { fecha_alta: alta, fecha_baja: baja } : { fecha_alta: alta }).eq('id', id)); aviso('Fechas corregidas'); location.hash = volver; }
    catch (e) { aviso(traducirError(e), true); }
  };
}

/* ---------- caja ---------- */
const SEL_CAJA = '*,clases(nombre),alumnas(nombre,apellidos),escuelas_amigas(nombre),eventos(titulo)';
// Mientras no esté hecha en la base de datos la migración 014 (apartados y evento), la caja funciona como antes
let cajaSinApartados = false;
const faltaApartado = (e) => /evento|apartado|PGRST200|PGRST204|42703|schema cache/i.test((e && (e.message || e.details || e.hint)) || '');
async function leerCaja(filtrar) {
  const tabla = S.admin ? 'caja_con_autor' : 'caja', viejo = SEL_CAJA.replace(',eventos(titulo)', '');
  if (!cajaSinApartados) {
    try { return await q(filtrar(sb.from(tabla).select(SEL_CAJA))); } catch (e) { if (!faltaApartado(e)) throw e; cajaSinApartados = true; }
  }
  return q(filtrar(sb.from(tabla).select(viejo)));
}
// Apartados de la caja: de dónde viene cada ingreso y en qué se va cada gasto
const APARTADOS = {
  ingreso: [['mensualidad', 'Mensualidad'], ['evento', 'Evento'], ['ventas', 'Ventas sueltas (antiguas)'], ['escuela_amiga', 'Escuela amiga'], ['otro', 'Otro ingreso']],
  gasto: [['limpieza', 'Limpieza'], ['papeleria', 'Papelería'], ['decoracion', 'Decoración'], ['material', 'Material y vestuario'], ['local', 'Local (alquiler, luz, agua)'], ['evento', 'Evento'], ['cambio', 'Cambio (se devuelve)'], ['otro', 'Otro gasto']]
};
// Los movimientos antiguos no tienen apartado: se deduce (con clase = mensualidad; con escuela = escuela amiga)
const apartadoDe = (x) => x.apartado || (x.escuela_amiga_id ? 'escuela_amiga' : x.tipo === 'ingreso' && x.clase_id ? 'mensualidad' : 'otro');
const nombreApartado = (tipo, a) => ((APARTADOS[tipo] || []).find(([k]) => k === a) || [0, 'Otros'])[1];
// El cambio (dinero que se saca para tener cambio y se repone) no es un gasto: no cuenta en los totales
const esCambio = (x) => x.tipo === 'gasto' && x.apartado === 'cambio';
const sumaCaja = (l) => { let i = 0, o = 0; l.forEach((x) => { if (esCambio(x)) return; if (x.tipo === 'ingreso') i += +x.importe; else o += +x.importe; }); return [i, o]; };
// Ingresos en tres montones: mensualidades (cuotas de clase), eventos (actuaciones, festivales, camisetas…) y extras (escuela amiga, otros)
const grupoIngreso = (x) => { const a = apartadoDe(x); return a === 'mensualidad' ? 'mensualidad' : a === 'evento' || a === 'ventas' ? 'eventos' : 'extras'; };
// Las tres tarjetas de arriba son también el filtro: Ingresos (solo ingresos), Gastos (solo gastos), Balance (todo)
const TIPOS_CAJA = ['ingreso', 'gasto', 'todo'];
const tipoCaja = (params) => TIPOS_CAJA.includes(params.get('t')) ? params.get('t') : 'todo';
const filtrarTipo = (movs, t) => t === 'todo' ? movs : movs.filter((x) => x.tipo === t);
const totalesCaja = (i, o, base, t) => `<div class="totales filtro">${[['ingreso', 'Ingresos', 'in', i], ['gasto', 'Gastos', 'out', o], ['todo', 'Balance', '', i - o]]
  .map(([k, txt, c, v]) => `<button type="button" data-ir="${base}t=${k}" class="${t === k ? 'on' : ''}" aria-pressed="${t === k}"><small>${txt}</small><b class="${c}">${eur(v)}</b></button>`).join('')}</div>`;
const ordenRegistro = (a, b) => a.fecha.localeCompare(b.fecha) || String(a.creado_en || '').localeCompare(String(b.creado_en || ''));
// Un movimiento dentro de una tarjeta (o suelto en "Todas")
function movCaja(x, { conFecha = false, conClase = false, volver }) {
  const met = Object.fromEntries(METODOS), d = aFecha(x.fecha);
  const det = [conClase ? (x.clases ? x.clases.nombre : x.escuelas_amigas ? x.escuelas_amigas.nombre : '') : '', x.alumnas ? `${x.alumnas.nombre} ${x.alumnas.apellidos || ''}`.trim() : '',
    x.metodo ? met[x.metodo] : '', x.registrado_por ? 'por ' + x.registrado_por : ''].filter(Boolean).join(' · ');
  const href = puedeEditar('caja') ? `#/caja/${x.id}/editar${volver ? '?volver=' + encodeURIComponent(volver) : ''}` : volver;
  return `<a class="mov" href="${esc(href)}">${conFecha ? `<span class="mov-dia"><b>${d.getDate()}</b>${DIAS_ABR[diaISO(d)]}</span>` : `<span class="mov-tipo ${x.tipo === 'ingreso' ? 'bg-in' : 'bg-out'}"></span>`}
    <span class="txt"><span class="tit">${esc(x.concepto)}</span>${det ? `<span class="det">${esc(det)}</span>` : ''}</span>
    <b class="${x.tipo === 'ingreso' ? 'in' : 'out'}">${x.tipo === 'ingreso' ? '+' : '−'}${eur(x.importe)}</b></a>`;
}
// Tarjetas por apartado: cada clase (mensualidades), cada evento, ventas, limpieza…; lo que no encaja va en "Otros"
function cajaPorClase(movs, { conFecha, volver }) {
  const grupos = new Map();
  movs.slice().sort(ordenRegistro).forEach((x) => {
    const a = apartadoDe(x);
    const [k, nombre, orden, estilo] = a === 'mensualidad' && x.clase_id ? ['c' + x.clase_id, x.clases ? x.clases.nombre : 'Clase', 0, '']
      : a === 'evento' && x.evento_id ? ['v' + x.evento_id, 'Evento · ' + (x.eventos ? x.eventos.titulo : ''), 1, 'externa']
      : a === 'escuela_amiga' && x.escuela_amiga_id ? ['e' + x.escuela_amiga_id, x.escuelas_amigas ? x.escuelas_amigas.nombre : 'Escuela amiga', 2, 'externa']
      : a === 'otro' || a === 'mensualidad' || a === 'evento' ? ['otros', 'Otros', 9, 'otros'] : ['a' + a, nombreApartado(x.tipo, a), 3, 'apart'];
    if (!grupos.has(k)) grupos.set(k, { nombre, orden, estilo, amiga: a === 'escuela_amiga', l: [] });
    grupos.get(k).l.push(x);
  });
  return [...grupos.values()].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es')).map((g) => {
    const [i, o] = sumaCaja(g.l);
    return `<details class="caja-clase ${g.estilo}"><summary class="cc-cab"><span><h3>${esc(g.nombre)}</h3><small>${g.l.length} movimiento${g.l.length === 1 ? '' : 's'}${g.amiga ? ' · Escuela amiga' : ''}</small></span>
      <span class="cc-tot">${i ? `<b class="in">+${eur(i)}</b>` : ''}${o ? `<b class="out">−${eur(o)}</b>` : ''}</span><span class="cc-flecha">${ico('sig', 20)}</span></summary>
      <div class="cc-movs">${g.l.map((x) => movCaja(x, { conFecha, volver })).join('')}</div></details>`;
  }).join('');
}
// Mensualidad: por clase, alumnas que han pagado (y las que faltan) y lo cobrado; arriba el total de todas las clases
const esCuota = (x) => x.tipo === 'ingreso' && apartadoDe(x) === 'mensualidad' && x.alumna_id && x.clase_id;
function cajaMensualidad(movs, ins) {
  const grupos = new Map(), nom = (al) => al ? `${al.nombre} ${al.apellidos || ''}`.trim() : 'Alumna';
  const grupo = (id, nombre) => { if (!grupos.has(id)) grupos.set(id, { nombre, al: new Map(), faltan: new Map(), total: 0 }); return grupos.get(id); };
  movs.filter(esCuota).forEach((x) => {
    const g = grupo(x.clase_id, x.clases ? x.clases.nombre : 'Clase'), a = g.al.get(x.alumna_id) || { nombre: nom(x.alumnas), importe: 0, n: 0 };
    a.importe += +x.importe; a.n++; g.al.set(x.alumna_id, a); g.total += +x.importe;
  });
  (ins || []).forEach((x) => { const g = grupo(x.clase_id, x.clases ? x.clases.nombre : 'Clase'); if (!g.al.has(x.alumna_id)) g.faltan.set(x.alumna_id, nom(x.alumnas)); });
  const lista = [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const nAl = lista.reduce((t, g) => t + g.al.size, 0), nFal = lista.reduce((t, g) => t + g.faltan.size, 0), total = lista.reduce((t, g) => t + g.total, 0);
  const porNombre = (a, b) => a.localeCompare(b, 'es');
  const tarjetas = lista.map((g) => {
    const n = g.al.size, de = ins ? ` de ${n + g.faltan.size}` : '';
    const pagadas = [...g.al.values()].sort((a, b) => porNombre(a.nombre, b.nombre)).map((a) => `<div class="mov"><span class="mov-tipo bg-in"></span><span class="txt"><span class="tit">${esc(a.nombre)}</span>${a.n > 1 ? `<span class="det">${a.n} pagos</span>` : ''}</span><b class="in">${eur(a.importe)}</b></div>`).join('');
    const faltan = [...g.faltan.values()].sort(porNombre).map((f) => `<div class="mov falta"><span class="mov-tipo"></span><span class="txt"><span class="tit">${esc(f)}</span></span><b>Pendiente</b></div>`).join('');
    return `<details class="caja-clase"><summary class="cc-cab"><span><h3>${esc(g.nombre)}</h3><small>${n}${de} alumna${n === 1 && !de ? '' : 's'} pagada${n === 1 && !de ? '' : 's'}${g.faltan.size ? ` · faltan ${g.faltan.size}` : ''}</small></span>
      <span class="cc-tot"><b class="in">${eur(g.total)}</b></span><span class="cc-flecha">${ico('sig', 20)}</span></summary>
      <div class="cc-movs">${pagadas}${faltan}</div></details>`;
  }).join('');
  return totalCaja('', 'Total mensualidades', `${nAl} alumna${nAl === 1 ? '' : 's'} pagada${nAl === 1 ? '' : 's'}`, ins && nFal ? `Faltan ${nFal}` : '', total) + tarjetas;
}
const totalCaja = (clase, titulo, linea, extra, importe) => `<div class="mens-total ${clase}"><span><small>${titulo}</small>${linea ? `<b>${linea}</b>` : ''}${extra ? `<em>${extra}</em>` : ''}</span><b class="mens-eur">${eur(importe)}</b></div>`;
// Movimientos del mes según la tarjeta pulsada arriba (Ingresos, Gastos o Balance), agrupados por clase
// Cajón de eventos y ventas: lo cobrado este mes en cada evento y lo que falta por cobrar de sus reservas
const esDeEvento = (x) => x.tipo === 'ingreso' && apartadoDe(x) === 'evento' && x.evento_id;
function cajaVentas(movs, pendientes, { conFecha, volver } = {}) {
  const sueltos = movs.filter((x) => x.tipo === 'ingreso' && grupoIngreso(x) === 'eventos' && !esDeEvento(x)), [ts] = sumaCaja(sueltos);
  const grupos = new Map(), grupo = (id, titulo) => { if (!grupos.has(id)) grupos.set(id, { titulo, cob: [], pen: [] }); return grupos.get(id); };
  movs.filter(esDeEvento).forEach((x) => grupo(x.evento_id, x.eventos ? x.eventos.titulo : 'Evento').cob.push(x));
  (pendientes || []).forEach((r) => grupo(r.evento_id, r.eventos ? r.eventos.titulo : 'Evento').pen.push(r));
  if (!grupos.size && !sueltos.length) return vacio('Sin eventos ni ventas este mes.');
  const lista = [...grupos.entries()].sort((a, b) => a[1].titulo.localeCompare(b[1].titulo, 'es'));
  const total = lista.reduce((t, [, g]) => t + g.cob.reduce((u, x) => u + +x.importe, 0), 0);
  const nCob = lista.reduce((t, [, g]) => t + g.cob.length, 0), nPen = lista.reduce((t, [, g]) => t + g.pen.length, 0);
  const tarjetas = lista.map(([id, g]) => {
    const cob = g.cob.reduce((t, x) => t + +x.importe, 0), falta = g.pen.reduce((t, r) => t + +r.importe, 0);
    return `<a class="caja-clase externa enlace-ev" href="#/evento/${id}"><span class="cc-cab"><span><h3>${esc(g.titulo)}</h3><small>${g.cob.length} cobro${g.cob.length === 1 ? '' : 's'}${g.pen.length ? ` · faltan ${g.pen.length} (${eur(falta)})` : ''}</small></span>
      <span class="cc-tot"><b class="in">${eur(cob)}</b></span><span class="cc-flecha">${ico('sig', 20)}</span></span></a>`;
  }).join('');
  const n = nCob + sueltos.length;
  return totalCaja('ventas', 'Total eventos', `${n} cobro${n === 1 ? '' : 's'}`, nPen ? `Faltan ${nPen} por cobrar` : '', total + ts) + tarjetas + (sueltos.length ? cajaPorClase(sueltos, { conFecha, volver }) : '');
}
// Lo que se ve debajo del calendario según la tarjeta de arriba y el botón elegido
const SUBCAJA = { ingreso: [['mensualidad', 'Mensualidad'], ['eventos', 'Eventos'], ['total', 'Total']], gasto: [['extras', 'Extras'], ['cambio', 'Cambio']] };
const subCaja = (params, t) => { const l = SUBCAJA[t] || [], s = params.get('s'); return l.some(([k]) => k === s) ? s : l.length ? l[0][0] : ''; };
const filtrosCaja = (mes, t, s) => SUBCAJA[t] ? `<div class="filtros">${SUBCAJA[t].map(([k, txt]) => `<button data-ir="#/caja?mes=${mes}&t=${t}&s=${k}" class="${s === k ? 'on' : ''}">${txt}</button>`).join('')}</div>` : '';
// Resumen en filas: Mensualidades 400 € ›, Eventos 90 € ›…
const filaResumen = (txt, det, imp, href, clase = 'in') => `<a class="mov" href="${href}"><span class="txt"><span class="tit">${txt}</span>${det ? `<span class="det">${det}</span>` : ''}</span><b class="${clase}">${imp}</b>${ico('sig', 16)}</a>`;
function cajaCambio(cambios, editar) {
  const fuera = cambios.filter((x) => !x.devuelto_en), tf = fuera.reduce((t, x) => t + +x.importe, 0);
  const dia = (f) => aFecha(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const filas = cambios.slice().sort((a, b) => (!!a.devuelto_en - !!b.devuelto_en) || a.fecha.localeCompare(b.fecha)).map((x) => `<div class="reserva ${x.devuelto_en ? 'pagada' : ''}">
    <span class="txt"><span class="tit">${esc(x.concepto || 'Cambio')}</span><span class="det">${esc(['Sacado el ' + dia(x.fecha), x.registrado_por ? 'por ' + x.registrado_por : ''].filter(Boolean).join(' · '))}</span></span>
    <b>${eur(x.importe)}</b>${x.devuelto_en ? `<span class="vt-ok">${ico('check', 16)} Devuelto ${dia(x.devuelto_en)}</span>` : editar ? `<button class="vt-cobrar" data-devuelto="${x.id}">Devuelto</button>` : '<span class="chip gris">Fuera</span>'}</div>`).join('');
  return totalCaja('cambio', 'Cambio fuera de la caja', fuera.length ? `${fuera.length} sin devolver` : 'Todo devuelto', 'No cuenta como gasto', tf)
    + (filas ? `<div class="tarjeta reservas">${filas}</div>` : vacio('No se ha sacado cambio este mes.'));
}
function cajaMes(movs, t, s, ins, { conFecha = true, volver, pendientes = [], cambios = [], mes }) {
  const [i, o] = sumaCaja(movs), ing = movs.filter((x) => x.tipo === 'ingreso'), gas = movs.filter((x) => x.tipo === 'gasto' && !esCambio(x));
  const por = (g) => ing.filter((x) => grupoIngreso(x) === g), suma = (l) => sumaCaja(l)[0];
  const [men, evs, ext] = ['mensualidad', 'eventos', 'extras'].map(por), fuera = cambios.filter((x) => !x.devuelto_en).reduce((t, x) => t + +x.importe, 0);
  const ir = (tt, ss) => `#/caja?mes=${mes}&t=${tt}&s=${ss}`;
  if (t === 'ingreso' && s === 'mensualidad') {
    const sueltas = men.filter((x) => !esCuota(x));
    return `<div class="lista">${cajaMensualidad(men, ins)}${sueltas.length ? `<div class="seccion">Otras mensualidades</div>${cajaPorClase(sueltas, { conFecha, volver })}` : ''}</div>`;
  }
  if (t === 'ingreso' && s === 'eventos') return `<div class="lista">${cajaVentas(evs, pendientes, { conFecha, volver })}${puedeEditar('eventos') ? `<a class="btn pri" href="#/evento/nuevo?venta=1">${ico('mas')} Nueva venta o evento</a>` : ''}</div>`;
  if (t === 'ingreso') return `<div class="lista">${totalCaja('solo', 'Total ingresos del mes', '', '', i)}
    <div class="tarjeta reservas">${filaResumen('Mensualidades', `${men.length} cobro${men.length === 1 ? '' : 's'}`, eur(suma(men)), ir('ingreso', 'mensualidad'))}${filaResumen('Eventos', `${evs.length} cobro${evs.length === 1 ? '' : 's'}`, eur(suma(evs)), ir('ingreso', 'eventos'))}</div>
    ${ext.length ? `<div class="seccion">Extras · ${eur(suma(ext))}</div>${cajaPorClase(ext, { conFecha, volver })}` : ''}</div>`;
  if (t === 'gasto' && s === 'cambio') return `<div class="lista">${cajaCambio(cambios, puedeEditar('caja'))}</div>`;
  if (t === 'gasto') return `<div class="lista">${totalCaja('gasto', 'Total gastos', `${gas.length} gasto${gas.length === 1 ? '' : 's'}`, '', o)}${gas.length ? cajaPorClase(gas, { conFecha, volver }) : vacio('Sin gastos este mes.')}</div>`;
  // Balance: todo junto
  return `<div class="lista">${totalCaja('balance', 'Balance del mes', `Ingresos ${eur(i)} · Gastos ${eur(o)}`, fuera ? `Cambio fuera: ${eur(fuera)} (no cuenta)` : '', i - o)}
    <div class="tarjeta reservas">${filaResumen('Mensualidades', '', '+' + eur(suma(men)), ir('ingreso', 'mensualidad'))}${filaResumen('Eventos', '', '+' + eur(suma(evs)), ir('ingreso', 'eventos'))}${filaResumen('Extras', 'Escuela amiga y otros', '+' + eur(suma(ext)), ir('ingreso', 'total'))}${filaResumen('Gastos', 'Limpieza, papelería, decoración…', '−' + eur(o), ir('gasto', 'extras'), 'out')}${fuera ? filaResumen('Cambio fuera', 'Se repone a fin de mes', eur(fuera), ir('gasto', 'cambio'), '') : ''}</div></div>`;
}
async function pantallaCaja(params) {
  if (!puedeVer('caja')) return sinPermiso();
  if (params.get('v') === 'horas') return await pantallaHoras(params);
  const hoy = hoyISO();
  const mes = params.get('mes') || hoy.slice(0, 7), t = tipoCaja(params), sc = subCaja(params, t);
  const [y, m] = mes.split('-').map(Number);
  const ini = `${mes}-01`, fin = `${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01`;
  const movs = await leerCaja((r) => r.gte('fecha', ini).lt('fecha', fin).order('fecha').order('creado_en'));
  const porDia = {}; movs.forEach((x) => { (porDia[x.fecha] = porDia[x.fecha] || []).push(x); });
  const [tIn, tOut] = sumaCaja(movs);
  // Alumnas inscritas en algún momento del mes (para saber quién falta por pagar)
  // Reservas de eventos aún sin cobrar (para el cajón de eventos y ventas)
  // Cambio: el de este mes y el que siga fuera de meses anteriores
  const cambios = t !== 'ingreso' && !cajaSinApartados ? await intentar(() => q(sb.from(S.admin ? 'caja_con_autor' : 'caja').select('*').eq('apartado', 'cambio').or(`devuelto_en.is.null,fecha.gte.${ini}`).lt('fecha', fin).order('fecha'))) : [];
  const pendientes = t === 'ingreso' && sc === 'eventos' ? await intentar(() => q(sb.from('evento_reservas').select('id,evento_id,cantidad,importe,comprador,alumnas(nombre,apellidos),evento_articulos(nombre),eventos(titulo)').eq('estado', 'reservada'))) : [];
  const ins = t === 'ingreso' && sc === 'mensualidad' && puedeVer('inscripciones')
    ? await intentar(() => q(sb.from('inscripciones').select('clase_id,alumna_id,alumnas(nombre,apellidos),clases(nombre)').lt('fecha_alta', fin).or(`fecha_baja.is.null,fecha_baja.gte.${ini}`))) : null;
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`, next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const primero = (new Date(y, m - 1, 1).getDay() + 6) % 7, nDias = new Date(y, m, 0).getDate();
  // Plegado: solo la semana de hoy (o la primera del mes si es otro mes); al pulsar se ve el mes entero
  const filaDe = (d) => Math.floor((primero + d - 1) / 7);
  const semana = mes === hoy.slice(0, 7) ? filaDe(+hoy.slice(8, 10)) : 0;
  let cal = DIAS_C.map((d) => `<div class="dow">${d}</div>`).join('') + `<div class="${semana === 0 ? 'sem' : ''}"></div>`.repeat(primero);
  for (let d = 1; d <= nDias; d++) {
    const f = `${mes}-${pad(d)}`, l = porDia[f] || [];
    const pi = t !== 'gasto' && l.some((x) => x.tipo === 'ingreso'), po = t !== 'ingreso' && l.some((x) => x.tipo === 'gasto');
    cal += `<button data-ir="#/caja/dia/${f}?t=${t}" class="${f === hoy ? 'hoy' : ''} ${pi || po ? 'con' : ''} ${filaDe(d) === semana ? 'sem' : ''}">${d}<span class="puntos">${pi ? '<i class="bg-in"></i>' : ''}${po ? '<i class="bg-out"></i>' : ''}</span></button>`;
  }
  const titulo = capital(new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
  pintar(cabecera('Caja', { volver: '#/inicio', sub: 'Ingresos y gastos del mes' }) + `<main class="cont">
    <div class="mes"><button data-ir="#/caja?mes=${prev}&t=${t}" aria-label="Mes anterior">${ico('volver')}</button><h2>${titulo}</h2><button data-ir="#/caja?mes=${next}&t=${t}" aria-label="Mes siguiente">${ico('sig')}</button></div>
    ${totalesCaja(tIn, tOut, `#/caja?mes=${mes}&`, t)}
    <div class="tarjeta"><div class="calendario plegado" id="cal">${cal}</div>
      <button class="cal-mas" id="cal-mas" type="button" aria-expanded="false"><span>Ver el mes entero</span>${ico('abajo', 18)}</button></div>
    <div class="seccion">Movimientos del mes</div>
    ${filtrosCaja(mes, t, sc)}
    ${cajaMes(movs, t, sc, ins, { volver: `#/caja?mes=${mes}&t=${t}&s=${sc}`, pendientes, cambios, mes })}
  </main>`, 'caja', puedeEditar('caja') ? `#/caja/nuevo?fecha=${mes === hoy.slice(0, 7) ? hoy : ini}${t !== 'todo' ? '&tipo=' + t : ''}${sc === 'cambio' ? '&apartado=cambio' : sc === 'eventos' ? '&apartado=evento' : ''}&volver=${encodeURIComponent(`#/caja?mes=${mes}&t=${t}&s=${sc}`)}` : null);
  $app.querySelectorAll('[data-devuelto]').forEach((b) => b.onclick = async () => {
    b.disabled = true;
    try { await q(sb.from('caja').update({ devuelto_en: hoy }).eq('id', b.dataset.devuelto)); aviso('Apuntado: el cambio ya está devuelto'); router(); }
    catch (e) { aviso(traducirError(e), true); b.disabled = false; }
  });
  document.getElementById('cal-mas').onclick = (ev) => {
    const b = ev.currentTarget, abierto = document.getElementById('cal').classList.toggle('plegado') === false;
    b.setAttribute('aria-expanded', abierto); b.querySelector('span').textContent = abierto ? 'Ver solo esta semana' : 'Ver el mes entero';
  };
}
/* ---------- Caja › Horas de las profesoras ----------
   Se calculan con el horario de cada clase y los días del mes; las faltas, cambios y días sin clase
   se apuntan aparte (tablas clases_cambios y dias_sin_clase). */
const horasTxt = (min) => (min / 60).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' h';
const diasDelMes = (mes) => { const [y, m] = mes.split('-').map(Number), n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${mes}-${pad(i + 1)}`); };
async function datosHoras(mes) {
  const dias = diasDelMes(mes), ini = dias[0], fin = dias[dias.length - 1];
  const [clases, profes, equipo, cambios, festivos] = await Promise.all([
    q(sb.from('clases').select('id,nombre,activa,profesora_id,escuela_amiga_id,' + SEL_HOR).eq('activa', true).is('escuela_amiga_id', null)),
    q(sb.from('profesoras').select('id,nombre,activa').order('nombre')),
    intentar(() => q(sb.rpc('equipo_sin_ficha'))),
    q(sb.from('clases_cambios').select('*').gte('fecha', ini).lte('fecha', fin).order('fecha')),
    q(sb.from('dias_sin_clase').select('*').gte('fecha', ini).lte('fecha', fin).order('fecha'))
  ]);
  return { dias, clases, profes, equipo, cambios, festivos };
}
function calcularHoras(mes, { dias, clases, profes, equipo, cambios, festivos }) {
  const nombre = {}; profes.forEach((p) => { nombre['p:' + p.id] = p.nombre; }); equipo.forEach((e) => { nombre['e:' + e.id] = e.nombre; });
  const sinClase = new Set(festivos.map((f) => f.fecha));
  const cambio = {}; cambios.forEach((c) => { cambio[c.fecha + '|' + c.clase_id] = c; });
  const P = {}; // persona → { min, clases: {claseId: {nombre, min, n, txt}}, extra: [], faltas: [] }
  const de = (k) => (P[k] = P[k] || { k, nombre: nombre[k] || 'Sin profesora', min: 0, n: 0, clases: {}, extra: [], faltas: [] });
  dias.forEach((f) => {
    if (sinClase.has(f)) return;
    const ds = diaISO(aFecha(f));
    clases.forEach((c) => {
      const hs = (c.clase_horarios || []).filter((h) => h.dia_semana === ds); if (!hs.length) return;
      const min = hs.reduce((t, h) => t + toMin(h.hora_fin) - toMin(h.hora_inicio), 0);
      const titular = c.profesora_id ? 'p:' + c.profesora_id : 'sin', cb = cambio[f + '|' + c.id];
      if (cb) {
        const quien = cb.anulada ? null : cb.cubre_profesora_id ? 'p:' + cb.cubre_profesora_id : 'e:' + cb.cubre_perfil_id;
        if (quien === titular) { /* sin cambio real */ } else {
          if (quien) { const x = de(quien); x.min += min; x.n++; x.extra.push({ f, c, min, por: nombre[titular] }); }
          de(titular).faltas.push({ f, c, min, cubre: quien ? nombre[quien] || '¿?' : null, cb });
          return;
        }
      }
      const x = de(titular); x.min += min; x.n++;
      const g = (x.clases[c.id] = x.clases[c.id] || { c, min: 0, n: 0, dur: min }); g.min += min; g.n++;
    });
  });
  const lista = Object.values(P).sort((a, b) => (a.k === 'sin') - (b.k === 'sin') || a.nombre.localeCompare(b.nombre));
  const semanas = Math.ceil((dias.length + ((aFecha(dias[0]).getDay() + 6) % 7)) / 7);
  return { lista, total: lista.filter((x) => x.k !== 'sin').reduce((t, x) => t + x.min, 0), semanas };
}
// Horas de cada clase en el mes: las de su profesora y las que cubrió otra persona
function horasPorClase(r) {
  const h = {}, de = (id) => (h[id] = h[id] || { min: 0, otras: [] });
  r.lista.forEach((x) => {
    Object.entries(x.clases).forEach(([id, g]) => { de(id).min += g.min; });
    x.extra.forEach((e) => { de(e.c.id).min += e.min; de(e.c.id).otras.push(`${x.nombre.split(' ')[0]} cubrió ${horasTxt(e.min)}`); });
    x.faltas.filter((e) => !e.cubre).forEach((e) => { de(e.c.id).otras.push(`Anulada ${aFecha(e.f).getDate()}/${aFecha(e.f).getMonth() + 1}`); });
  });
  return h;
}
async function pantallaHoras(params) {
  if (!puedeVer('caja')) return sinPermiso();
  const hoy = hoyISO(), mes = params.get('mes') || hoy.slice(0, 7);
  const d = await datosHoras(mes), r = calcularHoras(mes, d), ed = puedeEditar('caja');
  const [y, m] = mes.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`, next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const diaC = (f) => capital(aFecha(f).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }));
  const tarjeta = (x) => {
    const filas = Object.values(x.clases).sort((a, b) => ordenClase(a.c) - ordenClase(b.c)).map((g) => `<div class="mov"><span class="txt"><span class="tit">${esc(g.c.nombre)}</span><span class="det">${esc(textoHorario(g.c))} · ${g.n} clase${g.n === 1 ? '' : 's'}</span></span><b>${horasTxt(g.min)}</b></div>`)
      .concat(x.extra.map((e) => `<div class="mov"><span class="txt"><span class="tit">Cubrió${e.por ? ' a ' + esc(e.por.split(' ')[0]) : ''} · ${esc(e.c.nombre)}</span><span class="det">${diaC(e.f)}</span></span><b class="in">+${horasTxt(e.min)}</b></div>`))
      .concat(x.faltas.map((e) => `<div class="mov"><span class="txt"><span class="tit">${e.cubre ? 'Faltó · la cubrió ' + esc(e.cubre.split(' ')[0]) : 'Clase anulada'} · ${esc(e.c.nombre)}</span><span class="det">${diaC(e.f)}${e.cb.nota ? ' · ' + esc(e.cb.nota) : ''}</span></span><b class="out">−${horasTxt(e.min)}</b></div>`));
    const det = [`${x.n} clase${x.n === 1 ? '' : 's'}`, x.extra.length ? `cubrió ${x.extra.length}` : '', x.faltas.length ? `faltó ${x.faltas.length}` : ''].filter(Boolean).join(' · ');
    return `<details class="caja-clase ${x.k === 'sin' ? 'otros' : ''}"><summary class="cc-cab"><span><h3>${esc(x.nombre)}</h3><small>${det}</small></span><span class="cc-tot"><b style="color:var(--morado3)">${horasTxt(x.min)}</b></span><span class="cc-flecha">${ico('sig', 18)}</span></summary>
      <div class="cc-movs">${filas.join('')}</div></details>`;
  };
  const cambiosTxt = d.cambios.length + d.festivos.length;
  pintar(cabecera('Horas del mes', { volver: '#/clases', sub: 'Horas de las profesoras' }) + `<main class="cont">
    <div class="mes"><button data-ir="#/horas?mes=${prev}" aria-label="Mes anterior">${ico('volver')}</button><h2>${nombreMes(mes + '-01')}</h2><button data-ir="#/horas?mes=${next}" aria-label="Mes siguiente">${ico('sig')}</button></div>
    <div class="tarjeta horas-total"><div class="ht-sup">Horas del mes · ${r.semanas} semanas</div><div class="ht-num">${horasTxt(r.total)}</div>
      <div class="ht-det">${r.lista.filter((x) => x.k !== 'sin').length} persona${r.lista.filter((x) => x.k !== 'sin').length === 1 ? '' : 's'}${cambiosTxt ? ` · ${d.cambios.length} cambio${d.cambios.length === 1 ? '' : 's'} · ${d.festivos.length} día${d.festivos.length === 1 ? '' : 's'} sin clase` : ''}</div></div>
    <div class="lista">${r.lista.map(tarjeta).join('') || vacio('No hay clases con horario este mes.')}</div>
    ${ed ? `<a class="btn sec" href="#/caja/cambio?mes=${mes}">${ico('mas')} Apuntar una falta o un cambio</a>` : ''}
    <div class="seccion">Faltas y cambios del mes</div>
    <div class="lista">${d.cambios.map((c) => { const cl = d.clases.find((x) => x.id === c.clase_id); const quien = c.anulada ? 'Anulada' : 'La da ' + ((c.cubre_profesora_id ? (d.profes.find((p) => p.id === c.cubre_profesora_id) || {}).nombre : (d.equipo.find((e) => e.id === c.cubre_perfil_id) || {}).nombre) || '¿?');
      return fila({ iconoHtml: `<span class="ini">${ico('profe', 18)}</span>`, href: ed ? `#/caja/cambio?mes=${mes}&id=${c.id}` : `#/horas?mes=${mes}`, tit: `${diaC(c.fecha)} · ${cl ? cl.nombre : 'Clase'}`, det: esc(quien + (c.nota ? ' · ' + c.nota : '')) }); }).join('') || vacio('Ninguna falta apuntada.')}</div>
    <div class="seccion">Días sin clase</div>
    <div class="lista">${d.festivos.map((f) => fila({ iconoHtml: `<span class="ini" style="color:#9A6326;background:rgba(242,196,141,0.25)">${ico('clases', 18)}</span>`, href: ed ? `#/caja/festivo?mes=${mes}&fecha=${f.fecha}` : `#/horas?mes=${mes}`, tit: diaC(f.fecha), det: esc(f.motivo || 'Sin clase para nadie') })).join('') || vacio('Ningún festivo este mes.')}</div>
    ${ed ? `<a class="btn sec" href="#/caja/festivo?mes=${mes}">${ico('mas')} Marcar un día sin clase</a>` : ''}
  </main>`, 'clases');
}
async function formCambio(params) {
  if (!puedeEditar('caja')) return sinPermiso();
  const id = params.get('id'), mes = params.get('mes') || hoyISO().slice(0, 7), volver = `#/horas?mes=${mes}`;
  const reg = id ? await q(sb.from('clases_cambios').select('*').eq('id', id).single()) : null;
  const d = await datosHoras((reg ? reg.fecha : mes + '-01').slice(0, 7));
  const fecha0 = reg ? reg.fecha : (mes === hoyISO().slice(0, 7) ? hoyISO() : mes + '-01');
  const profeDe = (c) => d.profes.find((p) => p.id === c.profesora_id);
  pintar(cabecera(id ? 'Editar cambio' : 'Falta o cambio', { volver, sub: 'Horas de las profesoras' }) + `<main class="cont"><form class="form tarjeta" id="frm">
    <div class="campo"><label for="f_fecha">Día *</label><input id="f_fecha" type="date" value="${fecha0}" required></div>
    <div class="campo"><label for="f_clase">Clase *</label><select id="f_clase" required></select></div>
    <div class="campo"><label for="f_quien">¿Quién la da ese día? *</label><select id="f_quien" required></select>
      <div class="ayuda">Si la da otra persona, se le suma la hora. Si nadie, la clase no cuenta para nadie.</div></div>
    <div class="campo"><label for="f_nota">Nota (opcional)</label><input id="f_nota" value="${esc(reg ? reg.nota || '' : '')}" placeholder="Por ejemplo: de médico"></div>
  </form>
  <div class="resumen-cambio" id="resumen"></div>
  <button class="btn pri" id="guardar">Guardar</button>
  ${reg ? '<button class="btn peligro" id="borrar">Borrar este cambio</button>' : ''}</main>`, 'caja');
  const $f = document.getElementById('f_fecha'), $c = document.getElementById('f_clase'), $q = document.getElementById('f_quien'), $r = document.getElementById('resumen');
  const clasesDia = () => { const ds = $f.value ? diaISO(aFecha($f.value)) : 0; return d.clases.filter((c) => (c.clase_horarios || []).some((h) => h.dia_semana === ds)).sort((a, b) => ordenClase(a) - ordenClase(b)); };
  const pintarClases = (sel) => {
    const l = clasesDia();
    $c.innerHTML = l.length ? l.map((c) => { const h = c.clase_horarios.filter((x) => x.dia_semana === diaISO(aFecha($f.value)))[0]; const p = profeDe(c);
      return `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)} · ${hora(h.hora_inicio)}–${hora(h.hora_fin)}${p ? ' (' + esc(p.nombre) + ')' : ''}</option>`; }).join('') : '<option value="">Ese día no hay clases</option>';
  };
  const pintarQuien = (sel) => {
    const c = d.clases.find((x) => x.id === $c.value);
    const otras = d.profes.filter((p) => p.activa && (!c || p.id !== c.profesora_id));
    $q.innerHTML = (otras.length ? `<optgroup label="Profesoras">${otras.map((p) => `<option value="p:${p.id}" ${sel === 'p:' + p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</optgroup>` : '')
      + (d.equipo.length ? `<optgroup label="Resto del equipo">${d.equipo.map((e) => `<option value="e:${e.id}" ${sel === 'e:' + e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</optgroup>` : '')
      + `<option value="nadie" ${sel === 'nadie' ? 'selected' : ''}>Nadie, se anula la clase</option>`;
    resumen();
  };
  const resumen = () => {
    const c = d.clases.find((x) => x.id === $c.value); if (!c) { $r.innerHTML = ''; return; }
    const h = c.clase_horarios.filter((x) => x.dia_semana === diaISO(aFecha($f.value))).reduce((t, x) => t + toMin(x.hora_fin) - toMin(x.hora_inicio), 0);
    const p = profeDe(c), txt = $q.options[$q.selectedIndex] ? $q.options[$q.selectedIndex].text : '';
    $r.innerHTML = `${p ? `Se quita ${horasTxt(h)} a <b>${esc(p.nombre)}</b>` : 'Esta clase no tiene profesora'}${$q.value === 'nadie' ? ' y no se suma a nadie.' : ` y se suma ${horasTxt(h)} a <b>${esc(txt)}</b>.`}`;
  };
  pintarClases(reg && reg.clase_id);
  pintarQuien(reg ? (reg.anulada ? 'nadie' : reg.cubre_profesora_id ? 'p:' + reg.cubre_profesora_id : 'e:' + reg.cubre_perfil_id) : null);
  $f.onchange = () => { if ($f.value.slice(0, 7) !== d.dias[0].slice(0, 7)) { location.hash = `#/caja/cambio?mes=${$f.value.slice(0, 7)}`; return; } pintarClases(); pintarQuien(); };
  $c.onchange = () => pintarQuien($q.value); $q.onchange = resumen;
  document.getElementById('guardar').onclick = async (ev) => {
    const c = d.clases.find((x) => x.id === $c.value); if (!c) return aviso('Elige una clase', true);
    const v = $q.value, datos = { fecha: $f.value, clase_id: c.id, falta_profesora_id: c.profesora_id || null, anulada: v === 'nadie',
      cubre_profesora_id: v.startsWith('p:') ? v.slice(2) : null, cubre_perfil_id: v.startsWith('e:') ? v.slice(2) : null, nota: document.getElementById('f_nota').value.trim() || null };
    ev.target.disabled = true;
    try {
      await q(reg ? sb.from('clases_cambios').update(datos).eq('id', reg.id) : sb.from('clases_cambios').insert(datos));
      aviso('Guardado'); location.hash = `#/horas?mes=${datos.fecha.slice(0, 7)}`;
    } catch (e) { ev.target.disabled = false; aviso(/duplicate key/i.test(e.message || '') ? 'Esa clase ya tiene un cambio apuntado ese día. Ábrelo desde la lista para cambiarlo.' : traducirError(e), true); }
  };
  const bb = document.getElementById('borrar');
  if (bb) bb.onclick = async () => { if (!confirm('¿Borrar este cambio? La clase vuelve a contar para su profesora.')) return;
    try { await q(sb.from('clases_cambios').delete().eq('id', reg.id)); aviso('Borrado'); location.hash = volver; } catch (e) { aviso(traducirError(e), true); } };
}
async function formFestivo(params) {
  if (!puedeEditar('caja')) return sinPermiso();
  const mes = params.get('mes') || hoyISO().slice(0, 7), f0 = params.get('fecha'), volver = `#/horas?mes=${mes}`;
  const reg = f0 ? await q(sb.from('dias_sin_clase').select('*').eq('fecha', f0).maybeSingle()) : null;
  pintar(cabecera(reg ? 'Día sin clase' : 'Marcar día sin clase', { volver, sub: 'No cuenta horas para nadie' }) + `<main class="cont"><form class="form tarjeta" id="frm">
    <div class="campo"><label for="f_fecha">Día *</label><input id="f_fecha" type="date" value="${reg ? reg.fecha : (mes === hoyISO().slice(0, 7) ? hoyISO() : mes + '-01')}" required ${reg ? 'disabled' : ''}></div>
    <div class="campo"><label for="f_motivo">Motivo</label><input id="f_motivo" value="${esc(reg ? reg.motivo || '' : '')}" placeholder="Por ejemplo: Navidad, festivo local"></div>
  </form>
  <button class="btn pri" id="guardar">Guardar</button>
  ${reg ? '<button class="btn peligro" id="borrar">Quitar: ese día sí hay clase</button>' : ''}</main>`, 'caja');
  document.getElementById('guardar').onclick = async (ev) => {
    const fecha = document.getElementById('f_fecha').value, motivo = document.getElementById('f_motivo').value.trim() || null;
    if (!fecha) return aviso('Elige el día', true);
    ev.target.disabled = true;
    try {
      await q(reg ? sb.from('dias_sin_clase').update({ motivo }).eq('fecha', reg.fecha) : sb.from('dias_sin_clase').insert({ fecha, motivo }));
      aviso('Guardado'); location.hash = `#/horas?mes=${fecha.slice(0, 7)}`;
    } catch (e) { ev.target.disabled = false; aviso(traducirError(e), true); }
  };
  const bb = document.getElementById('borrar');
  if (bb) bb.onclick = async () => { try { await q(sb.from('dias_sin_clase').delete().eq('fecha', reg.fecha)); aviso('Quitado'); location.hash = volver; } catch (e) { aviso(traducirError(e), true); } };
}
async function pantallaCajaDia(fecha, params) {
  if (!puedeVer('caja')) return sinPermiso();
  const t = tipoCaja(params);
  const movs = await leerCaja((r) => r.eq('fecha', fecha).order('creado_en'));
  const [i, o] = sumaCaja(movs), l = filtrarTipo(movs, t);
  pintar(cabecera(capital(fechaLarga(fecha)), { volver: `#/caja?mes=${fecha.slice(0, 7)}&t=${t}`, sub: 'Caja del día' }) + `<main class="cont">
    ${totalesCaja(i, o, `#/caja/dia/${fecha}?`, t)}
    ${l.length ? `<div class="lista">${cajaPorClase(l, { conFecha: false, volver: `#/caja/dia/${fecha}?t=${t}` })}</div>` : vacio(t === 'ingreso' ? 'No hay ingresos este día.' : t === 'gasto' ? 'No hay gastos este día.' : 'No hay movimientos este día.')}
  </main>`, 'caja', puedeEditar('caja') ? `#/caja/nuevo?fecha=${fecha}${t !== 'todo' ? '&tipo=' + t : ''}` : null);
}
async function formCaja(params, id = null) {
  if (!puedeEditar('caja')) return sinPermiso();
  const reg = id ? await q(sb.from('caja').select('*').eq('id', id).single()) : null;
  const ini = reg || { fecha: params.get('fecha') || hoyISO(), tipo: params.get('tipo') || 'ingreso', importe: params.get('importe'), concepto: params.get('concepto'),
    escuela_amiga_id: params.get('escuela'), evento_id: params.get('evento'), apartado: params.get('apartado') || (params.get('escuela') ? 'escuela_amiga' : null) };
  let tipo = ini.tipo, apartado = reg ? apartadoDe(reg) : ini.apartado || (tipo === 'ingreso' ? 'mensualidad' : 'limpieza');
  const [clases, alumnas, escuelas, eventos] = await Promise.all([
    puedeVer('clases') ? intentar(() => opcionesClases(true)) : [], puedeVer('alumnas') ? intentar(opcionesAlumnas) : [], puedeVer('escuelas_amigas') ? intentar(opcionesEscuelas) : [],
    puedeVer('eventos') ? intentar(async () => (await q(sb.from('eventos').select('id,titulo,fecha').order('fecha', { ascending: false }).limit(50))).map((e) => [e.id, `${e.titulo} · ${fechaCorta(e.fecha)}`])) : []
  ]);
  // Cada campo extra solo se enseña en su apartado
  const campos = [
    { k: 'fecha', label: 'Fecha', tipo: 'fecha', req: true },
    ...(clases.length ? [{ k: 'clase_id', label: 'Clase', tipo: 'select', opciones: clases, solo: ['mensualidad'] }] : []),
    ...(alumnas.length ? [{ k: 'alumna_id', label: 'Alumna', tipo: 'select', opciones: alumnas, solo: ['mensualidad'] }] : []),
    ...(eventos.length ? [{ k: 'evento_id', label: 'Evento', tipo: 'select', opciones: eventos, solo: ['evento'] }] : []),
    ...(escuelas.length ? [{ k: 'escuela_amiga_id', label: 'Escuela amiga', tipo: 'select', opciones: escuelas, solo: ['escuela_amiga'] }] : []),
    { k: 'concepto', label: 'Concepto', ph: 'Lo que quieras apuntar' },
    { k: 'importe', label: 'Importe (€)', tipo: 'dinero', req: true },
    { k: 'metodo', label: 'Forma de pago', tipo: 'select', opciones: METODOS }
  ];
  const PH = { mensualidad: 'Mensualidad de octubre', evento: 'Entradas, inscripción…', ventas: 'Camiseta talla M, sudadera…', escuela_amiga: 'Cuota de octubre', limpieza: 'Lejía, bayetas…', papeleria: 'Folios, tinta…', material: 'Altavoz, vestuario…', local: 'Alquiler, luz, agua…', decoracion: 'Globos, guirnaldas…', cambio: 'Cambio para la caja', otro: '' };
  const desdeEvento = params.get('evento');
  // Al volver o guardar se regresa a la pantalla desde la que se abrió (la Caja del mes, el día, el evento…)
  const origen = params.get('volver'), volver = origen && origen.startsWith('#/') ? origen : desdeEvento ? `#/evento/${desdeEvento}` : `#/caja/dia/${ini.fecha}`;
  pintar(cabecera(id ? 'Editar movimiento' : 'Nuevo movimiento', { volver }) + `<main class="cont"><form class="form tarjeta" id="frm">
    <div class="tipo"><button type="button" data-t="ingreso" class="in">Ingreso</button><button type="button" data-t="gasto" class="out">Gasto</button></div>
    <div class="campo"><label>¿De qué es?</label><div class="filtros tipos-ini" id="apartados"></div></div>
    ${campos.map((c) => c.solo ? `<div data-solo="${c.solo.join(' ')}">${campoHtml(c, ini[c.k])}</div>` : campoHtml(c, ini[c.k])).join('')}
    <button class="btn pri ancho" type="submit">Guardar</button>
    ${id && S.admin ? '<button class="btn peligro ancho" type="button" id="borrar">Borrar definitivamente</button>' : ''}
  </form>${autorDe(reg)}</main>`, false);
  const pintarApartados = () => {
    // Las camisetas y entradas se venden desde el evento; "Ventas" solo sale al editar un movimiento antiguo
    const opciones = APARTADOS[tipo].filter(([k]) => k !== 'ventas' || (reg && apartadoDe(reg) === 'ventas'));
    if (!opciones.some(([k]) => k === apartado)) apartado = opciones[0][0];
    document.getElementById('apartados').innerHTML = opciones.map(([k, t]) => `<button type="button" data-ap="${k}" class="${k === apartado ? 'on' : ''}">${t}</button>`).join('');
    $app.querySelectorAll('[data-solo]').forEach((d) => { d.hidden = !d.dataset.solo.split(' ').includes(apartado); });
    document.getElementById('f_concepto').placeholder = PH[apartado] || '';
  };
  const marcar = () => { $app.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tipo)); pintarApartados(); };
  $app.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tipo = b.dataset.t; marcar(); }); marcar();
  document.getElementById('apartados').onclick = (ev) => { const b = ev.target.closest('[data-ap]'); if (b) { apartado = b.dataset.ap; pintarApartados(); } };
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const datos = Object.assign(leerForm(form, campos), { tipo, apartado });
    campos.filter((c) => c.solo && !c.solo.includes(apartado)).forEach((c) => { datos[c.k] = null; });
    if (!(datos.importe > 0)) { aviso('El importe tiene que ser mayor que 0', true); return; }
    if (apartado === 'evento' && !datos.evento_id) { aviso('Elige el evento', true); return; }
    if (!datos.concepto) datos.concepto = apartado === 'evento' ? 'Evento · ' + ((eventos.find(([v]) => v === datos.evento_id) || [0, ''])[1].split(' · ')[0]) : nombreApartado(tipo, apartado);
    try {
      const guardar = (d) => id ? q(sb.from('caja').update(d).eq('id', id)) : q(sb.from('caja').insert(d));
      try { await guardar(datos); } catch (e) {
        if (!faltaApartado(e)) throw e;
        if (apartado === 'cambio' || apartado === 'decoracion') throw new Error('Esta parte aún no está activada en la base de datos.');
        const { apartado: _a, evento_id: _e, ...sinApartado } = datos; await guardar(sinApartado);
      }
      aviso('Guardado'); location.hash = origen || desdeEvento ? volver : `#/caja/dia/${datos.fecha}`;
    } catch (e) { aviso(traducirError(e), true); }
  };
  const b = document.getElementById('borrar');
  if (b) b.onclick = async () => {
    // Si es el cobro de una reserva de evento, se deshace el pago (la reserva vuelve a "Cobrar")
    const res = await intentar(() => q(sb.from('evento_reservas').select('id').eq('caja_id', id).limit(1)));
    if (!confirm(res.length ? '¿Borrar este cobro? Se quita de la caja y la reserva del evento vuelve a "Cobrar".' : '¿Borrar este movimiento? No se puede deshacer.')) return;
    try {
      await (res.length ? q(sb.rpc('deshacer_pago', { p_id: res[0].id })) : q(sb.from('caja').delete().eq('id', id)));
      aviso('Borrado'); location.hash = volver;
    } catch (e) { aviso(traducirError(e), true); }
  };
}

/* ---------- incidencias ---------- */
async function pantallaIncidencias(params) {
  if (!puedeVer('incidencias')) return sinPermiso();
  const f = params.get('f') || 'todas';
  let r = sb.from(S.admin ? 'incidencias_con_autor' : 'incidencias').select('*,clases(nombre),alumnas(nombre,apellidos)').order('fecha', { ascending: false }).limit(200);
  if (f === 'semana') { const d = new Date(); d.setDate(d.getDate() - 7); r = r.gte('fecha', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); }
  const l = await q(r);
  pintar(cabecera('Incidencias', { volver: volverDe('incidencias'), sub: 'Lo que pasa en clase' }) + `<main class="cont">
    <div class="filtros">${[['todas', 'Todas'], ['semana', 'Últimos 7 días']].map(([k, t]) => `<button data-ir="#/incidencias?f=${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="lista">${l.map((x) => fila({ href: puedeEditar('incidencias') ? `#/incidencia/${x.id}` : '#/incidencias', iconoHtml: `<span class="ini" style="color:var(--gasto);background:rgba(209,47,59,0.10)">${ico('alerta', 18)}</span>`,
      tit: x.descripcion, det: esc([fechaCorta(x.fecha), x.clases ? x.clases.nombre : '', x.alumnas ? x.alumnas.nombre : '', x.registrado_por ? 'por ' + x.registrado_por : ''].filter(Boolean).join(' · ')) })).join('') || vacio('Sin incidencias. ¡Bien!')}</div>
  </main>`, 'mas', puedeEditar('incidencias') ? '#/incidencia/nueva' : null);
}
async function formIncidencia(id) {
  await pantallaForm({
    titulo: id ? 'Editar incidencia' : 'Nueva incidencia', tabla: 'incidencias', modulo: 'incidencias', id, volver: '#/incidencias',
    campos: [
      { k: 'fecha', label: 'Fecha', tipo: 'fecha', req: true, def: hoyISO() },
      { k: 'descripcion', label: '¿Qué ha pasado?', tipo: 'textarea', req: true },
      { k: 'clase_id', label: 'Clase', tipo: 'select', opciones: puedeVer('clases') ? await intentar(() => opcionesClases(false)) : [] },
      { k: 'alumna_id', label: 'Alumna', tipo: 'select', opciones: puedeVer('alumnas') ? await intentar(opcionesAlumnas) : [] }
    ]
  });
}

/* ---------- iniciativas ---------- */
const TIPOS_INI = [['clase', 'Clase nueva'], ['cambio', 'Un cambio'], ['evento', 'Evento'], ['otra', 'Otra idea']];
const ESTADOS_INI = { nueva: ['Nueva', 'oro'], estudio: ['En estudio', 'mor'], aprobada: ['Aprobada', 'ok'], descartada: ['Descartada', 'gris'] };
const chipIni = (e) => `<span class="chip ${ESTADOS_INI[e][1]}">${ESTADOS_INI[e][0]}</span>`;
const gestionaIni = () => puedeEditar('iniciativas') && (S.admin || !(S.permisos.iniciativas && S.permisos.iniciativas.solo_propias));
async function pantallaIniciativas(params) {
  if (!puedeVer('iniciativas')) return sinPermiso();
  const f = params.get('f') === 'cerradas' ? 'cerradas' : 'abiertas';
  const l = await q(sb.from(S.admin ? 'iniciativas_con_autor' : 'iniciativas').select('*').in('estado', f === 'abiertas' ? ['nueva', 'estudio'] : ['aprobada', 'descartada']).order('creado_en', { ascending: false }).limit(200));
  const tipos = Object.fromEntries(TIPOS_INI);
  pintar(cabecera('Iniciativas', { volver: gestionaIni() ? '#/mas' : '#/inicio', sub: gestionaIni() ? 'Propuestas de las profesoras' : 'Tus propuestas para la escuela' }) + `<main class="cont">
    ${puedeEditar('iniciativas') ? `<a class="tarjeta-caja ini-nueva" href="#/iniciativa/nueva"><span class="ico-caja">${ico('idea', 26)}</span><span class="txt"><b>Proponer una idea</b><span>Una clase, un cambio, un evento…</span></span>${ico('mas', 22)}</a>` : ''}
    <div class="filtros">${[['abiertas', 'Abiertas'], ['cerradas', 'Respondidas']].map(([k, t]) => `<button data-ir="#/iniciativas?f=${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="lista">${l.map((x) => fila({ href: `#/iniciativa/${x.id}`, iconoHtml: `<span class="ini">${ico('idea', 18)}</span>`, tit: x.titulo,
      det: esc([tipos[x.tipo], fechaCorta(x.creado_en), x.registrado_por ? 'de ' + x.registrado_por : ''].filter(Boolean).join(' · ')), der: chipIni(x.estado) })).join('')
      || vacio(f === 'abiertas' ? 'No hay propuestas abiertas.' : 'Aún no hay propuestas respondidas.')}</div>
  </main>`, gestionaIni() ? 'mas' : 'inicio');
}
async function formIniciativa(params) {
  if (!puedeEditar('iniciativas')) return sinPermiso();
  let tipo = TIPOS_INI.some(([k]) => k === params.get('tipo')) ? params.get('tipo') : 'clase';
  pintar(cabecera('Nueva iniciativa', { volver: '#/iniciativas', sub: 'Cuéntanos tu idea' }) + `<main class="cont"><form class="form tarjeta" id="frm">
    <div class="campo"><label>¿De qué se trata?</label><div class="filtros tipos-ini">${TIPOS_INI.map(([k, t]) => `<button type="button" data-tipo="${k}">${t}</button>`).join('')}</div></div>
    ${campoHtml({ k: 'titulo', label: 'Título', req: true, ph: 'Ej.: clase de heels los viernes' })}
    ${campoHtml({ k: 'descripcion', label: 'Explícalo', tipo: 'textarea', ph: 'Qué propones, para quién, cuándo…' })}
    <button class="btn pri ancho" type="submit">Enviar propuesta</button>
  </form></main>`, false);
  const marcar = () => $app.querySelectorAll('[data-tipo]').forEach((b) => b.classList.toggle('on', b.dataset.tipo === tipo));
  $app.querySelectorAll('[data-tipo]').forEach((b) => b.onclick = () => { tipo = b.dataset.tipo; marcar(); }); marcar();
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      await q(sb.from('iniciativas').insert({ tipo, titulo: form.titulo.value.trim(), descripcion: form.descripcion.value.trim() || null }));
      aviso('Propuesta enviada'); location.hash = '#/iniciativas';
    } catch (e) { aviso(traducirError(e), true); btn.disabled = false; }
  };
}
async function pantallaIniciativa(id) {
  if (!puedeVer('iniciativas')) return sinPermiso();
  const x = await q(sb.from(S.admin ? 'iniciativas_con_autor' : 'iniciativas').select('*').eq('id', id).single());
  const tipos = Object.fromEntries(TIPOS_INI), ges = gestionaIni();
  let estado = x.estado;
  pintar(cabecera('Iniciativa', { volver: '#/iniciativas' }) + `<main class="cont">
    <div class="tarjeta"><div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><span class="chip mor">${tipos[x.tipo]}</span>${chipIni(x.estado)}</div>
      <h2 style="margin-top:10px">${esc(x.titulo)}</h2>
      ${x.descripcion ? `<p style="margin:8px 0 0;white-space:pre-wrap;color:var(--texto2)">${esc(x.descripcion)}</p>` : ''}
      <div class="nota" style="margin-top:10px">${x.registrado_por ? `Propuesta de ${esc(x.registrado_por)} · ` : ''}${fechaCorta(x.creado_en)}</div></div>
    ${ges ? `<form class="form tarjeta" id="frm"><h3>Respuesta</h3>
      <div class="filtros tipos-ini">${Object.entries(ESTADOS_INI).map(([k, [t]]) => `<button type="button" data-est="${k}">${t}</button>`).join('')}</div>
      ${campoHtml({ k: 'respuesta', label: 'Mensaje para la profesora', tipo: 'textarea', ph: 'Opcional' }, x.respuesta)}
      <button class="btn pri ancho" type="submit">Guardar</button>
      ${S.admin ? '<button class="btn peligro ancho" type="button" id="borrar">Borrar definitivamente</button>' : ''}</form>`
    : x.respuesta ? `<div class="tarjeta"><h3>Respuesta de la escuela</h3><p style="margin:8px 0 0;white-space:pre-wrap">${esc(x.respuesta)}</p></div>`
    : `<div class="nota">La escuela aún no ha respondido. Aquí verás la respuesta.</div>`}
  </main>`, ges ? 'mas' : 'inicio');
  if (!ges) return;
  const marcar = () => $app.querySelectorAll('[data-est]').forEach((b) => b.classList.toggle('on', b.dataset.est === estado));
  $app.querySelectorAll('[data-est]').forEach((b) => b.onclick = () => { estado = b.dataset.est; marcar(); }); marcar();
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    try { await q(sb.from('iniciativas').update({ estado, respuesta: form.respuesta.value.trim() || null }).eq('id', id)); aviso('Guardado'); location.hash = '#/iniciativas'; }
    catch (e) { aviso(traducirError(e), true); }
  };
  const b = document.getElementById('borrar');
  if (b) b.onclick = async () => {
    if (!confirm('¿Borrar esta iniciativa? No se puede deshacer.')) return;
    try { await q(sb.from('iniciativas').delete().eq('id', id)); aviso('Borrado'); location.hash = '#/iniciativas'; } catch (e) { aviso(traducirError(e), true); }
  };
}

/* ---------- avisos (campana) ---------- */
const ICO_AVISO = { aviso: 'campana', norma: 'normas', evento: 'evento', iniciativa: 'idea', documento: 'doc' };
const pushPosible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!window.BS_CONFIG.vapid;
const b64aBytes = (b) => { const p = '='.repeat((4 - b.length % 4) % 4), r = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
async function activarPush() {
  if (await Notification.requestPermission() !== 'granted') throw new Error('Has dicho que no a los avisos. Puedes cambiarlo en los ajustes del móvil.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(window.BS_CONFIG.vapid) });
  const j = sub.toJSON();
  await sb.from('push_suscripciones').delete().eq('endpoint', j.endpoint);
  await q(sb.from('push_suscripciones').insert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }));
}
async function pantallaAvisos() {
  const l = await q(sb.from('notificaciones').select('*').order('creado_en', { ascending: false }).limit(100));
  let pushActivo = false;
  if (pushPosible() && Notification.permission === 'granted') { try { pushActivo = !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()); } catch (e) {} }
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const tarjetaPush = pushActivo ? '' : pushPosible()
    ? `<button class="tarjeta-caja ini-nueva" id="activar-push" style="width:100%;text-align:left;cursor:pointer"><span class="ico-caja">${ico('campana', 26)}</span><span class="txt"><b>Avisos en el móvil</b><span>Actívalos para enterarte al momento</span></span>${ico('sig', 22)}</button>`
    : `<div class="nota">${/iPhone|iPad/.test(navigator.userAgent) && !instalada ? 'Para recibir avisos en el iPhone, primero añade la app a la pantalla de inicio (Compartir › Añadir a pantalla de inicio) y ábrela desde ahí.' : 'Este móvil no permite avisos de la app.'}</div>`;
  pintar(cabecera('Avisos', { volver: '#/inicio', sub: 'Lo nuevo para ti' }) + `<main class="cont">
    ${tarjetaPush}
    <div class="lista">${l.map((n) => `<a class="aviso-fila ${n.leida_en ? '' : 'nueva'}" href="${esc(n.enlace || '#/avisos')}" data-aviso="${n.id}">
      <span class="ico">${ico(ICO_AVISO[n.tipo] || 'campana', 18)}</span><span class="txt"><b>${esc(n.titulo)}</b>${n.texto ? `<span class="det">${esc(n.texto)}</span>` : ''}<small>${fechaCorta(n.creado_en)}</small></span>${n.leida_en ? '' : '<i class="punto"></i>'}</a>`).join('') || vacio('No tienes avisos.')}</div>
  </main>`, 'inicio', S.admin ? '#/aviso' : null);
  const b = document.getElementById('activar-push');
  if (b) b.onclick = async () => { try { await activarPush(); aviso('Avisos activados en este móvil'); router(); } catch (e) { aviso(e.message || traducirError(e), true); } };
  // Al entrar en un aviso, deja de estar sin leer
  $app.querySelectorAll('[data-aviso]').forEach((a) => a.addEventListener('click', () => {
    if (a.classList.contains('nueva')) sb.from('notificaciones').update({ leida_en: new Date().toISOString() }).eq('id', a.dataset.aviso).then(() => actualizarCampana());
  }));
}
async function formAviso() {
  if (!S.admin) return sinPermiso();
  const ps = (await q(sb.from('perfiles').select('id,nombre').eq('activo', true).order('nombre'))).filter((p) => p.id !== S.usuario.id);
  pintar(cabecera('Enviar aviso', { volver: '#/avisos', sub: 'Les llega a la campana y al móvil' }) + `<main class="cont"><form class="form tarjeta" id="frm">
    ${campoHtml({ k: 'titulo', label: 'Título', req: true, ph: 'Ej.: Ya está subido el calendario de diciembre' })}
    ${campoHtml({ k: 'texto', label: 'Mensaje', tipo: 'textarea', ph: 'Opcional' })}
    <div class="campo"><label>Para</label><label class="check"><input type="checkbox" id="todas" checked><span><b>Todo el equipo</b></span></label>
      ${ps.map((p) => `<label class="check"><input type="checkbox" name="para" value="${p.id}" checked><span>${esc(p.nombre)}</span></label>`).join('')}</div>
    <button class="btn pri ancho" type="submit">Enviar aviso</button></form></main>`, false);
  const form = document.getElementById('frm'), todas = document.getElementById('todas');
  todas.onchange = () => form.querySelectorAll('[name=para]').forEach((c) => { c.checked = todas.checked; });
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const para = [...form.querySelectorAll('[name=para]:checked')].map((c) => c.value);
    if (!para.length) { aviso('Elige al menos una persona', true); return; }
    try {
      await q(sb.from('notificaciones').insert(para.map((id) => ({ perfil_id: id, tipo: 'aviso', titulo: form.titulo.value.trim(), texto: form.texto.value.trim() || null }))));
      aviso('Aviso enviado'); location.hash = '#/avisos';
    } catch (e) { aviso(traducirError(e), true); }
  };
}

/* ---------- documentos ---------- */
const gestionaDocs = () => S.admin || !!(S.permisos.documentos && S.permisos.documentos.puede_escribir && !S.permisos.documentos.solo_propias);
const EST_DOC = { pendiente: ['Pendiente', 'oro'], firmado: ['Firmado', 'ok'], visto: ['Visto', 'mor'] };
const extDe = (f) => (f.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
async function abrirArchivo(ruta) {
  const v = window.open('', '_blank');
  try { const { data, error } = await sb.storage.from('documentos').createSignedUrl(ruta, 300); if (error) throw error; if (v) v.location = data.signedUrl; else location.href = data.signedUrl; }
  catch (e) { if (v) v.close(); aviso(traducirError(e), true); }
}
async function pantallaDocumentos(params) {
  const ges = gestionaDocs(), yo = S.usuario.id;
  const tabs = ges ? [['pendiente', 'Pendientes'], ['firmado', 'Devueltos'], ['todos', 'Todos']] : [['pendiente', 'Pendientes'], ['todos', 'Historial']];
  const f = tabs.some(([k]) => k === params.get('f')) ? params.get('f') : 'pendiente';
  let r = sb.from(S.admin ? 'documentos_con_autor' : 'documentos').select('*').order('creado_en', { ascending: false }).limit(200);
  if (!ges) r = f === 'pendiente' ? r.eq('para_perfil', yo).eq('estado', 'pendiente') : r.or(`para_perfil.eq.${yo},creado_por.eq.${yo}`);
  else if (f !== 'todos') r = f === 'pendiente' ? r.eq('estado', 'pendiente') : r.neq('estado', 'pendiente');
  const [l, dest] = await Promise.all([q(r), intentar(async () => q(sb.rpc('destinatarias')))]);
  const nombre = Object.fromEntries((dest || []).map((d) => [d.id, d.nombre]));
  const quien = (d) => d.para_perfil === yo ? 'De ' + (d.registrado_por || nombre[d.creado_por] || 'administración') : (d.creado_por === yo ? 'Enviado a ' : 'Para ') + (nombre[d.para_perfil] || '¿?');
  const estado = (d) => d.estado === 'pendiente' && !d.pide_firma ? (d.para_perfil === yo ? 'Nuevo' : 'Sin abrir') : EST_DOC[d.estado][0];
  const miFicha = S.admin ? null : await intentar(async () => q(sb.rpc('mi_profesora')));
  const datos = S.admin ? fila({ href: '#/datos', tit: 'Datos del equipo', det: 'DNI, cuenta y tallas', iconoHtml: `<span class="ini">${ico('llave', 18)}</span>`, der: '<span class="chip oro">Solo admin</span>' })
    : miFicha && typeof miFicha === 'string' ? fila({ href: `#/datos/${miFicha}`, tit: 'Mis datos', det: 'DNI, cuenta y talla · privados', iconoHtml: `<span class="ini">${ico('llave', 18)}</span>`, der: ico('sig') }) : '';
  pintar(cabecera('Documentos', { volver: ges ? volverDe('*') : '#/inicio', sub: ges ? 'Enviados y recibidos' : 'Recibidos y enviados' }) + `<main class="cont">
    ${datos ? `<div class="lista">${datos}</div>` : ''}
    <div class="filtros">${tabs.map(([k, t]) => `<button data-ir="#/documentos?f=${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="lista">${l.map((d) => fila({ href: `#/documento/${d.id}`, iconoHtml: `<span class="ini">${ico('doc', 18)}</span>`, tit: d.titulo,
      det: esc([quien(d), fechaCorta(d.creado_en)].join(' · ')),
      der: `<span class="chip ${EST_DOC[d.estado][1]}">${estado(d)}</span>` })).join('') || vacio(f === 'pendiente' ? 'No tienes nada pendiente.' : 'Aún no hay documentos.')}</div>
  </main>`, ges ? 'mas' : 'inicio', '#/documento/nuevo');
}
async function formDocumento() {
  const ges = gestionaDocs();
  const dest = (await q(sb.rpc('destinatarias'))).filter((d) => d.id !== S.usuario.id);
  if (!dest.length) { aviso('Ahora mismo no hay nadie a quien enviarlo', true); location.hash = '#/documentos'; return; }
  pintar(cabecera(ges ? 'Enviar documento' : 'Subir documento', { volver: '#/documentos', sub: 'PDF o foto, máx. 10 MB' }) + `<main class="cont"><form class="form tarjeta" id="frm">
    ${campoHtml({ k: 'titulo', label: 'Título', req: true, ph: ges ? 'Ej.: Acuerdo de colaboración 2026' : 'Ej.: Justificante médico' })}
    ${campoHtml({ k: 'para', label: ges ? 'Para' : 'Para (administración)', tipo: 'select', req: true, opciones: dest.map((d) => [d.id, d.nombre]) }, ges ? '' : dest[0].id)}
    ${campoHtml({ k: 'nota', label: 'Nota', tipo: 'textarea', ph: ges ? 'Opcional: qué tiene que hacer con él' : 'Opcional: de qué se trata' })}
    <div class="campo"><label for="f_archivo">Archivo *</label><label class="subir-archivo">${ico('subir', 20)}<span id="nom-archivo">Elegir PDF o foto</span><input id="f_archivo" type="file" accept="application/pdf,image/*" required hidden></label></div>
    ${ges ? '<label class="check"><input type="checkbox" name="pide_firma" checked><span>Tiene que devolverlo firmado</span></label>' : ''}
    <button class="btn pri ancho" type="submit">Enviar</button></form></main>`, false);
  const form = document.getElementById('frm'), inp = document.getElementById('f_archivo');
  inp.onchange = () => { document.getElementById('nom-archivo').textContent = inp.files[0] ? inp.files[0].name : 'Elegir PDF o foto'; };
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const file = inp.files[0]; if (!file) { aviso('Elige el archivo', true); return; }
    if (file.size > 10485760) { aviso('El archivo pasa de 10 MB', true); return; }
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Subiendo…';
    try {
      const id = crypto.randomUUID(), ruta = `${id}/original.${extDe(file)}`;
      const { error } = await sb.storage.from('documentos').upload(ruta, file, { contentType: file.type });
      if (error) throw error;
      await q(sb.from('documentos').insert({ id, titulo: form.titulo.value.trim(), para_perfil: form.para.value, nota: form.nota.value.trim() || null, archivo: ruta, pide_firma: ges ? form.pide_firma.checked : false }));
      aviso('Documento enviado'); location.hash = '#/documentos?f=todos';
    } catch (e) { aviso(traducirError(e), true); btn.disabled = false; btn.textContent = 'Enviar'; }
  };
}
async function pantallaDocumento(id) {
  const d = await q(sb.from(S.admin ? 'documentos_con_autor' : 'documentos').select('*').eq('id', id).single());
  const ges = gestionaDocs(), mio = d.para_perfil === S.usuario.id;
  const dest = await intentar(async () => q(sb.rpc('destinatarias'))) || [];
  const para = d.para_perfil === S.usuario.id ? 'ti' : (dest.find((x) => x.id === d.para_perfil) || {}).nombre;
  if (!d.registrado_por) d.registrado_por = d.creado_por === S.usuario.id ? 'ti' : (dest.find((x) => x.id === d.creado_por) || {}).nombre;
  pintar(cabecera('Documento', { volver: '#/documentos' }) + `<main class="cont">
    <div class="tarjeta"><div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><span class="chip mor">${d.pide_firma ? 'Para firmar' : 'Para leer'}</span><span class="chip ${EST_DOC[d.estado][1]}">${EST_DOC[d.estado][0]}</span></div>
      <h2 style="margin-top:10px">${esc(d.titulo)}</h2>
      ${d.nota ? `<p style="margin:8px 0 0;white-space:pre-wrap;color:var(--texto2)">${esc(d.nota)}</p>` : ''}
      <div class="nota" style="margin-top:10px">${[d.registrado_por ? 'Enviado por ' + esc(d.registrado_por) : '', para ? 'para ' + esc(para) : '', fechaCorta(d.creado_en)].filter(Boolean).join(' · ')}</div></div>
    <button class="btn sec ancho" id="ver-original">${ico('bajar')} Descargar documento</button>
    ${d.archivo_firmado ? `<div class="tarjeta doc-firmado"><b>${ico('doc', 18)} Devuelto firmado</b><div class="nota">${fechaCorta(d.devuelto_en)}</div><button class="btn sec ancho" id="ver-firmado">${ico('bajar')} Ver el firmado</button></div>` : ''}
    ${mio && d.pide_firma ? `<div class="tarjeta"><h3>${d.archivo_firmado ? '¿Te has equivocado?' : 'Devolverlo firmado'}</h3>
      <p class="nota" style="margin:6px 0 12px">1. Descárgalo. 2. Fírmalo en el móvil (en el iPhone: Archivos › Marcación; en Android: con tu app de PDF) o imprímelo, fírmalo y hazle una foto. 3. Súbelo aquí.</p>
      <label class="subir-archivo">${ico('subir', 20)}<span>${d.archivo_firmado ? 'Subir otra vez' : 'Subir firmado'}</span><input id="subir-firmado" type="file" accept="application/pdf,image/*" hidden></label></div>` : ''}
    ${mio && !d.pide_firma && d.estado === 'pendiente' ? '<button class="btn pri ancho" id="visto">Ya lo he leído</button>' : ''}
    ${S.admin ? '<button class="btn peligro ancho" id="borrar">Borrar definitivamente</button>' : ''}
  </main>`, ges ? 'mas' : 'inicio');
  document.getElementById('ver-original').onclick = () => abrirArchivo(d.archivo);
  const vf = document.getElementById('ver-firmado'); if (vf) vf.onclick = () => abrirArchivo(d.archivo_firmado);
  const sf = document.getElementById('subir-firmado');
  if (sf) sf.onchange = async () => {
    const file = sf.files[0]; if (!file) return;
    if (file.size > 10485760) { aviso('El archivo pasa de 10 MB', true); return; }
    aviso('Subiendo…');
    try {
      const ruta = `${d.id}/firmado.${extDe(file)}`;
      const { error } = await sb.storage.from('documentos').upload(ruta, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      await q(sb.from('documentos').update({ archivo_firmado: ruta, estado: 'firmado' }).eq('id', d.id));
      aviso('¡Enviado firmado!'); router();
    } catch (e) { aviso(traducirError(e), true); }
  };
  const vi = document.getElementById('visto');
  if (vi) vi.onclick = async () => { try { await q(sb.from('documentos').update({ estado: 'visto' }).eq('id', d.id)); aviso('Hecho'); router(); } catch (e) { aviso(traducirError(e), true); } };
  const b = document.getElementById('borrar');
  if (b) b.onclick = async () => {
    if (!confirm('¿Borrar este documento y sus archivos? No se puede deshacer.')) return;
    try { await sb.storage.from('documentos').remove([d.archivo, d.archivo_firmado].filter(Boolean)); await q(sb.from('documentos').delete().eq('id', d.id)); aviso('Borrado'); location.hash = '#/documentos'; }
    catch (e) { aviso(traducirError(e), true); }
  };
}

/* ---------- datos personales (solo admin y la propia profesora) ---------- */
const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const CAMPOS_DATOS = [
  { k: 'dni', label: 'DNI / NIE', ph: '12345678A' },
  { k: 'fecha_nacimiento', label: 'Fecha de nacimiento', tipo: 'fecha' },
  { k: 'direccion', label: 'Dirección', ph: 'Calle, número, CP y ciudad' },
  { k: 'seguridad_social', label: 'Nº de la Seguridad Social' },
  { k: 'iban', label: 'Cuenta bancaria (IBAN)', ph: 'ES00 0000 0000 0000 0000 0000' },
  { k: 'talla_camiseta', label: 'Talla de camiseta', tipo: 'select', opciones: TALLAS.map((t) => [t, t]), vacio: 'Sin indicar' },
  { k: 'talla_pantalon', label: 'Talla de pantalón', ph: 'Ej.: 38 o M' },
  { k: 'emergencia_nombre', label: 'Contacto de emergencia', ph: 'Nombre y parentesco' },
  { k: 'emergencia_telefono', label: 'Teléfono de emergencia', tipo: 'tel' },
  { k: 'notas', label: 'Otros datos', tipo: 'textarea', ph: 'Lo que quieras tener a mano' }
];
const ibanBonito = (v) => String(v || '').replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
const CAMPOS_CUENTAN = CAMPOS_DATOS.filter((c) => c.k !== 'notas');
const datosRellenos = (d) => d ? CAMPOS_CUENTAN.filter((c) => d[c.k]).length : 0;
async function pantallaDatosEquipo() {
  if (!S.admin) return sinPermiso();
  const [profes, datos, equipo, datosEq] = await Promise.all([
    q(sb.from('profesoras').select('id,nombre,activa').order('activa', { ascending: false }).order('nombre')),
    q(sb.from('profesoras_datos').select('*')),
    intentar(() => q(sb.rpc('equipo_sin_ficha'))),
    intentar(() => q(sb.from('perfiles_datos').select('*')))
  ]);
  const por = Object.fromEntries(datos.map((d) => [d.profesora_id, d]));
  const porEq = Object.fromEntries(datosEq.map((d) => [d.perfil_id, d]));
  const chipDatos = (n) => n === CAMPOS_CUENTAN.length ? '<span class="chip ok">Completo</span>' : n ? '<span class="chip oro">A medias</span>' : '<span class="chip gris">Vacío</span>';
  const resto = equipo.filter((e) => e.id !== S.usuario.id).map((e) => { const d = porEq[e.id], n = datosRellenos(d);
    return fila({ href: `#/datos/e/${e.id}`, tit: e.nombre, det: n ? `${n} de ${CAMPOS_CUENTAN.length} datos${d.talla_camiseta ? ' · Talla ' + d.talla_camiseta : ''}` : 'Sin datos todavía', der: chipDatos(n) }); }).join('');
  const tallas = {}; profes.filter((p) => p.activa).forEach((p) => { const t = (por[p.id] || {}).talla_camiseta || 'Sin talla'; tallas[t] = (tallas[t] || 0) + 1; });
  const orden = [...TALLAS, 'Sin talla'].filter((t) => tallas[t]);
  pintar(cabecera('Datos del equipo', { volver: '#/documentos', sub: 'Solo los ves tú y cada persona los suyos' }) + `<main class="cont">
    <div class="tarjeta"><h3>${ico('profe', 18)} Camisetas</h3><p class="nota" style="margin:4px 0 10px">Para hacer el pedido (profesoras en activo)</p>
      <div class="tallas">${orden.map((t) => `<span class="chip ${t === 'Sin talla' ? 'gris' : 'mor'}">${t} × ${tallas[t]}</span>`).join('') || '<span class="nota">Aún no hay profesoras.</span>'}</div></div>
    <div class="lista">${profes.map((p) => { const n = datosRellenos(por[p.id]); return fila({ href: `#/datos/${p.id}`, tit: p.nombre, det: n ? `${n} de ${CAMPOS_CUENTAN.length} datos${por[p.id].talla_camiseta ? ' · Talla ' + por[p.id].talla_camiseta : ''}` : 'Sin datos todavía',
      der: !p.activa ? '<span class="chip gris">Inactiva</span>' : n === CAMPOS_CUENTAN.length ? '<span class="chip ok">Completo</span>' : n ? '<span class="chip oro">A medias</span>' : '<span class="chip gris">Vacío</span>' }); }).join('') || vacio('Aún no hay profesoras.')}</div>
    ${resto ? `<div class="seccion">Resto del equipo</div><div class="lista">${resto}</div>` : ''}
  </main>`, 'mas');
}
// De quién son los datos: una profesora (por su ficha) o una persona del equipo sin ficha (por su usuario)
async function fuenteDatos(id, perfilId) {
  if (perfilId) return { tabla: 'perfiles_datos', col: 'perfil_id', val: perfilId, ruta: `#/datos/e/${perfilId}`, mio: perfilId === S.usuario.id,
    nombre: async () => perfilId === S.usuario.id ? S.perfil.nombre : S.nombres[perfilId] || '' };
  const mia = S.admin ? null : await intentar(async () => q(sb.rpc('mi_profesora')));
  return { tabla: 'profesoras_datos', col: 'profesora_id', val: id, ruta: `#/datos/${id}`, mio: mia === id,
    nombre: async () => S.admin ? ((await q(sb.from('profesoras').select('nombre').eq('id', id).maybeSingle())) || {}).nombre || '' : S.perfil.nombre };
}
// "Mi ficha" (desde Más): la de profesora si la tiene; si no, la del equipo
async function pantallaMisDatos() {
  const mia = S.admin ? null : await intentar(async () => q(sb.rpc('mi_profesora')));
  location.replace(mia && typeof mia === 'string' ? `#/datos/${mia}` : `#/datos/e/${S.usuario.id}`);
}
async function pantallaDatos(id, perfilId) {
  const f = await fuenteDatos(id, perfilId);
  if (!S.admin && !f.mio) return sinPermiso();
  const [d, nombre] = await Promise.all([q(sb.from(f.tabla).select('*').eq(f.col, f.val).maybeSingle()), f.nombre()]);
  const ajeno = S.admin && !f.mio;
  const filas = CAMPOS_DATOS.filter((c) => d && d[c.k]).map((c) => {
    const v = c.k === 'iban' ? ibanBonito(d[c.k]) : c.tipo === 'fecha' ? fechaCorta(d[c.k]) + (edad(d[c.k]) != null ? ` (${edad(d[c.k])} años)` : '') : d[c.k];
    const copia = ['dni', 'iban', 'seguridad_social', 'emergencia_telefono'].includes(c.k);
    return `<div class="dato-p"><span class="txt"><small>${esc(c.label)}</small><b>${esc(v)}</b></span>${copia ? `<button class="copiar-dato" data-copiar="${esc(c.k === 'iban' ? String(d[c.k]).replace(/\s+/g, '').toUpperCase() : d[c.k])}" aria-label="Copiar ${esc(c.label)}">${ico('copiar', 18)}</button>` : ''}</div>`;
  }).join('');
  pintar(cabecera(ajeno ? nombre : 'Mi ficha', { volver: ajeno ? '#/datos' : '#/mas', sub: ajeno ? 'Datos personales · privados' : esc(nombre) + ' · datos privados' }) + `<main class="cont">
    <div class="tarjeta">${filas ? `<div class="datos-p">${filas}</div>` : vacio(ajeno ? 'Aún no hay datos de ' + esc(nombre.split(' ')[0]) + '. Rellénalos tú o pídele que lo haga desde su app (Más › su nombre).' : 'Aún no has rellenado tus datos: DNI, cuenta bancaria, tallas y a quién avisar si pasa algo.')}</div>
    <div class="nota" style="display:flex;gap:8px;align-items:center">${ico('ojo', 16)} ${ajeno ? 'Solo los ves tú y ' + esc(nombre.split(' ')[0]) : S.admin ? 'Solo los ves tú' : 'Solo los ves tú y la administración'}.</div>
    <button class="btn pri ancho" data-ir="${f.ruta}/editar">${ico('lapiz')} ${filas ? 'Editar datos' : 'Rellenar datos'}</button>
    ${d ? autorDe(d) : ''}
  </main>`, 'mas');
  document.querySelectorAll('[data-copiar]').forEach((b) => { b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copiar); aviso('Copiado'); } catch (e) { aviso('No se pudo copiar', true); } }; });
}
async function formDatos(id, perfilId) {
  const f = await fuenteDatos(id, perfilId);
  if (!S.admin && !f.mio) return sinPermiso();
  const d = await q(sb.from(f.tabla).select('*').eq(f.col, f.val).maybeSingle());
  pintar(cabecera(d ? 'Editar datos' : 'Rellenar datos', { volver: f.ruta, sub: S.admin && !f.mio ? 'Privados: solo tú y esa persona' : 'Solo los ves tú y la administración' }) + `<main class="cont"><form class="form tarjeta" id="frm">
    ${CAMPOS_DATOS.map((c) => campoHtml(c, d && d[c.k])).join('')}
    <button class="btn pri ancho" type="submit">Guardar</button></form></main>`, false);
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const datos = leerForm(form, CAMPOS_DATOS);
      if (datos.iban) datos.iban = ibanBonito(datos.iban);
      if (datos.dni) datos.dni = datos.dni.replace(/[\s-]+/g, '').toUpperCase();
      await q(sb.from(f.tabla).upsert({ [f.col]: f.val, ...datos }));
      aviso('Guardado'); location.hash = f.ruta;
    } catch (e) { aviso(traducirError(e), true); btn.disabled = false; }
  };
}

/* ---------- normas ---------- */
async function pantallaNormas(params) {
  if (!puedeVer('normas')) return sinPermiso();
  const l = await q(sb.from('normas').select('*').order('activa', { ascending: false }).order('orden').order('creado_en'));
  const ed = puedeEditar('normas'), ordenar = ed && params.get('ordenar') === '1';
  if (ordenar) {
    const act = l.filter((n) => n.activa);
    pintar(cabecera('Ordenar normas', { volver: '#/normas', sub: 'Sube o baja cada norma' }) + `<main class="cont">
      <div class="lista" id="orden">${act.map((n, i) => `<div class="fila orden-fila"><span class="ini">${i + 1}</span><span class="txt"><b>${esc(n.titulo)}</b></span>
        <span class="flechas"><button data-sube="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${ico('arriba', 22)}</button><button data-baja="${i}" ${i === act.length - 1 ? 'disabled' : ''} aria-label="Bajar">${ico('abajo', 22)}</button></span></div>`).join('')}</div>
      <button class="btn pri ancho" data-ir="#/normas">Listo</button></main>`, 'mas');
    const mover = async (i, j) => {
      const a = act[i], b = act[j];
      // Se intercambian sus posiciones; si coinciden, se separan
      const oa = a.orden, ob = b.orden === a.orden ? a.orden + (j > i ? 1 : -1) : b.orden;
      try {
        await q(sb.from('normas').update({ orden: ob }).eq('id', a.id));
        await q(sb.from('normas').update({ orden: oa }).eq('id', b.id));
        router();
      } catch (e) { aviso(traducirError(e), true); }
    };
    $app.querySelectorAll('[data-sube]').forEach((x) => x.onclick = () => { x.disabled = true; mover(+x.dataset.sube, +x.dataset.sube - 1); });
    $app.querySelectorAll('[data-baja]').forEach((x) => x.onclick = () => { x.disabled = true; mover(+x.dataset.baja, +x.dataset.baja + 1); });
    return;
  }
  pintar(cabecera('Normas', { volver: '#/inicio', sub: 'Reglas de la escuela' }) + `<main class="cont">
    ${ed && l.filter((n) => n.activa).length > 1 ? `<button class="btn sec ancho" data-ir="#/normas?ordenar=1">${ico('arriba', 18)}${ico('abajo', 18)} Cambiar el orden</button>` : ''}
    ${l.map((n) => `<div class="tarjeta" ${n.activa ? '' : 'style="opacity:.55"'}>
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><h2>${esc(n.titulo)}</h2>${ed ? `<a href="#/norma/${n.id}" aria-label="Editar" style="color:var(--morado3)">${ico('lapiz')}</a>` : ''}</div>
    <p style="margin:8px 0 0;white-space:pre-wrap;color:var(--texto2)">${esc(n.contenido)}</p></div>`).join('') || vacio('Aún no hay normas.')}</main>`, 'mas', ed ? '#/norma/nueva' : null);
}
const formNorma = (id) => pantallaForm({
  titulo: id ? 'Editar norma' : 'Nueva norma', tabla: 'normas', modulo: 'normas', id, volver: '#/normas',
  campos: [{ k: 'titulo', label: 'Título', req: true }, { k: 'contenido', label: 'Texto', tipo: 'textarea', req: true }, { k: 'activa', label: 'Norma en vigor', tipo: 'bool', def: true }]
});

/* ---------- profesoras ---------- */
async function pantallaProfesoras() {
  if (!puedeVer('profesoras')) return sinPermiso();
  const l = await q(sb.from('profesoras').select('*,clases(count)').order('activa', { ascending: false }).order('nombre'));
  pintar(cabecera('Profesoras', { volver: volverDe('profesoras'), sub: 'Equipo y clases asignadas' }) + `<main class="cont"><div class="lista">${l.map((p) => fila({
    href: puedeEditar('profesoras') ? `#/profesora/${p.id}` : '#/profesoras', tit: p.nombre, det: esc([p.telefono, p.email].filter(Boolean).join(' · ')),
    der: p.activa ? `<span class="chip mor">${p.clases && p.clases[0] ? p.clases[0].count : 0} clases</span>` : '<span class="chip gris">Inactiva</span>' })).join('') || vacio('Aún no hay profesoras.')}</div></main>`, 'mas', puedeEditar('profesoras') ? '#/profesora/nueva' : null);
}
async function formProfesora(id) {
  const perfiles = S.admin ? await intentar(async () => (await q(sb.from('perfiles').select('id,nombre').order('nombre'))).map((p) => [p.id, p.nombre])) : [];
  await pantallaForm({
    titulo: id ? 'Editar profesora' : 'Nueva profesora', tabla: 'profesoras', modulo: 'profesoras', id, volver: '#/profesoras',
    campos: [
      { k: 'nombre', label: 'Nombre', req: true }, { k: 'telefono', label: 'Teléfono', tipo: 'tel' }, { k: 'email', label: 'Correo', tipo: 'email' },
      { k: 'notas', label: 'Notas', tipo: 'textarea' }, { k: 'activa', label: 'En activo', tipo: 'bool', def: true },
      ...(S.admin ? [{ k: 'perfil_id', label: 'Su usuario en la app (si tiene)', tipo: 'select', opciones: perfiles, vacio: 'Sin acceso', ayuda: 'Enlázalo para que, con "solo lo suyo", vea únicamente sus clases.' }] : [])
    ]
  });
  // Acceso a sus datos personales (DNI, cuenta, tallas…), solo para la administración
  const frm = document.getElementById('frm');
  if (S.admin && id && frm) frm.insertAdjacentHTML('beforebegin', `<div class="lista">${fila({ href: `#/datos/${id}`, tit: 'Datos personales', det: 'DNI, cuenta, tallas, emergencia', iconoHtml: `<span class="ini">${ico('llave', 18)}</span>`, der: '<span class="chip oro">Solo admin</span>' })}</div>`);
}

/* ---------- eventos ---------- */
async function pantallaEventos(params) {
  if (!puedeVer('eventos')) return sinPermiso();
  const f = params.get('f') || 'proximos', hoy = hoyISO();
  let r = sb.from('eventos').select('id,titulo,fecha,hora,lugar,inscripciones_evento(count)');
  r = f === 'proximos' ? r.gte('fecha', hoy).order('fecha') : r.lt('fecha', hoy).order('fecha', { ascending: false });
  const l = await q(r);
  pintar(cabecera('Eventos', { volver: volverDe('eventos'), sub: 'Talleres, shows y fiestas' }) + `<main class="cont">
    <div class="filtros">${[['proximos', 'Próximos'], ['pasados', 'Pasados']].map(([k, t]) => `<button data-ir="#/eventos?f=${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="lista">${l.map((e) => fila({ href: `#/evento/${e.id}`, ini: aFecha(e.fecha).getDate(), tit: e.titulo, det: esc([fechaCorta(e.fecha), hora(e.hora), e.lugar].filter(Boolean).join(' · ')),
      der: `<span class="chip mor">${e.inscripciones_evento && e.inscripciones_evento[0] ? e.inscripciones_evento[0].count : 0}</span>` })).join('') || vacio(f === 'proximos' ? 'No hay eventos próximos.' : 'No hay eventos pasados.')}</div>
  </main>`, 'mas', puedeEditar('eventos') ? '#/evento/nuevo' : null);
}
async function pantallaEvento(id) {
  if (!puedeVer('eventos')) return sinPermiso();
  const [e, ins, profs] = await Promise.all([
    q(sb.from(S.admin ? 'eventos_con_autor' : 'eventos').select('*').eq('id', id).single()),
    q(sb.from('inscripciones_evento').select('id,estado,alumnas(id,nombre,apellidos)').eq('evento_id', id)),
    q(sb.from('evento_profesoras').select('profesora_id,profesoras(nombre)').eq('evento_id', id))
  ]);
  const ed = puedeEditar('eventos');
  const coords = await leerCoordinadoras(e), conTabla = await hayCoordinadoras();
  const htmlCoord = `<div class="seccion">Coordinación${coords.length > 1 ? ` (${coords.length})` : ''}</div>
    <div class="lista">${coords.map((c) => fila({ href: `#/evento/${id}`, tit: nomCoord(c), det: c.principal ? 'Coordinadora principal' : 'También coordina',
      der: `<span class="chips">${c.principal ? '<span class="chip oro">Principal</span>' : ''}${ed && conTabla && !c.principal ? `<button class="chip mor" data-principal="${c.id}" style="border:0;cursor:pointer;min-height:32px">Hacer principal</button>` : ''}${ed && conTabla ? `<button class="chip no" data-quitar-coord="${c.id}" style="border:0;cursor:pointer;min-height:32px">Quitar</button>` : ''}</span>` })).join('') || vacio('Nadie coordina este evento todavía.')}</div>
    ${ed && conTabla ? `<div class="campo"><select id="addCoord">${opcionesCoordHtml(await opcionesCoordinadoras(), '', coords, coords.length ? '+ Añadir otra coordinadora…' : '+ Elegir coordinadora principal…')}</select></div>` : ''}`;
  const ventas = {}, htmlVentas = await bloqueVentas(id, ventas);
  // Caja del evento: lo que se ha cobrado y gastado en él (quien ve la Caja), por clase
  let cajaEv = '';
  if (puedeVer('caja')) {
    const movs = await intentar(() => leerCaja((r) => r.eq('evento_id', id).order('fecha').order('creado_en')));
    const [i, o] = sumaCaja(movs);
    cajaEv = `<div class="seccion">Caja del evento</div>
      <div class="totales"><div><small>Ingresos</small><b class="in">${eur(i)}</b></div><div><small>Gastos</small><b class="out">${eur(o)}</b></div><div><small>Balance</small><b>${eur(i - o)}</b></div></div>
      ${movs.length ? (() => {
        const deCaja = new Map((ventas.res || []).filter((r) => r.caja_id).map((r) => [r.caja_id, r]));
        const ing = movs.filter((x) => x.tipo === 'ingreso'), gas = movs.filter((x) => x.tipo === 'gasto' && !esCambio(x));
        const tarjeta = (nombre, l, clase = '') => { const [a, b] = sumaCaja(l); return `<details class="caja-clase ${clase}"><summary class="cc-cab"><span><h3>${esc(nombre)}</h3><small>${l.length} movimiento${l.length === 1 ? '' : 's'}</small></span>
          <span class="cc-tot">${a ? `<b class="in">+${eur(a)}</b>` : ''}${b ? `<b class="out">−${eur(b)}</b>` : ''}</span><span class="cc-flecha">${ico('sig', 20)}</span></summary>
          <div class="cc-movs">${l.map((x) => movCaja(x, { conFecha: true, volver: `#/evento/${id}` })).join('')}</div></details>`; };
        return `<div class="lista">${porClase(ing, (x) => { const r = deCaja.get(x.id); return r ? claseDe(r.alumnas) : ''; }).map(([cl, l]) => tarjeta(cl, l)).join('')}${gas.length ? tarjeta('Gastos del evento', gas, 'apart') : ''}</div>`;
      })() : vacio('Aún no hay cobros ni gastos de este evento.')}
      ${puedeEditar('caja') ? `<a class="btn sec" href="#/caja/nuevo?tipo=gasto&apartado=evento&evento=${id}">${ico('mas')} Apuntar un gasto del evento</a>` : ''}`;
  }
  pintar(cabecera(e.titulo, { volver: '#/eventos', sub: capital(fechaLarga(e.fecha)) + (e.hora ? ' · ' + hora(e.hora) : '') }) + `<main class="cont">
    <div class="tarjeta"><dl class="datos">
      <dt>Lugar</dt><dd>${esc(e.lugar || '—')}</dd><dt>Coordina</dt><dd>${esc(coords.length ? coords.map(nomCoord).join(', ') : '—')}</dd>
      ${e.precio_alumna != null ? `<dt>Precio</dt><dd>${eur(e.precio_alumna)}</dd>` : ''}${e.inscripcion_hasta ? `<dt>Inscripción hasta</dt><dd>${fechaCorta(e.inscripcion_hasta)}</dd>` : ''}
      ${e.descripcion ? `<dt>Descripción</dt><dd>${esc(e.descripcion)}</dd>` : ''}${e.normas ? `<dt>Normas</dt><dd>${esc(e.normas)}</dd>` : ''}${e.condiciones ? `<dt>Condiciones</dt><dd>${esc(e.condiciones)}</dd>` : ''}
    </dl></div>
    ${ed ? `<a class="btn sec" href="#/evento/${id}/editar">${ico('lapiz')} Editar evento</a>` : ''}
    ${htmlCoord}
    ${htmlVentas}
    ${cajaEv}
    <div class="seccion">Profesoras (${profs.length})</div>
    <div class="lista">${profs.map((p) => fila({ href: `#/evento/${id}`, tit: p.profesoras ? p.profesoras.nombre : '—', der: ed ? `<button class="chip no" data-quitar-prof="${p.profesora_id}" style="border:0;cursor:pointer;min-height:32px">Quitar</button>` : '' })).join('') || vacio('Sin profesoras asignadas.')}</div>
    ${ed && puedeVer('profesoras') ? `<div class="campo"><select id="addProf"><option value="">+ Añadir profesora…</option>${(await intentar(opcionesProfesoras)).filter(([pid]) => !profs.some((p) => p.profesora_id === pid)).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></div>` : ''}
    <div class="seccion">Alumnas inscritas (${ins.filter((i) => i.estado === 'inscrita').length})</div>
    <div class="lista">${ins.map((i) => fila({ href: `#/alumna/${i.alumnas.id}`, tit: `${i.alumnas.nombre} ${i.alumnas.apellidos || ''}`, der: i.estado === 'inscrita' ? (ed ? `<button class="chip ok" data-cancelar="${i.id}" style="border:0;cursor:pointer;min-height:32px">Inscrita</button>` : '<span class="chip ok">Inscrita</span>') : '<span class="chip gris">Cancelada</span>' })).join('') || vacio('Nadie inscrita todavía.')}</div>
    ${ed && puedeVer('alumnas') ? `<div class="campo"><select id="addAlu"><option value="">+ Inscribir alumna…</option>${(await intentar(opcionesAlumnas)).filter(([aid]) => !ins.some((i) => i.alumnas.id === aid)).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></div>` : ''}
    ${autorDe(e)}
  </main>`, 'mas');
  activarCobros();
  const sp = document.getElementById('addProf');
  if (sp) sp.onchange = async () => { if (!sp.value) return; try { await q(sb.from('evento_profesoras').insert({ evento_id: id, profesora_id: sp.value })); router(); } catch (er) { aviso(traducirError(er), true); } };
  const sc = document.getElementById('addCoord');
  if (sc) sc.onchange = async () => {
    const quien = elegidaCoord(sc.value); sc.value = '';
    if (!quien) return;
    try { await q(sb.from('evento_coordinadoras').insert({ evento_id: id, ...quien, principal: !coords.some((c) => c.principal) })); router(); } catch (er) { aviso(traducirError(er), true); }
  };
  $app.querySelectorAll('[data-principal]').forEach((b) => b.onclick = async (ev) => { ev.preventDefault(); ev.stopPropagation();
    try { await q(sb.from('evento_coordinadoras').update({ principal: false }).eq('evento_id', id).eq('principal', true));
      await q(sb.from('evento_coordinadoras').update({ principal: true }).eq('id', b.dataset.principal)); router(); } catch (er) { aviso(traducirError(er), true); } });
  $app.querySelectorAll('[data-quitar-coord]').forEach((b) => b.onclick = async (ev) => { ev.preventDefault(); ev.stopPropagation();
    const c = coords.find((x) => x.id === b.dataset.quitarCoord);
    if (!confirm(`¿Quitar a ${c ? nomCoord(c) : 'esta persona'} de la coordinación?`)) return;
    try {
      await q(sb.from('evento_coordinadoras').delete().eq('id', b.dataset.quitarCoord));
      // Si se quita la principal, pasa a serlo la siguiente
      const sig = c && c.principal ? coords.find((x) => x.id !== c.id) : null;
      if (sig) await q(sb.from('evento_coordinadoras').update({ principal: true }).eq('id', sig.id));
      router();
    } catch (er) { aviso(traducirError(er), true); } });
  const sa = document.getElementById('addAlu');
  if (sa) sa.onchange = async () => { if (!sa.value) return; try { await q(sb.from('inscripciones_evento').insert({ evento_id: id, alumna_id: sa.value })); router(); } catch (er) { aviso(traducirError(er), true); } };
  $app.querySelectorAll('[data-quitar-prof]').forEach((b) => b.onclick = async (ev) => { ev.preventDefault(); ev.stopPropagation();
    try { await q(sb.from('evento_profesoras').delete().eq('evento_id', id).eq('profesora_id', b.dataset.quitarProf)); router(); } catch (er) { aviso(traducirError(er), true); } });
  $app.querySelectorAll('[data-cancelar]').forEach((b) => b.onclick = async (ev) => { ev.preventDefault(); ev.stopPropagation();
    if (!confirm('¿Cancelar la inscripción de esta alumna?')) return;
    try { await q(sb.from('inscripciones_evento').update({ estado: 'cancelada' }).eq('id', b.dataset.cancelar)); router(); } catch (er) { aviso(traducirError(er), true); } });
}
/* ---------- coordinación de un evento: una principal y las que se quieran añadir ----------
   Puede coordinar una profesora o cualquier persona del equipo (Adela, María…), aunque aún no tenga usuario. */
const nomCoord = (c) => (c.profesoras && c.profesoras.nombre) || c.nombre || '—';
async function hayCoordinadoras() {   // ¿está pegada la migración 018?
  if (S.coordOk == null) { const { error } = await sb.from('evento_coordinadoras').select('id').limit(1); S.coordOk = !error; }
  return S.coordOk;
}
async function leerCoordinadoras(e) {
  if (await hayCoordinadoras()) return intentar(() => q(sb.from('evento_coordinadoras').select('id,profesora_id,nombre,principal,profesoras(nombre)').eq('evento_id', e.id).order('principal', { ascending: false }).order('creado_en')));
  // Sin la 018: la coordinadora de antes
  if (!e.coordinadora_id || !puedeVer('profesoras')) return [];
  const p = await intentar(() => q(sb.from('profesoras').select('nombre').eq('id', e.coordinadora_id).single()));
  return p && p.nombre ? [{ id: '', profesora_id: e.coordinadora_id, nombre: p.nombre, principal: true }] : [];
}
async function opcionesCoordinadoras() {
  const [profes, equipo, usados] = await Promise.all([
    puedeVer('profesoras') ? intentar(opcionesProfesoras) : [],
    intentar(() => q(sb.rpc('equipo_sin_ficha'))),
    intentar(() => q(sb.from('evento_coordinadoras').select('nombre').is('profesora_id', null)))
  ]);
  const vistos = new Set(), nombres = [];
  [...equipo.map((p) => p.nombre), ...usados.map((u) => u.nombre)].forEach((n) => { const t = String(n || '').trim(); if (t && !vistos.has(t.toLowerCase())) { vistos.add(t.toLowerCase()); nombres.push(t); } });
  return { profes, equipo: nombres.sort((a, b) => a.localeCompare(b, 'es')) };
}
function opcionesCoordHtml({ profes, equipo }, sel, quitar = [], primera = '—') {
  const ya = (v) => quitar.some((c) => v === (c.profesora_id ? 'p:' + c.profesora_id : 'n:' + String(c.nombre || '').trim().toLowerCase()));
  const pr = profes.filter(([pid]) => !ya('p:' + pid)), eq = equipo.filter((n) => !ya('n:' + n.toLowerCase()));
  const op = (v, t) => `<option value="${esc(v)}" data-nombre="${esc(t)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`;
  return `<option value="">${esc(primera)}</option>`
    + (pr.length ? `<optgroup label="Profesoras">${pr.map(([v, t]) => op('p:' + v, t)).join('')}</optgroup>` : '')
    + (eq.length ? `<optgroup label="Resto del equipo">${eq.map((n) => op('n:' + n, n)).join('')}</optgroup>` : '')
    + '<option value="otra">Otra persona (escribir su nombre)…</option>';
}
// Lo elegido en el desplegable → fila para guardar ({ profesora_id, nombre } o { nombre })
function elegidaCoord(v, otra = null) {
  if (!v) return null;
  if (v.startsWith('p:')) { const o = document.querySelector(`option[value="${CSS.escape(v)}"]`); return { profesora_id: v.slice(2), nombre: o ? o.dataset.nombre : null }; }
  if (v.startsWith('n:')) return { nombre: v.slice(2) };
  const n = String(otra != null ? otra : prompt('Nombre de la persona que coordina (por ejemplo, Adela o María):') || '').trim();
  return n ? { nombre: n } : null;
}
// Formulario del evento: guarda la principal (si cambia, la anterior deja de coordinar)
async function guardarPrincipal(evento, quien) {
  const l = await q(sb.from('evento_coordinadoras').select('id,profesora_id,nombre,principal').eq('evento_id', evento));
  const misma = (c) => quien && (quien.profesora_id ? c.profesora_id === quien.profesora_id : !c.profesora_id && String(c.nombre || '').trim().toLowerCase() === quien.nombre.toLowerCase());
  const actual = l.find((c) => c.principal), nueva = l.find(misma);
  if (actual && actual === nueva) return;
  if (actual) await q(sb.from('evento_coordinadoras').delete().eq('id', actual.id));
  if (!quien) return;
  if (nueva) await q(sb.from('evento_coordinadoras').update({ principal: true }).eq('id', nueva.id));
  else await q(sb.from('evento_coordinadoras').insert({ evento_id: evento, ...quien, principal: true }));
}

/* ---------- ventas y reservas de un evento (camisetas, entradas...) ----------
   Artículos con precio; cada reserva: quién, cuántas, talla y si está pagada. Al cobrar entra en la caja. */
const gestionaVentas = () => puedeEditar('eventos') || puedeEditar('caja');
const nomAlumna = (a) => a ? `${a.nombre} ${a.apellidos || ''}`.trim() : '';
const claseDe = (a) => { const i = ((a && a.inscripciones) || []).find((x) => !x.fecha_baja && x.clases); return i ? i.clases.nombre : ''; };
// Tallas de venta: de niña a adulta. Cada artículo puede tener su propia lista (editable)
const TALLAS_VENTA = ['3-4 años', '5-6 años', '7-8 años', '9-10 años', '11-12 años', '13-14 años', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
const tallasDe = (a) => (a && a.tallas && a.tallas.length) ? a.tallas : TALLAS_VENTA;
// Una reserva puede llevar varias tallas: se guarda "3-4 años ×1 · S ×1" (o solo "M" si es una)
const tallasReserva = (r) => {
  if (!r.talla) return {};
  if (!/ ×\d+$/.test(r.talla)) return { [r.talla]: r.cantidad };
  const m = {}; r.talla.split(' · ').forEach((x) => { const k = x.match(/^(.*) ×(\d+)$/); if (k) m[k[1]] = (m[k[1]] || 0) + +k[2]; }); return m;
};
const textoTallas = (m) => { const l = Object.entries(m).filter(([, n]) => n > 0); return l.length === 1 ? l[0][0] : l.map(([t, n]) => `${t} ×${n}`).join(' · '); };
// Las ventas de un evento se agrupan por la clase de la alumna; quien no es alumna va en "Familias y público"
const SIN_CLASE = 'Familias y público';
const porClase = (l, claseDe_) => {
  const g = new Map(); l.forEach((x) => { const k = claseDe_(x) || SIN_CLASE; if (!g.has(k)) g.set(k, []); g.get(k).push(x); });
  return [...g.entries()].sort((a, b) => (a[0] === SIN_CLASE) - (b[0] === SIN_CLASE) || a[0].localeCompare(b[0], 'es'));
};
const SEL_RESERVA = '*,evento_articulos(nombre,precio,con_talla,tallas),alumnas(nombre,apellidos,inscripciones(fecha_baja,clases(nombre)))';
async function bloqueVentas(id, guardar = {}) {
  const ges = gestionaVentas(), cobra = puedeEditar('caja');
  const [arts, res] = await Promise.all([
    intentar(() => q(sb.from('evento_articulos').select('*').eq('evento_id', id).order('creado_en'))),
    intentar(() => q(sb.from('evento_reservas').select(SEL_RESERVA).eq('evento_id', id).neq('estado', 'cancelada').order('creado_en')))
  ]);
  guardar.res = res;
  if (!arts.length && !ges) return '';
  const f = new URLSearchParams(location.hash.split('?')[1] || '').get('r') || 'pendientes';
  const pend = res.filter((r) => r.estado === 'reservada'), pag = res.filter((r) => r.estado === 'pagada');
  const suma = (l) => l.reduce((t, r) => t + +r.importe, 0), uds = (l) => l.reduce((t, r) => t + r.cantidad, 0);
  // Resumen por artículo, con las tallas para hacer el pedido
  const resumen = arts.map((a) => {
    const l = res.filter((r) => r.articulo_id === a.id), tallas = {};
    if (a.con_talla) l.forEach((r) => { const m = tallasReserva(r); if (!Object.keys(m).length) m['Sin talla'] = r.cantidad; Object.entries(m).forEach(([t, n]) => { tallas[t] = (tallas[t] || 0) + n; }); });
    const orden = [...new Set([...tallasDe(a), ...Object.keys(tallas).filter((t) => t !== 'Sin talla'), 'Sin talla'])].filter((t) => tallas[t]);
    return `<div class="vt-art"><div class="vt-art-cab"><b>${esc(a.nombre)}</b><span>${eur(a.precio)} / ud.${ges ? ` <a class="vt-editar" href="#/articulo/${a.id}?evento=${id}" aria-label="Editar ${esc(a.nombre)}">${ico('lapiz', 16)}</a>` : ''}</span></div>
      <div class="nota" style="margin:2px 0 0">${uds(l)} reservad${uds(l) === 1 ? 'a' : 'as'} · ${uds(l.filter((r) => r.estado === 'pagada'))} pagad${uds(l.filter((r) => r.estado === 'pagada')) === 1 ? 'a' : 'as'}</div>
      ${orden.length ? `<div class="tallas">${orden.map((t) => `<span class="chip mor">${t} × ${tallas[t]}</span>`).join('')}</div>` : ''}</div>`;
  }).join('');
  const lista = (f === 'pagadas' ? pag : f === 'todas' ? res : pend);
  const fila = (r) => {
    const a = r.evento_articulos || {}, quien = r.alumnas ? nomAlumna(r.alumnas) : r.comprador, cl = claseDe(r.alumnas);
    const det = [`${r.cantidad} × ${a.nombre || ''}`, r.talla ? (Object.keys(tallasReserva(r)).length > 1 ? 'tallas ' : 'talla ') + textoTallas(tallasReserva(r)) : ''].filter(Boolean).join(' · ');
    // Papelera (solo administración): en una pagada quita el cobro de la caja; en una pendiente borra la reserva
    const papelera = S.admin ? `<button class="vt-borrar" data-${r.estado === 'pagada' ? 'deshacer' : 'borrar-res'}="${r.id}" data-quien="${esc(quien || '')}" data-importe="${r.importe}" aria-label="${r.estado === 'pagada' ? 'Borrar el cobro' : 'Borrar la reserva'}">${ico('papelera', 18)}</button>` : '';
    const der = (r.estado === 'pagada' ? `<span class="vt-ok">${ico('check', 16)} Pagado</span>`
      : cobra ? `<button class="vt-cobrar" data-cobrar="${r.id}">Cobrar</button>` : '<span class="chip gris">Pendiente</span>') + papelera;
    return `<div class="reserva ${r.estado}"><span class="txt"><span class="tit">${esc(quien || '—')}</span><span class="det">${esc(det)}</span></span>
      <b class="${r.estado === 'pagada' ? 'in' : ''}">${eur(r.importe)}</b>${der}
      ${r.estado === 'reservada' && cobra ? `<div class="vt-metodos" id="m-${r.id}" hidden>${METODOS.map(([k, t]) => `<button data-pagar="${r.id}" data-metodo="${k}">${t}</button>`).join('')}</div>` : ''}</div>`;
  };
  return `<div class="seccion">Ventas y reservas</div>
    ${arts.length ? `<div class="tarjeta vt-resumen">${resumen}
      <div class="vt-totales"><div><small>Cobrado</small><b class="in">${eur(suma(pag))}</b></div><div><small>Falta cobrar</small><b>${eur(suma(pend))}</b></div></div></div>
    <div class="filtros">${[['pendientes', `Pendientes (${pend.length})`], ['pagadas', `Pagadas (${pag.length})`], ['todas', 'Todas']].map(([k, t]) => `<button data-ir="#/evento/${id}?r=${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${lista.length ? porClase(lista, (r) => claseDe(r.alumnas)).map(([cl, l0]) => {
      // En cada clase: primero las que han pagado y luego las que faltan, por nombre
      const nom = (r) => r.alumnas ? nomAlumna(r.alumnas) : r.comprador || '';
      const l = l0.slice().sort((a, b) => (a.estado !== 'pagada') - (b.estado !== 'pagada') || nom(a).localeCompare(nom(b), 'es'));
      const cob = suma(l.filter((r) => r.estado === 'pagada')), falta = suma(l.filter((r) => r.estado === 'reservada'));
      return `<details class="caja-clase vt-clase" open><summary class="cc-cab"><span><h3>${esc(cl)}</h3><small>${l.length} reserva${l.length === 1 ? '' : 's'} · ${uds(l)} ud.${falta ? ` · falta ${eur(falta)}` : ''}</small></span>
        <span class="cc-tot"><b class="in">${eur(cob)}</b></span><span class="cc-flecha">${ico('sig', 20)}</span></summary><div class="reservas">${l.map(fila).join('')}</div></details>`;
    }).join('') : `<div class="tarjeta vacio" style="border:0">${f === 'pendientes' ? 'No hay nada pendiente de cobrar.' : 'Todavía no hay nada aquí.'}</div>`}` : vacio('Añade lo que vendes en este evento (camisetas, entradas…) con su precio.')}
    ${ges ? (arts.length ? `<div class="dos-btn"><a class="btn pri" href="#/reserva/nueva?evento=${id}">${ico('mas')} Reserva</a><a class="btn sec" href="#/articulo/nuevo?evento=${id}">${ico('mas')} Artículo</a></div>`
      : `<a class="btn pri" href="#/articulo/nuevo?evento=${id}">${ico('mas')} Añadir camisetas, entradas…</a>`) : ''}`;
}
// Botones "Cobrar" de la ficha del evento: se elige la forma de pago y entra en caja
function activarCobros() {
  $app.querySelectorAll('[data-cobrar]').forEach((b) => b.onclick = () => { const m = document.getElementById('m-' + b.dataset.cobrar); m.hidden = !m.hidden; });
  $app.querySelectorAll('[data-pagar]').forEach((b) => b.onclick = async () => {
    b.disabled = true;
    try { await q(sb.rpc('pagar_reserva', { p_id: b.dataset.pagar, p_metodo: b.dataset.metodo })); aviso('Cobrado: ya está en la caja'); router(); }
    catch (e) { aviso(traducirError(e), true); b.disabled = false; }
  });
  $app.querySelectorAll('[data-deshacer]').forEach((b) => b.onclick = async () => {
    if (!confirm(`¿Borrar el cobro de ${b.dataset.quien} (${eur(b.dataset.importe)})?\n\nSe quita de la caja y la reserva vuelve a "Cobrar".`)) return;
    b.disabled = true;
    try { await q(sb.rpc('deshacer_pago', { p_id: b.dataset.deshacer })); aviso('Cobro borrado: ya no está en la caja'); router(); }
    catch (e) { aviso(traducirError(e), true); b.disabled = false; }
  });
  $app.querySelectorAll('[data-borrar-res]').forEach((b) => b.onclick = async () => {
    if (!confirm(`¿Borrar la reserva de ${b.dataset.quien}?\n\nNo se ha cobrado, así que la caja no cambia.`)) return;
    b.disabled = true;
    try { await q(sb.from('evento_reservas').delete().eq('id', b.dataset.borrarRes)); aviso('Reserva borrada'); router(); }
    catch (e) { aviso(traducirError(e), true); b.disabled = false; }
  });
}
async function formArticulo(params, id) {
  if (!gestionaVentas()) return sinPermiso();
  const ev = params.get('evento');
  const [reg, ultimo, usado] = await Promise.all([
    id ? q(sb.from('evento_articulos').select('*').eq('id', id).single()) : null,
    // Un artículo nuevo copia las tallas del último que se hizo (así, si cambian, se cambian una vez)
    id ? [] : intentar(() => q(sb.from('evento_articulos').select('tallas').not('tallas', 'is', null).order('creado_en', { ascending: false }).limit(1))),
    id ? intentar(() => q(sb.from('evento_reservas').select('id').eq('articulo_id', id).limit(1))) : []
  ]);
  const a = reg || { nombre: '', precio: '', con_talla: false };
  let tallas = [...(reg ? tallasDe(reg) : (ultimo[0] && ultimo[0].tallas) || TALLAS_VENTA)];
  pintar(cabecera(id ? 'Editar artículo' : 'Nuevo artículo', { volver: `#/evento/${ev}` }) + `<main class="cont"><form class="form tarjeta" id="frm">
    <div class="campo"><label for="f_nombre">Qué se vende</label><input id="f_nombre" required value="${esc(a.nombre)}" placeholder="Camiseta, Entrada, Sudadera…"></div>
    <div class="campo"><label for="f_precio">Precio por unidad (€)</label><input id="f_precio" type="number" inputmode="decimal" step="0.01" min="0" required value="${a.precio}"></div>
    <label class="check"><input type="checkbox" id="f_talla" ${a.con_talla ? 'checked' : ''}><span>Lleva talla (al marcarlo salen las tallas, de niña y de adulta)</span></label>
    <div class="campo" id="campo-tallas"><label>Tallas (toca la × para quitar una)</label><div class="tallas" id="lista-tallas"></div>
      <div class="vt-add-talla"><input id="f_nueva" placeholder="Añadir talla: 2 años, XXXL…"><button type="button" class="btn sec" id="add">Añadir</button></div>
      <button type="button" class="enlace" id="defecto">Volver a las tallas de siempre</button></div>
    <button class="btn pri ancho" type="submit">Guardar</button>
    ${id && !usado.length ? '<button class="btn peligro ancho" type="button" id="borrar">Borrar artículo</button>' : ''}
  </form>${id && usado.length ? '<p class="nota">Tiene reservas, por eso no se puede borrar.</p>' : ''}</main>`, false);
  const $ = (x) => document.getElementById(x);
  const pintarTallas = () => {
    $('campo-tallas').hidden = !$('f_talla').checked;
    $('lista-tallas').innerHTML = tallas.map((t, i) => `<span class="chip mor talla-ed">${esc(t)}<button type="button" data-quitar="${i}" aria-label="Quitar ${esc(t)}">×</button></span>`).join('') || '<span class="nota">Sin tallas</span>';
  };
  $('f_talla').onchange = pintarTallas;
  $('lista-tallas').onclick = (e) => { const b = e.target.closest('[data-quitar]'); if (b) { tallas.splice(+b.dataset.quitar, 1); pintarTallas(); } };
  const anadir = () => { const t = $('f_nueva').value.trim(); if (t && !tallas.includes(t)) tallas.push(t); $('f_nueva').value = ''; pintarTallas(); };
  $('add').onclick = anadir;
  $('f_nueva').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); anadir(); } };
  $('defecto').onclick = () => { tallas = [...TALLAS_VENTA]; pintarTallas(); };
  pintarTallas();
  $('frm').onsubmit = async (e) => {
    e.preventDefault();
    const con = $('f_talla').checked;
    if (con && !tallas.length) { aviso('Añade al menos una talla', true); return; }
    const btn = $('frm').querySelector('[type=submit]'); btn.disabled = true;
    const datos = { evento_id: ev, nombre: $('f_nombre').value.trim(), precio: +$('f_precio').value, con_talla: con, tallas: con ? tallas : null };
    const guardar = (d) => id ? q(sb.from('evento_articulos').update(d).eq('id', id)) : q(sb.from('evento_articulos').insert(d));
    try {
      try { await guardar(datos); }
      catch (er) { if (!/tallas/.test(er.message || '')) throw er; const { tallas: _, ...sin } = datos; await guardar(sin); } // falta la 016: se guarda sin lista propia
      aviso('Guardado'); location.hash = `#/evento/${ev}`;
    } catch (er) { aviso(traducirError(er), true); btn.disabled = false; }
  };
  if ($('borrar')) $('borrar').onclick = async () => {
    if (!confirm('¿Borrar este artículo?')) return;
    try { await q(sb.from('evento_articulos').delete().eq('id', id)); aviso('Borrado'); location.hash = `#/evento/${ev}`; }
    catch (er) { aviso(traducirError(er), true); }
  };
}
async function formReserva(params) {
  if (!gestionaVentas()) return sinPermiso();
  const ev = params.get('evento');
  const [e, arts, alumnas, clases, ins] = await Promise.all([
    q(sb.from('eventos').select('id,titulo').eq('id', ev).single()),
    q(sb.from('evento_articulos').select('*').eq('evento_id', ev).order('creado_en')),
    puedeVer('alumnas') ? intentar(opcionesAlumnas) : [],
    puedeVer('clases') ? intentar(() => opcionesClases(true)) : [],
    puedeVer('inscripciones') ? intentar(() => q(sb.from('inscripciones').select('clase_id,alumna_id').is('fecha_baja', null))) : []
  ]);
  if (!arts.length) { location.hash = `#/articulo/nuevo?evento=${ev}`; return; }
  let art = arts[0], cant = 1, porTalla = {};
  const total = () => art.con_talla ? Object.values(porTalla).reduce((t, n) => t + n, 0) : cant;
  pintar(cabecera('Nueva reserva', { volver: `#/evento/${ev}`, sub: esc(e.titulo) }) + `<main class="cont"><form class="form tarjeta" id="frm">
    <div class="campo"><label>Qué se lleva</label><div class="filtros tipos-ini" id="arts">${arts.map((a, i) => `<button type="button" data-art="${i}">${esc(a.nombre)} · ${eur(a.precio)}</button>`).join('')}</div></div>
    ${clases.length ? `<div class="campo"><label for="f_clase">Clase (para buscar más rápido)</label><select id="f_clase"><option value="">Todas las clases</option>${clases.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></div>` : ''}
    <div class="campo"><label for="f_alumna">Alumna</label><select id="f_alumna" name="alumna_id"></select></div>
    <div class="campo"><label for="f_comprador">O si no es alumna, nombre</label><input id="f_comprador" name="comprador" placeholder="Madre de…, público…"></div>
    <div class="campo" id="campo-cant"><label>Cantidad</label><div class="contador-ud"><button type="button" id="menos" aria-label="Una menos">−</button><b id="cant">1</b><button type="button" id="mas" aria-label="Una más">+</button></div></div>
    <div class="campo" id="campo-talla"><label>Tallas (puedes poner varias: una de niña y otra de adulta)</label><div class="por-talla" id="tallas"></div></div>
    <div class="vt-total"><span>Total</span><b id="total"></b></div>
    ${puedeEditar('caja') ? `<label class="check"><input type="checkbox" id="pagado"><span>Ya ha pagado (entra ahora en la caja)</span></label>
    <div class="campo" id="campo-metodo" hidden><label for="f_metodo">Forma de pago</label><select id="f_metodo">${METODOS.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></div>` : ''}
    <button class="btn pri ancho" type="submit">Guardar reserva</button></form></main>`, false);
  const $ = (x) => document.getElementById(x);
  const pintarAlumnas = () => {
    const c = $('f_clase') ? $('f_clase').value : '', dentro = new Set(ins.filter((i) => i.clase_id === c).map((i) => i.alumna_id));
    $('f_alumna').innerHTML = '<option value="">—</option>' + alumnas.filter(([v]) => !c || dentro.has(v)).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('');
  };
  const pintar2 = () => {
    $app.querySelectorAll('[data-art]').forEach((b) => b.classList.toggle('on', arts[+b.dataset.art] === art));
    $('campo-talla').hidden = !art.con_talla; $('campo-cant').hidden = !!art.con_talla; $('cant').textContent = cant;
    if (art.con_talla) $('tallas').innerHTML = tallasDe(art).map((t) => `<div class="pt ${porTalla[t] ? 'on' : ''}"><span>${esc(t)}</span><button type="button" data-t="${esc(t)}" data-d="-1" aria-label="Una menos de ${esc(t)}">−</button><b>${porTalla[t] || 0}</b><button type="button" data-t="${esc(t)}" data-d="1" aria-label="Una más de ${esc(t)}">+</button></div>`).join('');
    $('total').textContent = `${total()} × ${eur(art.precio)} = ${eur(total() * art.precio)}`;
  };
  if ($('f_clase')) $('f_clase').onchange = pintarAlumnas;
  $('arts').onclick = (ev2) => { const b = ev2.target.closest('[data-art]'); if (b) { art = arts[+b.dataset.art]; porTalla = {}; pintar2(); } };
  $('tallas').onclick = (ev2) => { const b = ev2.target.closest('[data-t]'); if (b) { const t = b.dataset.t; porTalla[t] = Math.max(0, (porTalla[t] || 0) + +b.dataset.d); pintar2(); } };
  $('menos').onclick = () => { if (cant > 1) cant--; pintar2(); };
  $('mas').onclick = () => { cant++; pintar2(); };
  if ($('pagado')) $('pagado').onchange = () => { $('campo-metodo').hidden = !$('pagado').checked; };
  pintarAlumnas(); pintar2();
  $('frm').onsubmit = async (ev2) => {
    ev2.preventDefault();
    const alumna_id = $('f_alumna').value || null, comprador = $('f_comprador').value.trim() || null;
    if (!alumna_id && !comprador) { aviso('Elige la alumna o escribe un nombre', true); return; }
    if (!total()) { aviso(art.con_talla ? 'Pon cuántas de cada talla' : 'Pon la cantidad', true); return; }
    const btn = $('frm').querySelector('[type=submit]'); btn.disabled = true;
    try {
      const r = await q(sb.from('evento_reservas').insert({ evento_id: ev, articulo_id: art.id, alumna_id, comprador, cantidad: total(), talla: art.con_talla ? textoTallas(porTalla) : null, importe: total() * art.precio }).select().single());
      if ($('pagado') && $('pagado').checked) await q(sb.rpc('pagar_reserva', { p_id: r.id, p_metodo: $('f_metodo').value }));
      aviso('Guardado'); location.hash = `#/evento/${ev}`;
    } catch (e2) { aviso(traducirError(e2), true); btn.disabled = false; }
  };
}
async function formEvento(id, params) {
  // Al crear: si se va a vender algo (camisetas, entradas…), al guardar se pasa directo a poner qué se vende, precio y tallas
  let vender = false, coordSel = undefined;
  const venta = !id && params && params.get('venta') === '1';
  const conTabla = await hayCoordinadoras();
  let campoCoord = { k: 'coordinadora_id', label: 'Coordina', tipo: 'select', opciones: puedeVer('profesoras') ? await intentar(opcionesProfesoras) : [] };
  let selIni = '';
  if (conTabla) {
    const prin = id ? (await intentar(() => q(sb.from('evento_coordinadoras').select('profesora_id,nombre').eq('evento_id', id).eq('principal', true)))).find(Boolean) : null;
    selIni = prin ? (prin.profesora_id ? 'p:' + prin.profesora_id : 'n:' + String(prin.nombre).trim()) : '';
    const opc = await opcionesCoordinadoras();
    if (selIni.startsWith('n:') && !opc.equipo.some((n) => 'n:' + n === selIni)) opc.equipo.push(selIni.slice(2));
    campoCoord = { k: '_coord', label: 'Coordinadora principal', tipo: 'html', html: `<div class="campo"><label for="f__coord">Coordinadora principal</label><select id="f__coord" name="_coord">${opcionesCoordHtml(opc, selIni)}</select>
      <input id="f__coord_otra" name="_coord_otra" type="text" placeholder="Escribe su nombre (Adela, María…)" style="display:none;margin-top:8px">
      <div class="ayuda">Puede ser una profesora o alguien del equipo. Después, en el evento, puedes añadir más coordinadoras.</div></div>` };
  }
  await pantallaForm({
    titulo: id ? 'Editar evento' : venta ? 'Nueva venta' : 'Nuevo evento', tabla: 'eventos', modulo: 'eventos', id, volver: id ? `#/evento/${id}` : venta ? '#/caja?t=ingreso&s=eventos' : '#/eventos',
    despues: (r) => vender ? `#/articulo/nuevo?evento=${r.id}` : `#/evento/${r.id}`, valoresIniciales: venta ? { _vender: true } : {},
    transformar: (d) => {
      vender = !!d._vender; delete d._vender;
      if (conTabla) {
        d.coordinadora_id = null;   // la coordinación va ahora en evento_coordinadoras (la 018 ya copió la de antes)
        const f = document.getElementById('frm'), v = f.elements._coord.value;
        coordSel = v === selIni ? undefined : elegidaCoord(v, f.elements._coord_otra.value);
        if (v === 'otra' && !coordSel) throw new Error('Escribe el nombre de la coordinadora');
      }
      return d;
    },
    alGuardar: (r) => conTabla && coordSel !== undefined ? guardarPrincipal(r.id, coordSel) : null,
    campos: [
      { k: 'titulo', label: 'Título', req: true, ph: venta ? 'Camisetas Navidad, Entradas fin de curso…' : 'Halloween, Gala de Navidad…' },
      ...(id ? [] : [{ k: '_vender', label: 'Se vende algo (camisetas, entradas…). Al guardar te pido qué, el precio y las tallas.', tipo: 'bool' }]),
      { k: 'fecha', label: 'Fecha', tipo: 'fecha', req: true }, { k: 'hora', label: 'Hora', tipo: 'hora' },
      { k: 'lugar', label: 'Lugar' }, campoCoord,
      { k: 'descripcion', label: 'Descripción', tipo: 'textarea' }, { k: 'precio_alumna', label: 'Precio por alumna (€)', tipo: 'dinero' },
      { k: 'inscripcion_hasta', label: 'Inscripción hasta', tipo: 'fecha' }, { k: 'normas', label: 'Normas del evento', tipo: 'textarea' },
      { k: 'condiciones', label: 'Condiciones (plazos, vestuario…)', tipo: 'textarea' }
    ]
  });
  const sc = document.getElementById('f__coord'), otra = document.getElementById('f__coord_otra');
  if (sc) sc.onchange = () => { otra.style.display = sc.value === 'otra' ? '' : 'none'; if (sc.value === 'otra') otra.focus(); };
}

/* ---------- escuelas amigas ---------- */
async function pantallaEscuelas() {
  if (!puedeVer('escuelas_amigas')) return sinPermiso();
  const l = await q(sb.from('escuela_amiga_resumen').select('*').order('nombre'));
  pintar(cabecera('Escuelas amigas', { volver: volverDe('escuelas_amigas'), sub: 'Clases externas, cuota y coincidencias' }) + `<main class="cont">
    <div class="lista">${l.map((e) => fila({ href: `#/escuela/${e.id}`, iconoHtml: `<span class="ini">${ico('escuela', 18)}</span>`, tit: e.nombre,
      det: `${(+e.horas_semana).toLocaleString('es-ES')} h/semana · ${e.n_clases} clases · ${e.n_alumnas} alumnas`, der: `<span class="chip oro">${eur(e.cuota_mensual)}/mes</span>` })).join('') || vacio('Aún no hay escuelas amigas.')}</div>
    ${fila({ href: '#/coincidencias', tit: 'Coincidencias', det: 'Alumnas que van a las dos escuelas', iconoHtml: `<span class="ini">${ico('alumnas', 18)}</span>`, der: ico('sig') })}
  </main>`, 'mas', puedeEditar('escuelas_amigas') ? '#/escuela/nueva' : null);
}
async function pantallaEscuela(id) {
  if (!puedeVer('escuelas_amigas')) return sinPermiso();
  const [e, res, clases, notas, coinc] = await Promise.all([
    q(sb.from('escuelas_amigas').select('*').eq('id', id).single()),
    q(sb.from('escuela_amiga_resumen').select('*').eq('id', id).single()),
    puedeVer('clases') ? intentar(() => q(sb.from('clases').select('*,' + SEL_HOR).eq('escuela_amiga_id', id))) : [],
    q(sb.from('notas_escuela_amiga').select('*').eq('escuela_amiga_id', id).order('fecha', { ascending: false })),
    q(sb.from('coincidencias_escuela_amiga').select('*').eq('escuela_amiga_id', id))
  ]);
  const ed = puedeEditar('escuelas_amigas');
  const mes = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  pintar(cabecera(e.nombre, { volver: '#/escuelas', sub: e.activa ? 'Activa' : 'Inactiva' }) + `<main class="cont">
    <div class="totales"><div><small>Horas/sem.</small><b>${(+res.horas_semana).toLocaleString('es-ES')}</b></div><div><small>Tarifa</small><b>${eur(e.tarifa_hora_semana)}</b></div><div><small>Cuota/mes</small><b class="in">${eur(res.cuota_mensual)}</b></div></div>
    <div class="tarjeta"><dl class="datos"><dt>Contacto</dt><dd>${esc(e.contacto || '—')}</dd><dt>Teléfono</dt><dd>${esc(e.telefono || '—')}</dd><dt>Correo</dt><dd>${esc(e.email || '—')}</dd>${e.notas ? `<dt>Notas</dt><dd>${esc(e.notas)}</dd>` : ''}</dl></div>
    <div class="botones">${ed ? `<a class="btn sec" href="#/escuela/${id}/editar">${ico('lapiz')} Editar</a>` : ''}
      ${puedeEditar('caja') && +res.cuota_mensual > 0 ? `<a class="btn verde" href="#/caja/nuevo?tipo=ingreso&importe=${res.cuota_mensual}&escuela=${id}&concepto=${encodeURIComponent('Cuota ' + e.nombre + ' ' + mes)}">${ico('euro')} Cobrar cuota</a>` : ''}</div>
    ${puedeVer('clases') ? `<div class="seccion">Sus clases en nuestra sala</div>
      <div class="lista">${clases.sort((a, b) => ordenClase(a) - ordenClase(b)).map((c) => fila({ href: `#/clase/${c.id}`, ini: iniciales(c.nombre), tit: c.nombre, det: esc(`${textoHorario(c)} · ${c.profesora_externa || 'sin profesora'} · ${c.alumnas_externas ?? 0} alumnas`), der: c.activa ? '' : '<span class="chip gris">Inactiva</span>' })).join('') || vacio('Sin clases registradas.')}</div>
      ${puedeEditar('clases') ? `<a class="btn sec" href="#/escuela/${id}/clase/nueva">${ico('mas')} Añadir clase externa</a>` : ''}` : ''}
    <div class="seccion">Coincidencias (${coinc.length})</div>
    <div class="lista">${coinc.map((c) => fila({ href: `#/alumna/${c.alumna_id}`, tit: `${c.nombre} ${c.apellidos || ''}`, det: esc([c.clase_externa, c.notas].filter(Boolean).join(' · ')) })).join('') || vacio('Ninguna alumna nuestra va a esta escuela.')}</div>
    ${ed ? `<a class="btn sec" href="#/coincidencia/nueva?escuela=${id}">${ico('mas')} Añadir coincidencia</a>` : ''}
    <div class="seccion">Notas</div>
    <div class="lista">${notas.map((n) => `<div class="tarjeta"><div style="font-size:12px;color:var(--texto2)">${fechaCorta(n.fecha)}${S.admin && n.creado_por ? ' · ' + esc(S.nombres[n.creado_por] || '') : ''}</div><div style="margin-top:4px;white-space:pre-wrap">${esc(n.texto)}</div></div>`).join('') || vacio('Sin notas.')}</div>
    ${ed ? `<a class="btn sec" href="#/escuela/${id}/nota">${ico('mas')} Añadir nota</a>` : ''}
    ${autorDe(e)}
  </main>`, 'mas');
}
const formEscuela = (id) => pantallaForm({
  titulo: id ? 'Editar escuela' : 'Nueva escuela amiga', tabla: 'escuelas_amigas', modulo: 'escuelas_amigas', id, volver: id ? `#/escuela/${id}` : '#/escuelas', despues: (r) => `#/escuela/${r.id}`,
  campos: [
    { k: 'nombre', label: 'Nombre', req: true }, { k: 'contacto', label: 'Persona de contacto' }, { k: 'telefono', label: 'Teléfono', tipo: 'tel' }, { k: 'email', label: 'Correo', tipo: 'email' },
    { k: 'tarifa_hora_semana', label: 'Tarifa (€ al mes por cada hora semanal)', tipo: 'dinero', req: true, def: 40, ayuda: 'Ejemplo: 2,5 h a la semana × 40 € = 100 € al mes.' },
    { k: 'activa', label: 'Activa', tipo: 'bool', def: true }, { k: 'notas', label: 'Notas', tipo: 'textarea' }
  ]
});
const formClaseExterna = (escuela, id) => formClase(id, escuela);
async function pantallaCoincidencias() {
  if (!puedeVer('escuelas_amigas')) return sinPermiso();
  const l = await q(sb.from('coincidencias_escuela_amiga').select('*').order('nombre'));
  pintar(cabecera('Coincidencias', { volver: '#/escuelas', sub: 'Alumnas que van a las dos escuelas' }) + `<main class="cont"><div class="lista">${l.map((c) => fila({
    href: `#/alumna/${c.alumna_id}`, tit: `${c.nombre} ${c.apellidos || ''}`, det: esc([c.escuela, c.clase_externa, c.notas].filter(Boolean).join(' · ')) })).join('') || vacio('No hay coincidencias registradas.')}</div></main>`, 'mas', puedeEditar('escuelas_amigas') ? '#/coincidencia/nueva' : null);
}
async function formCoincidencia(params) {
  if (!puedeEditar('escuelas_amigas')) return sinPermiso();
  const escuela = params.get('escuela');
  const campos = [
    { k: 'alumna_id', label: 'Alumna nuestra', tipo: 'select', req: true, opciones: puedeVer('alumnas') ? await intentar(opcionesAlumnas) : [] },
    { k: 'escuela_amiga_id', label: 'Escuela amiga', tipo: 'select', req: true, opciones: await intentar(opcionesEscuelas) },
    { k: 'clase_id', label: 'Clase de la escuela amiga', tipo: 'select', opciones: puedeVer('clases') ? (await intentar(() => q(sb.from('clases').select('id,nombre,' + SEL_HOR).not('escuela_amiga_id', 'is', null)))).map((c) => [c.id, `${c.nombre} · ${textoHorario(c)}`]) : [] },
    { k: 'notas', label: 'Notas', tipo: 'textarea' }
  ];
  const volver = escuela ? `#/escuela/${escuela}` : '#/coincidencias';
  pintar(cabecera('Nueva coincidencia', { volver }) + `<main class="cont"><form class="form tarjeta" id="frm">${campos.map((c) => campoHtml(c, c.k === 'escuela_amiga_id' ? escuela : null)).join('')}<button class="btn pri ancho">Guardar</button></form></main>`, false);
  document.getElementById('frm').onsubmit = async (ev) => {
    ev.preventDefault();
    try { await q(sb.from('alumnas_escuela_amiga').insert(leerForm(ev.target, campos))); aviso('Guardado'); location.hash = volver; } catch (e) { aviso(traducirError(e), true); }
  };
}
const formNotaEscuela = (escuela) => pantallaForm({
  titulo: 'Nueva nota', tabla: 'notas_escuela_amiga', modulo: 'escuelas_amigas', volver: `#/escuela/${escuela}`,
  transformar: (d) => Object.assign(d, { escuela_amiga_id: escuela }),
  campos: [{ k: 'fecha', label: 'Fecha', tipo: 'fecha', req: true, def: hoyISO() }, { k: 'texto', label: 'Nota', tipo: 'textarea', req: true }]
});

/* ---------- formularios (WhatsApp) ---------- */
const CAMPOS_TIPO = [
  ['nombre', 'Nombre', 'texto', true], ['apellidos', 'Apellidos', 'texto', false], ['fecha_nacimiento', 'Fecha de nacimiento', 'fecha', false],
  ['telefono', 'Teléfono', 'tel', false], ['email', 'Correo', 'email', false], ['clase', 'Clase que le interesa', 'texto', false],
  ['tutor', 'Datos de madre/padre/tutor (para menores)', 'tutor', false]
];
const PRIVACIDAD_PLANTILLA = 'PLANTILLA PENDIENTE DE REVISIÓN. Responsable: Academia Blackstars. Finalidad: gestionar tu inscripción y comunicarnos contigo sobre las clases. Legitimación: tu consentimiento. No cederemos tus datos a terceros salvo obligación legal. Puedes ejercer tus derechos de acceso, rectificación, supresión y demás escribiendo a la academia. Si la alumna es menor de 14 años, el consentimiento debe darlo su madre, padre o tutor legal.';
const enlaceForm = (slug) => location.origin + location.pathname + '?f=' + slug;

async function pantallaFormularios() {
  if (!puedeVer('formularios')) return sinPermiso();
  const l = await q(sb.from('formularios').select('id,titulo,estado,creado_en,respuestas_formulario(count)').order('creado_en', { ascending: false }));
  const est = { borrador: '<span class="chip gris">Borrador</span>', abierto: '<span class="chip ok">Abierto</span>', cerrado: '<span class="chip no">Cerrado</span>' };
  pintar(cabecera('Formularios', { volver: volverDe('formularios'), sub: 'Enlaces por WhatsApp y respuestas' }) + `<main class="cont"><div class="lista">${l.map((f) => fila({
    href: `#/formulario/${f.id}`, iconoHtml: `<span class="ini">${ico('form', 18)}</span>`, tit: f.titulo, det: `${f.respuestas_formulario && f.respuestas_formulario[0] ? f.respuestas_formulario[0].count : 0} respuestas · ${fechaCorta(f.creado_en)}`, der: est[f.estado] })).join('') || vacio('Aún no hay formularios.')}</div></main>`, 'mas', puedeEditar('formularios') ? '#/formulario/nuevo' : null);
}
async function formFormulario(id) {
  if (!puedeEditar('formularios')) return sinPermiso();
  const reg = id ? await q(sb.from('formularios').select('*').eq('id', id).single()) : null;
  const campos = reg ? reg.campos : CAMPOS_TIPO.filter((c) => ['nombre', 'apellidos', 'fecha_nacimiento', 'telefono', 'tutor'].includes(c[0])).map((c) => ({ id: c[0] }));
  const tiene = (k) => campos.some((c) => c.id === k);
  const extras = campos.filter((c) => c.tipo === 'pregunta');
  pintar(cabecera(id ? 'Editar formulario' : 'Nuevo formulario', { volver: id ? `#/formulario/${id}` : '#/formularios' }) + `<main class="cont"><form class="form tarjeta" id="frm">
    ${campoHtml({ k: 'titulo', label: 'Título', req: true, ph: 'Inscripción curso 2026-27' }, reg && reg.titulo)}
    ${campoHtml({ k: 'descripcion', label: 'Texto de presentación', tipo: 'textarea' }, reg && reg.descripcion)}
    <div class="seccion">Datos que se piden</div>
    ${CAMPOS_TIPO.map((c) => `<label class="check"><input type="checkbox" name="c_${c[0]}" ${tiene(c[0]) || c[3] ? 'checked' : ''} ${c[3] ? 'disabled' : ''}><span>${esc(c[1])}${c[3] ? ' (siempre)' : ''}</span></label>`).join('')}
    <div class="seccion">Preguntas extra (opcional)</div>
    ${[0, 1, 2].map((i) => `<div class="campo"><input name="extra${i}" placeholder="Pregunta ${i + 1}" value="${esc(extras[i] ? extras[i].etiqueta : '')}"></div>`).join('')}
    ${campoHtml({ k: 'texto_privacidad', label: 'Aviso de privacidad', tipo: 'textarea', req: true, ayuda: 'Es una plantilla: debe revisarla quien lleve la protección de datos antes de usarlo con alumnas reales.' }, reg ? reg.texto_privacidad : PRIVACIDAD_PLANTILLA)}
    ${campoHtml({ k: 'estado', label: 'Estado', tipo: 'select', vacio: false, opciones: [['borrador', 'Borrador (aún no se puede rellenar)'], ['abierto', 'Abierto'], ['cerrado', 'Cerrado']] }, reg ? reg.estado : 'borrador')}
    ${campoHtml({ k: 'abierto_hasta', label: 'Abierto hasta (opcional)', tipo: 'fecha' }, reg && reg.abierto_hasta ? reg.abierto_hasta.slice(0, 10) : '')}
    <button class="btn pri ancho">Guardar</button>
    ${id && S.admin ? '<button class="btn peligro ancho" type="button" id="borrar">Borrar formulario y respuestas</button>' : ''}
  </form></main>`, false);
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const nuevos = CAMPOS_TIPO.filter((c) => c[3] || form.elements['c_' + c[0]].checked).map((c) => ({ id: c[0], tipo: c[2], etiqueta: c[1], obligatorio: c[3] }));
    [0, 1, 2].forEach((i) => { const t = form.elements['extra' + i].value.trim(); if (t) nuevos.push({ id: 'extra' + (i + 1), tipo: 'pregunta', etiqueta: t, obligatorio: false }); });
    const fin = form.abierto_hasta.value;
    const datos = { titulo: form.titulo.value.trim(), descripcion: form.descripcion.value.trim() || null, campos: nuevos, texto_privacidad: form.texto_privacidad.value.trim(), estado: form.estado.value, abierto_hasta: fin ? new Date(fin + 'T23:59:59').toISOString() : null };
    try {
      const r = id ? await q(sb.from('formularios').update(datos).eq('id', id).select().single()) : await q(sb.from('formularios').insert(datos).select().single());
      aviso('Guardado'); location.hash = `#/formulario/${r.id}`;
    } catch (e) { aviso(traducirError(e), true); }
  };
  const b = document.getElementById('borrar');
  if (b) b.onclick = async () => { if (!confirm('¿Borrar el formulario y TODAS sus respuestas?')) return; try { await q(sb.from('formularios').delete().eq('id', id)); location.hash = '#/formularios'; } catch (e) { aviso(traducirError(e), true); } };
}
async function pantallaFormulario(id) {
  if (!puedeVer('formularios')) return sinPermiso();
  const [f, resp] = await Promise.all([q(sb.from('formularios').select('*').eq('id', id).single()), q(sb.from('respuestas_formulario').select('*').eq('formulario_id', id).order('enviada_en', { ascending: false }))]);
  const url = enlaceForm(f.slug);
  const msg = `${f.titulo}\n${f.descripcion ? f.descripcion + '\n' : ''}Rellénalo aquí: ${url}`;
  pintar(cabecera(f.titulo, { volver: '#/formularios', sub: { borrador: 'Borrador', abierto: 'Abierto', cerrado: 'Cerrado' }[f.estado] }) + `<main class="cont">
    ${f.estado !== 'abierto' ? `<div class="vacio">Este formulario no está abierto: quien abra el enlace verá que no está disponible.${puedeEditar('formularios') ? ' Ábrelo desde Editar.' : ''}</div>` : ''}
    <div class="tarjeta" style="word-break:break-all;font-size:13px;color:var(--texto2)">${esc(url)}</div>
    <div class="botones"><a class="btn verde" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">${ico('wa')} Enviar por WhatsApp</a><button class="btn sec" id="copiar">${ico('copiar')} Copiar enlace</button></div>
    <div class="botones"><a class="btn sec" href="${esc(url)}" target="_blank" rel="noopener">Ver como alumna</a>${puedeEditar('formularios') ? `<a class="btn sec" href="#/formulario/${id}/editar">${ico('lapiz')} Editar</a>` : ''}</div>
    <div class="seccion">Respuestas (${resp.length})</div>
    <div class="lista">${resp.map((r) => fila({ href: `#/respuesta/${r.id}`, tit: `${r.datos.nombre || '—'} ${r.datos.apellidos || ''}`, det: new Date(r.enviada_en).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }), der: r.revisada ? '<span class="chip gris">Revisada</span>' : '<span class="chip oro">Nueva</span>' })).join('') || vacio('Aún no hay respuestas.')}</div>
  </main>`, 'mas');
  document.getElementById('copiar').onclick = async () => { try { await navigator.clipboard.writeText(url); aviso('Enlace copiado'); } catch (e) { prompt('Copia el enlace:', url); } };
}
async function pantallaRespuesta(id) {
  if (!puedeVer('formularios')) return sinPermiso();
  const r = await q(sb.from('respuestas_formulario').select('*,formularios(id,titulo,campos)').eq('id', id).single());
  const d = r.datos, etiquetas = {};
  (r.formularios.campos || []).forEach((c) => { etiquetas[c.id] = c.etiqueta; });
  Object.assign(etiquetas, { tutor_nombre: 'Tutor', tutor_telefono: 'Teléfono del tutor', tutor_autoriza: 'Autorización del tutor' });
  const filas = Object.entries(d).map(([k, v]) => `<dt>${esc(etiquetas[k] || k)}</dt><dd>${esc(v === true ? 'Sí' : v === false ? 'No' : (k === 'fecha_nacimiento' && v ? fechaCorta(v) + ` (${edad(v)} años)` : v))}</dd>`).join('');
  const ed = puedeEditar('formularios');
  pintar(cabecera(`${d.nombre || 'Respuesta'} ${d.apellidos || ''}`, { volver: `#/formulario/${r.formularios.id}`, sub: r.formularios.titulo }) + `<main class="cont">
    <div class="tarjeta"><dl class="datos">${filas}<dt>Privacidad</dt><dd>${r.acepta_privacidad ? 'Aceptada' : 'No'}</dd><dt>Enviada</dt><dd>${new Date(r.enviada_en).toLocaleString('es-ES')}</dd></dl></div>
    ${ed ? `<div class="botones">${r.revisada ? '' : '<button class="btn sec" id="rev">Marcar revisada</button>'}${!r.alumna_id && puedeEditar('alumnas') ? '<button class="btn pri" id="crear">Crear alumna</button>' : ''}</div>` : ''}
    ${r.alumna_id ? `<a class="btn sec" href="#/alumna/${r.alumna_id}">Ver ficha de la alumna</a>` : ''}
  </main>`, 'mas');
  const rv = document.getElementById('rev');
  if (rv) rv.onclick = async () => { try { await q(sb.from('respuestas_formulario').update({ revisada: true }).eq('id', id)); router(); } catch (e) { aviso(traducirError(e), true); } };
  const cr = document.getElementById('crear');
  if (cr) cr.onclick = async () => {
    try {
      const a = await q(sb.from('alumnas').insert({ nombre: d.nombre || 'Sin nombre', apellidos: d.apellidos || null, fecha_nacimiento: d.fecha_nacimiento || null, telefono: d.telefono || null, email: d.email || null, tutor_nombre: d.tutor_nombre || null, tutor_telefono: d.tutor_telefono || null, notas: d.clase ? 'Interesada en: ' + d.clase : null }).select().single());
      await q(sb.from('respuestas_formulario').update({ alumna_id: a.id, revisada: true }).eq('id', id));
      aviso('Alumna creada'); location.hash = `#/alumna/${a.id}`;
    } catch (e) { aviso(traducirError(e), true); }
  };
}

/* Formulario público (sin cuenta): index.html?f=slug */
async function formularioPublico(slug) {
  $app.innerHTML = '<div class="cargando">Cargando…</div>';
  const { data, error } = await sb.rpc('formulario_publico', { p_slug: slug });
  const f = data && data[0];
  const marco = (cuerpo) => `<header class="cab"><img class="logo" src="icons/logo.png" alt="Blackstars"><div class="t"><div class="sup">Academia Blackstars</div><h1>${esc(f ? f.titulo : 'Formulario')}</h1></div></header><main class="cont">${cuerpo}</main>`;
  if (error || !f) { $app.innerHTML = marco(vacio('Este formulario no está disponible o ya se ha cerrado.')); return; }
  const campos = f.campos || [];
  const html = campos.map((c) => {
    if (c.tipo === 'tutor') return `<div id="bloqueTutor" class="form"><div class="seccion">Madre, padre o tutor</div>
      ${campoHtml({ k: 'tutor_nombre', label: 'Nombre del tutor' })}${campoHtml({ k: 'tutor_telefono', label: 'Teléfono del tutor', tipo: 'tel' })}
      <label class="check"><input type="checkbox" name="tutor_autoriza"><span>Soy la madre, el padre o el tutor legal y autorizo esta inscripción y el tratamiento de sus datos.</span></label></div>`;
    const t = { texto: 'texto', pregunta: 'textarea', fecha: 'fecha', tel: 'tel', email: 'email' }[c.tipo] || 'texto';
    return campoHtml({ k: c.id, label: c.etiqueta, tipo: t, req: c.obligatorio });
  }).join('');
  $app.innerHTML = marco(`${f.descripcion ? `<div class="tarjeta" style="white-space:pre-wrap">${esc(f.descripcion)}</div>` : ''}
    <form class="form tarjeta" id="frm">${html}
      <div class="tarjeta" style="font-size:13px;color:var(--texto2);white-space:pre-wrap;max-height:180px;overflow:auto;box-shadow:none">${esc(f.texto_privacidad || '')}</div>
      <label class="check"><input type="checkbox" name="acepta" required><span>He leído y acepto el aviso de privacidad *</span></label>
      <button class="btn pri ancho">Enviar</button></form>`);
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const datos = {};
    campos.forEach((c) => {
      if (c.tipo === 'tutor') { datos.tutor_nombre = form.tutor_nombre.value.trim(); datos.tutor_telefono = form.tutor_telefono.value.trim(); datos.tutor_autoriza = form.tutor_autoriza.checked; }
      else datos[c.id] = (form.elements[c.id].value || '').trim();
    });
    const e = edad(datos.fecha_nacimiento);
    if (e != null && e < 18 && datos.tutor_nombre !== undefined && (!datos.tutor_nombre || !datos.tutor_telefono)) { aviso('Para menores hay que rellenar los datos del tutor', true); return; }
    if (e != null && e < 14 && !datos.tutor_autoriza) { aviso('Para menores de 14 años la madre, el padre o el tutor debe marcar la autorización', true); return; }
    const btn = form.querySelector('button'); btn.disabled = true; btn.textContent = 'Enviando…';
    const { error: er } = await sb.rpc('enviar_respuesta', { p_slug: slug, p_datos: datos, p_acepta: form.acepta.checked });
    if (er) { aviso(traducirError(er), true); btn.disabled = false; btn.textContent = 'Enviar'; return; }
    $app.innerHTML = marco(`<div class="tarjeta" style="text-align:center;padding:30px 20px"><div style="font-size:40px">⭐</div><h2 style="margin-top:8px">¡Gracias!</h2><p style="color:var(--texto2)">Hemos recibido tus datos. La academia se pondrá en contacto contigo.</p></div>`);
  };
}

/* ---------- permisos (solo admin) ---------- */
async function pantallaPermisos(params) {
  if (!S.admin) return sinPermiso();
  const perfiles = await q(sb.from('perfiles').select('*').neq('id', S.usuario.id).order('nombre'));
  const sel = params.get('p');
  if (!sel) { location.hash = '#/equipo'; return; }
  const p = perfiles.find((x) => x.id === sel);
  const filas = p ? await q(sb.from('permisos').select('*').eq('perfil_id', p.id)) : [];
  const per = {}; filas.forEach((f) => { per[f.modulo] = f; });
  const soloSuyo = esProfesora(per);
  pintar(cabecera(p ? p.nombre : 'Permisos', { volver: '#/equipo', sub: p ? esc(resumenPersona(p, filas).tipo) : '' }) + `<main class="cont">
    ${p ? `<button class="btn sec ancho" data-ir="#/vista/p/${p.id}">${ico('ojo')} Ver su Inicio</button>
    <div class="tarjeta"><h3>Plantillas</h3><p class="nota" style="margin:4px 0 10px">Un toque pone los permisos típicos. Luego puedes cambiar los que quieras abajo.</p>
      <div class="filtros tipos-ini">${Object.entries(PLANTILLAS).map(([k, t]) => `<button data-plantilla="${k}">${t.nombre}</button>`).join('')}</div></div>
    <div class="tarjeta">
      <div class="perm"><span class="cab-p" style="text-align:left">Módulo</span><span class="cab-p">Ver</span><span class="cab-p">Editar</span></div>
      ${MODULOS.map(([m, t]) => { const v = per[m] && per[m].puede_ver, e = per[m] && per[m].puede_escribir;
        return `<div class="perm"><span style="font-weight:600">${t}${m === 'iniciativas' && per[m] && per[m].solo_propias && !soloSuyo ? '<br><small style="font-weight:400;color:var(--texto2)">Propone y ve las suyas</small>' : ''}</span><button class="${v ? 'on' : ''}" data-m="${m}" data-a="ver" aria-label="Ver ${t}" aria-pressed="${!!v}">${ico('ojo')}</button><button class="${e ? 'on' : ''}" data-m="${m}" data-a="editar" aria-label="Editar ${t}" aria-pressed="${!!e}">${ico('lapiz')}</button></div>`; }).join('')}
    </div>
    <label class="check"><input type="checkbox" id="solo" ${soloSuyo ? 'checked' : ''}><span><b>Solo ve lo suyo</b><br><span style="font-size:13px;color:var(--texto2)">Para profesoras: solo sus clases, sus alumnas, sus incidencias y sus eventos. Enlaza antes su ficha en Profesoras.</span></span></label>
    <label class="check"><input type="checkbox" id="activo" ${p.activo ? 'checked' : ''}><span><b>Acceso activo</b><br><span style="font-size:13px;color:var(--texto2)">Si lo quitas, no verá nada aunque tenga permisos.</span></span></label>
    <div class="campo"><label for="nom">Nombre que se muestra</label><input id="nom" value="${esc(p.nombre)}"></div>
    <p style="font-size:13px;color:var(--texto2);margin:0">Ojo = puede ver. Lápiz = puede editar. Quien edita un módulo también lo ve. Borrar definitivamente es solo de la administración.</p>`
    : vacio('Todavía no hay más personas. Cuando quieras dar acceso a alguien, créale un usuario y aparecerá aquí sin ningún permiso.')}
  </main>`, 'mas');
  if (!p) return;
  $app.querySelectorAll('[data-plantilla]').forEach((b) => b.onclick = async () => {
    const t = PLANTILLAS[b.dataset.plantilla];
    if (!confirm(`¿Poner a ${p.nombre} los permisos de "${t.nombre}"? Se cambian los que tiene ahora.`)) return;
    try {
      await q(sb.from('permisos').delete().eq('perfil_id', p.id));
      await q(sb.from('permisos').insert(filasPlantilla(t, p.id)));
      aviso(`Permisos de ${t.nombre} puestos`); router();
    } catch (e) { aviso(traducirError(e), true); }
  });
  const guardar = async (m, ver, editar) => {
    // Iniciativas guarda su propio "solo las suyas" (recepción propone y ve las suyas)
    const solo = m === 'iniciativas' && per[m] ? !!per[m].solo_propias : document.getElementById('solo').checked;
    try {
      if (!ver && !editar) await q(sb.from('permisos').delete().eq('perfil_id', p.id).eq('modulo', m));
      else await q(sb.from('permisos').upsert({ perfil_id: p.id, modulo: m, puede_ver: ver, puede_escribir: editar, solo_propias: solo }));
      per[m] = ver || editar ? { puede_ver: ver, puede_escribir: editar, solo_propias: solo } : undefined;
      aviso('Permiso guardado');
    } catch (e) { aviso(traducirError(e), true); }
  };
  $app.querySelectorAll('.perm button').forEach((b) => b.onclick = async () => {
    const m = b.dataset.m, cur = per[m] || {};
    let ver = !!cur.puede_ver, ed = !!cur.puede_escribir;
    if (b.dataset.a === 'ver') { ver = !ver; if (!ver) ed = false; } else { ed = !ed; if (ed) ver = true; }
    await guardar(m, ver, ed);
    const fila = b.parentElement.querySelectorAll('button');
    fila[0].classList.toggle('on', ver); fila[1].classList.toggle('on', ed);
    fila[0].setAttribute('aria-pressed', ver); fila[1].setAttribute('aria-pressed', ed);
  });
  document.getElementById('solo').onchange = async (ev) => {
    let u = sb.from('permisos').update({ solo_propias: ev.target.checked }).eq('perfil_id', p.id);
    if (!ev.target.checked) u = u.neq('modulo', 'iniciativas');
    try { await q(u); aviso(ev.target.checked ? 'Ahora solo ve lo suyo' : 'Ahora ve todo lo de sus módulos'); } catch (e) { aviso(traducirError(e), true); }
  };
  document.getElementById('activo').onchange = async (ev) => {
    try { await q(sb.from('perfiles').update({ activo: ev.target.checked }).eq('id', p.id)); aviso(ev.target.checked ? 'Acceso activado' : 'Acceso desactivado'); } catch (e) { aviso(traducirError(e), true); }
  };
  document.getElementById('nom').onchange = async (ev) => {
    const n = ev.target.value.trim(); if (!n) return;
    try { await q(sb.from('perfiles').update({ nombre: n }).eq('id', p.id)); S.nombres[p.id] = n; aviso('Nombre guardado'); } catch (e) { aviso(traducirError(e), true); }
  };
}

/* ======================================================================
   LOGROS: retos del mes para profesoras y estrellas semanales para alumnas
   ====================================================================== */
const MAX_RETOS = 5, SEMANAS = 4;
const CATEG = [['esfuerzo', 'Esfuerzo'], ['tareas', 'Tareas'], ['actitud', 'Actitud']];
const mesDe = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
const mesParam = (params) => /^\d{4}-\d{2}$/.test(params.get('mes') || '') ? params.get('mes') + '-01' : mesDe();
const mesCorto = (mes) => mes.slice(0, 7);
const nombreMes = (mes) => capital(aFecha(mes).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
const otroMes = (mes, n) => { const d = aFecha(mes); return mesDe(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
const semanaHoy = (mes) => mes === mesDe() ? Math.min(SEMANAS, Math.ceil(new Date().getDate() / 7)) : 1;
const textoSemana = (mes, s) => { const fin = new Date(aFecha(mes).getFullYear(), aFecha(mes).getMonth() + 1, 0).getDate(); return `del ${(s - 1) * 7 + 1} al ${s === SEMANAS ? fin : s * 7}`; };
const gestionaLogros = () => S.admin || (puedeEditar('logros') && !(S.permisos.logros && S.permisos.logros.solo_propias));
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
const barra = (p) => `<div class="barra"><i style="width:${Math.min(100, p)}%"></i></div>`;
const totalEstrellas = (e) => (+e.esfuerzo || 0) + (+e.tareas || 0) + (+e.actitud || 0);
const MAX_ALUMNA = CATEG.length * 3 * SEMANAS;
function selectorMes(mes, base) {
  return `<div class="mes"><button data-ir="${base}mes=${mesCorto(otroMes(mes, -1))}" aria-label="Mes anterior">${ico('volver')}</button><h2>${nombreMes(mes)}</h2><button data-ir="${base}mes=${mesCorto(otroMes(mes, 1))}" aria-label="Mes siguiente">${ico('sig')}</button></div>`;
}
// Su ficha de profesora: id por la función del servidor (no necesita permiso de Profesoras)
async function miProfesora() {
  const id = await intentar(() => q(sb.rpc('mi_profesora')));
  return id && typeof id === 'string' ? { id, nombre: S.perfil ? S.perfil.nombre : '', perfil_id: S.usuario.id } : null;
}

async function pantallaLogros(params) {
  if (!puedeVer('logros')) return sinPermiso();
  const mes = mesParam(params), gestiona = gestionaLogros();
  const [retos, meses, yo] = await Promise.all([
    q(sb.from('logros_retos').select('id,titulo').eq('mes', mes).order('creado_en')),
    q(sb.from('logros_meses').select('recompensa').eq('mes', mes)),
    gestiona ? null : miProfesora()
  ]);
  const recompensa = meses[0] ? meses[0].recompensa || '' : '';
  const cumplidos = retos.length ? await q(sb.from('logros_cumplidos').select('reto_id,profesora_id,semana,marcado_por').in('reto_id', retos.map((r) => r.id))) : [];
  // La profesora marca "Hecho" el reto de esta semana desde aquí (a la administración le llega el aviso)
  const marca = !gestiona && yo && puedeEditar('logros') && mes === mesDe(), sHoy = semanaHoy(mes);
  const hechoYo = (rid) => cumplidos.find((c) => c.reto_id === rid && c.profesora_id === (yo && yo.id) && c.semana === sHoy);
  const botonHecho = (r) => { const h = hechoYo(r.id), mio = h && h.marcado_por === S.usuario.id;
    return `<button class="btn-hecho ${h ? 'on' : ''}" data-hecho="${r.id}" ${h && !mio ? 'disabled' : ''} aria-pressed="${!!h}">${h ? '✓ Hecho' : 'Hecho'}</button>`; };
  const profesoras = gestiona ? await q(sb.from('profesoras').select('id,nombre').eq('activa', true).order('nombre')) : (yo ? [yo] : []);
  const posibles = retos.length * SEMANAS;
  const tarjetaProfe = (p) => {
    const n = cumplidos.filter((c) => c.profesora_id === p.id).length, v = pct(n, posibles);
    return `<a class="tarjeta-clase" href="#/logros/profesora/${p.id}?mes=${mesCorto(mes)}">
      <div class="tc-cab"><h2>${esc(p.nombre)}</h2><span class="contador ${v >= 100 ? 'oro' : ''}">${v}%</span></div>
      ${barra(v)}<div class="tc-pie"><span>${n} de ${posibles} conseguidos</span>${ico('sig', 18)}</div></a>`;
  };
  // Clases para puntuar a las alumnas (a una profesora con "solo lo suyo" solo le llegan las suyas)
  const clases = await intentar(() => q(sb.from('clases').select('id,nombre,inscripciones(alumna_id,fecha_baja),' + SEL_HOR).eq('activa', true).is('escuela_amiga_id', null)));
  clases.sort((a, b) => ordenClase(a) - ordenClase(b));
  const estrellas = clases.length ? await intentar(() => q(sb.from('logros_estrellas').select('clase_id,esfuerzo,tareas,actitud').eq('mes', mes))) : [];
  const tarjetaClase = (c) => {
    const n = (c.inscripciones || []).filter((i) => !i.fecha_baja).length;
    const v = pct(estrellas.filter((e) => e.clase_id === c.id).reduce((a, e) => a + totalEstrellas(e), 0), n * MAX_ALUMNA);
    return `<a class="tarjeta-clase" href="#/logros/clase/${c.id}?mes=${mesCorto(mes)}">
      <div class="tc-cab"><h2>${esc(c.nombre)}</h2><span class="contador">${n}</span></div>
      <div class="tc-hor">${ico('clases', 16)} ${esc(textoHorario(c))}</div>
      ${barra(v)}<div class="tc-pie"><span>Media de la clase: ${v}%</span>${ico('sig', 18)}</div></a>`;
  };
  pintar(cabecera('Logros', { volver: volverDe('logros'), sub: 'Retos de profesoras y estrellas de alumnas' }) + `<main class="cont">
    ${selectorMes(mes, '#/logros?')}
    <div class="tarjeta-caja"><span class="ico-caja">${ico('evento', 26)}</span><span class="txt"><b>Recompensa del mes</b>
      ${gestiona ? `<input id="recompensa" class="input-oro" placeholder="Ej.: entrada a un taller" value="${esc(recompensa)}">` : `<span>${esc(recompensa || 'Aún sin decidir')}</span>`}</span></div>
    <div class="seccion">Retos del mes (${retos.length}/${MAX_RETOS})</div>
    <div class="lista">${retos.map((r, i) => `<div class="fila"><span class="ini">${i + 1}</span><span class="txt"><div class="tit envolver">${esc(r.titulo)}</div></span>
      ${gestiona ? `<button class="quitar-r" data-quitar="${r.id}" aria-label="Quitar reto">Quitar</button>` : marca ? botonHecho(r) : ''}</div>`).join('') || vacio(gestiona ? 'Aún no hay retos este mes. Añade de 1 a 5.' : 'Aún no hay retos este mes.')}</div>
    ${gestiona && retos.length < MAX_RETOS ? `<a class="btn sec" href="#/logros/reto?mes=${mesCorto(mes)}">${ico('mas')} Añadir reto</a>` : ''}
    ${retos.length ? `<p class="nota">${marca ? `Toca <b>Hecho</b> cuando cumplas un reto esta semana (semana ${sHoy}, ${textoSemana(mes, sHoy)}). Se suma al momento y la administración lo revisa.` : 'Cada reto se marca por semana (4 semanas). Todos valen lo mismo.'}</p>` : ''}
    <div class="seccion">${gestiona ? 'Profesoras' : 'Mi progreso'}</div>
    <div class="lista">${profesoras.map(tarjetaProfe).join('') || vacio(gestiona ? 'No hay profesoras activas.' : 'Tu usuario aún no está enlazado con tu ficha de profesora. Pídeselo a la administración.')}</div>
    <div class="seccion">Estrellas de alumnas</div>
    <div class="lista">${clases.map(tarjetaClase).join('') || vacio('No hay clases.')}</div>
  </main>`, 'mas');
  const rec = document.getElementById('recompensa');
  if (rec) rec.onchange = async () => {
    try { await q(sb.from('logros_meses').upsert({ mes, recompensa: rec.value.trim() || null })); aviso('Recompensa guardada'); } catch (e) { aviso(traducirError(e), true); }
  };
  $app.querySelectorAll('[data-hecho]').forEach((b) => b.onclick = async () => {
    const on = b.classList.contains('on'); b.disabled = true;
    try {
      if (on) await q(sb.from('logros_cumplidos').delete().eq('reto_id', b.dataset.hecho).eq('profesora_id', yo.id).eq('semana', sHoy));
      else await q(sb.from('logros_cumplidos').insert({ reto_id: b.dataset.hecho, profesora_id: yo.id, semana: sHoy }));
      aviso(on ? 'Quitado' : '¡Hecho! 🎉'); router();
    } catch (e) { aviso(traducirError(e), true); b.disabled = false; }
  });
  $app.querySelectorAll('[data-quitar]').forEach((b) => b.onclick = async () => {
    if (!confirm('¿Quitar este reto del mes? Se perderá lo marcado en él.')) return;
    try { await q(sb.from('logros_retos').delete().eq('id', b.dataset.quitar)); aviso('Reto quitado'); router(); } catch (e) { aviso(traducirError(e), true); }
  });
}

async function formReto(params) {
  if (!gestionaLogros()) return sinPermiso();
  const mes = mesParam(params);
  const [plantillas, retos] = await Promise.all([
    q(sb.from('logros_plantillas').select('id,titulo').eq('activa', true).order('creado_en')),
    q(sb.from('logros_retos').select('titulo').eq('mes', mes))
  ]);
  const usados = new Set(retos.map((r) => r.titulo));
  const libres = plantillas.filter((p) => !usados.has(p.titulo));
  const volver = `#/logros?mes=${mesCorto(mes)}`;
  pintar(cabecera('Añadir reto', { volver, sub: nombreMes(mes) + ` · ${retos.length}/${MAX_RETOS}` }) + `<main class="cont">
    ${retos.length >= MAX_RETOS ? vacio('Este mes ya tiene 5 retos, que es el máximo.') : `
    ${libres.length ? `<div class="seccion">Retos fijos (un toque y listo)</div>
      <div class="lista">${libres.map((p) => `<button class="fila fila-btn" data-plantilla="${esc(p.titulo)}"><span class="ini">${ico('evento', 18)}</span><span class="txt"><div class="tit envolver">${esc(p.titulo)}</div></span>${ico('mas')}</button>`).join('')}</div>` : ''}
    <div class="seccion">O escribe uno nuevo</div>
    <form class="form" id="f">
      <div class="campo"><label for="titulo">Reto</label><input id="titulo" maxlength="120" placeholder="Ej.: Trae una idea de coreografía" required></div>
      <label class="check"><input type="checkbox" id="fijo"><span><b>Guardarlo también como reto fijo</b><br><span class="nota">Así lo tendrás a mano otros meses.</span></span></label>
      <button class="btn pri" type="submit">${ico('mas')} Añadir al mes</button>
    </form>`}
  </main>`, 'mas');
  const anadir = async (titulo, fijo) => {
    try {
      await q(sb.from('logros_retos').insert({ mes, titulo }));
      if (fijo && !plantillas.some((p) => p.titulo === titulo)) await intentar(() => q(sb.from('logros_plantillas').insert({ titulo })));
      aviso('Reto añadido'); location.hash = volver;
    } catch (e) { aviso(/Máximo 5/.test(e.message || '') ? 'Este mes ya tiene 5 retos, que es el máximo.' : traducirError(e), true); }
  };
  $app.querySelectorAll('[data-plantilla]').forEach((b) => b.onclick = () => { b.disabled = true; anadir(b.dataset.plantilla, false); });
  const f = document.getElementById('f');
  if (f) f.onsubmit = (ev) => { ev.preventDefault(); const t = document.getElementById('titulo').value.trim(); if (t) anadir(t, document.getElementById('fijo').checked); };
}

async function pantallaLogrosProfesora(id, params) {
  if (!puedeVer('logros')) return sinPermiso();
  const mes = mesParam(params), gestiona = gestionaLogros();
  const [p0, retos, yo] = await Promise.all([
    gestiona ? q(sb.from('profesoras').select('id,nombre,perfil_id').eq('id', id).single()) : null,
    q(sb.from('logros_retos').select('id,titulo').eq('mes', mes).order('creado_en')),
    gestiona ? null : miProfesora()
  ]);
  const prof = p0 || (yo && yo.id === id ? yo : null);
  if (!prof) return sinPermiso();
  const cumplidos = retos.length ? await q(sb.from('logros_cumplidos').select('reto_id,semana,marcado_por').eq('profesora_id', id).in('reto_id', retos.map((r) => r.id))) : [];
  const hecho = new Set(cumplidos.map((c) => c.reto_id + '|' + c.semana));
  // Lo que marcó ella misma (la administración lo ve con un punto para comprobarlo)
  const suyo = new Set(cumplidos.filter((c) => c.marcado_por && c.marcado_por === prof.perfil_id).map((c) => c.reto_id + '|' + c.semana));
  const propia = !gestiona && yo && yo.id === id && puedeEditar('logros');
  const posibles = retos.length * SEMANAS, sHoy = semanaHoy(mes), enCurso = mes === mesDe();
  // La profesora marca el mes en curso hasta la semana de hoy, y solo deshace lo que marcó ella
  const tocable = (r, s) => gestiona || (propia && enCurso && s <= sHoy && (!hecho.has(r + '|' + s) || suyo.has(r + '|' + s)));
  const pintarPct = () => { const v = pct(hecho.size, posibles); document.getElementById('pct').textContent = v + '%'; document.querySelector('.tarjeta .barra i').style.width = Math.min(100, v) + '%'; document.getElementById('cuenta').textContent = `${hecho.size} de ${posibles} conseguidos`; };
  pintar(cabecera(propia ? 'Mis logros' : prof.nombre, { volver: propia ? '#/inicio' : `#/logros?mes=${mesCorto(mes)}`, sub: 'Logros · ' + nombreMes(mes) }) + `<main class="cont">
    ${selectorMes(mes, `#/logros/profesora/${id}?`)}
    <div class="tarjeta"><div class="tc-cab" style="display:flex;justify-content:space-between;align-items:center"><h2>Progreso del mes</h2><span class="contador" id="pct">0%</span></div>
      ${barra(0)}<div class="nota" id="cuenta"></div></div>
    ${retos.length ? retos.map((r) => `<div class="tarjeta reto"><h3>${esc(r.titulo)}</h3>
      <div class="semanas">${[1, 2, 3, 4].map((s) => { const k = r.id + '|' + s; return `<button class="${hecho.has(k) ? 'on' : ''} ${s === sHoy ? 'hoy' : ''} ${gestiona && suyo.has(k) ? 'suyo' : ''}" data-reto="${r.id}" data-s="${s}" ${tocable(r.id, s) ? '' : 'disabled'} aria-pressed="${hecho.has(k)}" title="Semana ${s}: ${textoSemana(mes, s)}">${ico('evento', 16)}<span>Sem. ${s}</span></button>`; }).join('')}</div></div>`).join('')
      : vacio('Aún no hay retos este mes.')}
    ${gestiona && retos.length ? `<p class="nota">Toca una semana para marcarla como conseguida. Vuelve a tocar para quitarla.${suyo.size ? ' <span class="punto-suyo"></span> = lo marcó ella; compruébalo y quítalo si no es cierto.' : ''}</p>` : ''}
    ${propia && retos.length && enCurso ? '<p class="nota">¿Lo has hecho? Toca la semana y se suma al momento. La administración lo revisa. Si te equivocas, vuelve a tocar para quitarlo.</p>' : ''}
  </main>`, propia ? 'inicio' : 'mas');
  pintarPct();
  $app.querySelectorAll('[data-reto]').forEach((b) => b.onclick = async () => {
    const k = b.dataset.reto + '|' + b.dataset.s, on = hecho.has(k);
    b.disabled = true;
    try {
      if (on) await q(sb.from('logros_cumplidos').delete().eq('reto_id', b.dataset.reto).eq('profesora_id', id).eq('semana', b.dataset.s));
      else await q(sb.from('logros_cumplidos').insert({ reto_id: b.dataset.reto, profesora_id: id, semana: +b.dataset.s }));
      on ? (hecho.delete(k), suyo.delete(k)) : (hecho.add(k), !gestiona && suyo.add(k));
      b.classList.toggle('on', !on); b.classList.remove('suyo'); b.setAttribute('aria-pressed', !on); pintarPct();
      if (!on && !gestiona) aviso('¡Sumado! 🎉');
    } catch (e) { aviso(traducirError(e), true); }
    b.disabled = !tocable(b.dataset.reto, +b.dataset.s);
  });
}

async function pantallaLogrosClase(id, params) {
  if (!puedeVer('logros')) return sinPermiso();
  const mes = mesParam(params), semana = Math.min(SEMANAS, Math.max(1, +params.get('s') || semanaHoy(mes)));
  const puede = puedeEditar('logros');
  const [c, est] = await Promise.all([
    q(sb.from('clases').select('id,nombre,inscripciones(fecha_baja,alumnas(id,nombre,apellidos))').eq('id', id).single()),
    q(sb.from('logros_estrellas').select('alumna_id,semana,esfuerzo,tareas,actitud').eq('clase_id', id).eq('mes', mes))
  ]);
  const alumnas = (c.inscripciones || []).filter((i) => !i.fecha_baja && i.alumnas).map((i) => i.alumnas)
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  const de = (aid, s) => est.find((e) => e.alumna_id === aid && +e.semana === s) || { alumna_id: aid, semana: s, esfuerzo: 0, tareas: 0, actitud: 0 };
  const totalMes = (aid) => est.filter((e) => e.alumna_id === aid).reduce((a, e) => a + totalEstrellas(e), 0);
  const base = `#/logros/clase/${id}?mes=${mesCorto(mes)}&`;
  const ranking = alumnas.map((a) => ({ a, t: totalMes(a.id) })).sort((x, y) => y.t - x.t).filter((x) => x.t > 0).slice(0, 3);
  const estrellasHtml = (a, k) => { const v = +de(a.id, semana)[k] || 0;
    return [1, 2, 3].map((n) => `<button class="est ${n <= v ? 'on' : ''}" data-a="${a.id}" data-k="${k}" data-n="${n}" ${puede ? '' : 'disabled'} aria-label="${n} estrella${n > 1 ? 's' : ''}"><svg width="26" height="26" viewBox="0 0 24 24"><polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"/></svg></button>`).join(''); };
  pintar(cabecera(c.nombre, { volver: `#/logros?mes=${mesCorto(mes)}`, sub: 'Estrellas · ' + nombreMes(mes) }) + `<main class="cont">
    <div class="filtros">${[1, 2, 3, 4].map((s) => `<button data-ir="${base}s=${s}" class="${s === semana ? 'on' : ''}">Sem. ${s}</button>`).join('')}</div>
    <p class="nota" style="margin:-4px 2px 0">Semana ${semana}: ${textoSemana(mes, semana)} de ${aFecha(mes).toLocaleDateString('es-ES', { month: 'long' })}. De 1 a 3 estrellas en cada apartado.</p>
    ${ranking.length ? `<div class="tarjeta"><h3>Las que más brillan este mes</h3><div class="podio">${ranking.map((x, i) => `<div><span class="medalla m${i + 1}">${i + 1}</span><b>${esc(x.a.nombre)}</b><span>${pct(x.t, MAX_ALUMNA)}%</span></div>`).join('')}</div></div>` : ''}
    ${alumnas.map((a) => `<div class="tarjeta puntuar" data-al="${a.id}">
      <div class="p-cab"><b>${esc(a.nombre)} ${esc(a.apellidos || '')}</b><span class="chip mor" data-pct="${a.id}">${pct(totalMes(a.id), MAX_ALUMNA)}% del mes</span></div>
      ${CATEG.map(([k, t]) => `<div class="p-fila"><span>${t}</span><div class="estrellas">${estrellasHtml(a, k)}</div></div>`).join('')}
    </div>`).join('') || vacio('No hay alumnas inscritas en esta clase.')}
  </main>`, 'mas');
  $app.querySelectorAll('.est').forEach((b) => b.onclick = async () => {
    const aid = b.dataset.a, k = b.dataset.k, n = +b.dataset.n;
    const fila = de(aid, semana), nuevo = +fila[k] === n ? n - 1 : n;   // tocar la última estrella encendida la apaga
    const datos = { alumna_id: aid, clase_id: id, mes, semana, esfuerzo: +fila.esfuerzo || 0, tareas: +fila.tareas || 0, actitud: +fila.actitud || 0, [k]: nuevo, modificado_en: new Date().toISOString() };
    try {
      await q(sb.from('logros_estrellas').upsert(datos, { onConflict: 'alumna_id,clase_id,mes,semana' }));
      const i = est.indexOf(fila); if (i >= 0) est[i] = datos; else est.push(datos);
      b.parentElement.querySelectorAll('.est').forEach((x) => x.classList.toggle('on', +x.dataset.n <= nuevo));
      $app.querySelector(`[data-pct="${aid}"]`).textContent = pct(totalMes(aid), MAX_ALUMNA) + '% del mes';
    } catch (e) { aviso(traducirError(e), true); }
  });
}

/* ======================================================================
   ENRUTADOR
   ====================================================================== */
async function router() {
  const qs = new URLSearchParams(location.search);
  if (qs.get('f')) return formularioPublico(qs.get('f'));
  if (!S.usuario) return pantallaLogin();
  // Si la administración cambia los permisos, se notan al moverse por la app (sin cerrar sesión)
  if (Date.now() - (S.cargadoEn || 0) > 15000) { try { await cargarSesion(); } catch (e) { console.error(e); } if (!S.usuario) return pantallaLogin(); }
  if (S.usuario.user_metadata && S.usuario.user_metadata.cambiar_clave) return pantallaNuevaClave();
  const [ruta, query] = (location.hash.replace(/^#\/?/, '') || 'inicio').split('?');
  const params = new URLSearchParams(query || '');
  const p = ruta.split('/');
  try {
    switch (p[0]) {
      case 'inicio': return await pantallaInicio();
      case 'mas': return pantallaMas();
      case 'avisos': return await pantallaAvisos();
      case 'aviso': return await formAviso();
      case 'documentos': return await pantallaDocumentos(params);
      case 'documento': return p[1] === 'nuevo' ? await formDocumento() : await pantallaDocumento(p[1]);
      case 'mis-datos': return await pantallaMisDatos();
      case 'datos':
        if (!p[1]) return await pantallaDatosEquipo();
        if (p[1] === 'e') return p[3] === 'editar' ? await formDatos(null, p[2]) : await pantallaDatos(null, p[2]);
        return p[2] === 'editar' ? await formDatos(p[1]) : await pantallaDatos(p[1]);
      case 'nueva-clave': return pantallaNuevaClave();
      case 'clases': return await pantallaClases(params);
      case 'clase':
        if (p[1] === 'nueva') return await formClase(null);
        if (p[2] === 'editar') return await formClase(p[1]);
        return await pantallaClase(p[1]);
      case 'alumnas': return await pantallaAlumnas(params);
      case 'alumna':
        if (p[1] === 'nueva') return await pantallaForm({ titulo: 'Nueva alumna', tabla: 'alumnas', modulo: 'alumnas', campos: CAMPOS_ALUMNA, volver: '#/alumnas', despues: (r) => `#/alumna/${r.id}` });
        if (p[2] === 'editar') return await pantallaForm({ titulo: 'Editar alumna', tabla: 'alumnas', modulo: 'alumnas', id: p[1], campos: CAMPOS_ALUMNA, volver: `#/alumna/${p[1]}` });
        return await pantallaAlumna(p[1]);
      case 'inscripciones': return await pantallaInscripciones();
      case 'inscripcion': return p[1] && p[1] !== 'nueva' ? await formFechasInscripcion(p[1], params) : await formInscripcion(params);
      case 'horas': return await pantallaHoras(params);
      case 'caja':
        if (p[1] === 'dia') return await pantallaCajaDia(p[2], params);
        if (p[1] === 'nuevo') return await formCaja(params);
        if (p[1] === 'cambio') return await formCambio(params);
        if (p[1] === 'festivo') return await formFestivo(params);
        if (p[2] === 'editar') return await formCaja(params, p[1]);
        return await pantallaCaja(params);
      case 'iniciativas': return await pantallaIniciativas(params);
      case 'iniciativa': return p[1] === 'nueva' ? await formIniciativa(params) : await pantallaIniciativa(p[1]);
      case 'incidencias': return await pantallaIncidencias(params);
      case 'incidencia': return await formIncidencia(p[1] === 'nueva' ? null : p[1]);
      case 'normas': return await pantallaNormas(params);
      case 'norma': return await formNorma(p[1] === 'nueva' ? null : p[1]);
      case 'profesoras': return await pantallaProfesoras();
      case 'profesora': return await formProfesora(p[1] === 'nueva' ? null : p[1]);
      case 'eventos': return await pantallaEventos(params);
      case 'reserva': return await formReserva(params);
      case 'articulo': return await formArticulo(params, p[1] === 'nuevo' ? null : p[1]);
      case 'evento':
        if (p[1] === 'nuevo') return await formEvento(null, params);
        if (p[2] === 'editar') return await formEvento(p[1]);
        return await pantallaEvento(p[1]);
      case 'escuelas': return await pantallaEscuelas();
      case 'escuela':
        if (p[1] === 'nueva') return await formEscuela(null);
        if (p[2] === 'editar') return await formEscuela(p[1]);
        if (p[2] === 'clase') return await formClaseExterna(p[1], p[3] === 'nueva' ? null : p[3]);
        if (p[2] === 'nota') return await formNotaEscuela(p[1]);
        return await pantallaEscuela(p[1]);
      case 'coincidencias': return await pantallaCoincidencias();
      case 'coincidencia': return await formCoincidencia(params);
      case 'formularios': return await pantallaFormularios();
      case 'formulario':
        if (p[1] === 'nuevo') return await formFormulario(null);
        if (p[2] === 'editar') return await formFormulario(p[1]);
        return await pantallaFormulario(p[1]);
      case 'respuesta': return await pantallaRespuesta(p[1]);
      case 'equipo': return await pantallaEquipo();
      case 'acceso': return await formAcceso(params);
      case 'permisos': return await pantallaPermisos(params);
      case 'vista': return await pantallaVista(p[1]);
      case 'logros':
        if (p[1] === 'reto') return await formReto(params);
        if (p[1] === 'profesora') return await pantallaLogrosProfesora(p[2], params);
        if (p[1] === 'clase') return await pantallaLogrosClase(p[2], params);
        return await pantallaLogros(params);
      default: location.hash = '#/inicio';
    }
  } catch (e) {
    console.error(e);
    pintar(cabecera('Algo ha fallado', { volver: '#/inicio' }) + `<main class="cont">${vacio(esc(traducirError(e)))}<button class="btn sec" data-ir="${esc(location.hash)}">Reintentar</button></main>`, 'inicio');
  }
}

/* Clics en botones con data-ir / data-volver */
document.addEventListener('click', (ev) => {
  const ir = ev.target.closest('[data-ir]');
  if (ir) { ev.preventDefault(); const h = ir.dataset.ir; if (location.hash === h) router(); else location.hash = h; return; }
  const v = ev.target.closest('[data-volver]');
  if (v) { ev.preventDefault(); location.hash = v.dataset.volver; }
});
// Al volver a la app (otra pestaña, móvil desbloqueado) se recargan los permisos por si han cambiado; la pantalla no se toca para no perder lo que se esté escribiendo
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.usuario && Date.now() - (S.cargadoEn || 0) > 15000) cargarSesion().catch(console.error); });
window.addEventListener('hashchange', () => { document.getElementById('aviso').className = ''; router(); });

sb.auth.onAuthStateChange((evento) => {
  if (evento === 'PASSWORD_RECOVERY') { location.hash = '#/nueva-clave'; }
  if (evento === 'SIGNED_OUT') { S.usuario = null; S.perfil = null; S.permisos = {}; S.admin = false; }
});

(async () => {
  try { await cargarSesion(); } catch (e) { console.error(e); }
  router();
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
