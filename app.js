/* Academia Blackstars · app de gestión (PWA)
   Una sola página: el contenido cambia según la dirección (#/alumnas, #/caja...). */
'use strict';

const sb = supabase.createClient(window.BS_CONFIG.url, window.BS_CONFIG.key, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const $app = document.getElementById('app');
const S = { usuario: null, perfil: null, permisos: {}, admin: false, nombres: {} };

const MODULOS = [
  ['alumnas', 'Alumnas'], ['profesoras', 'Profesoras'], ['clases', 'Clases'],
  ['inscripciones', 'Inscripciones'], ['incidencias', 'Incidencias'], ['normas', 'Normas'],
  ['caja', 'Caja'], ['eventos', 'Eventos'], ['formularios', 'Formularios'],
  ['escuelas_amigas', 'Escuelas amigas']
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
const iniciales = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
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
    volver: '<path d="M15 5l-7 7 7 7"/>', sig: '<path d="M9 5l7 7-7 7"/>', mas: '<path d="M12 5v14M5 12h14"/>',
    casa: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>', clases: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    alumnas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 6 4.8"/>',
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
    euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/>'
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
  if (/exclusion|conflicting key value violates exclusion/i.test(m)) return 'La sala ya está ocupada ese día a esa hora por otra clase.';
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer esto.';
  if (/inscripcion_activa_unica|duplicate key/i.test(m)) return 'Ese registro ya existe.';
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/hora_fin|check constraint/i.test(m)) return 'Revisa los datos: hay algún valor no válido (por ejemplo, la hora de fin antes que la de inicio).';
  if (/foreign key/i.test(m)) return 'No se puede: hay otros datos que dependen de este registro.';
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
const puedeEditar = (m) => S.admin || !!(S.permisos[m] && S.permisos[m].puede_escribir);

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
  if (S.admin) {
    const ps = await q(sb.from('perfiles').select('id,nombre'));
    S.nombres = {}; ps.forEach((p) => { S.nombres[p.id] = p.nombre; });
  }
}

/* ---------- plantilla de pantalla ---------- */
function cabecera(titulo, { sub = '', volver = null } = {}) {
  const izq = volver
    ? `<button class="volver" data-volver="${esc(volver)}" aria-label="Volver">${ico('volver')}</button>`
    : `<img class="logo" src="icons/logo.png" alt="Blackstars">`;
  const rol = S.admin ? 'Admin' : (S.perfil ? esc(S.perfil.nombre) : '');
  return `<header class="cab">${izq}<div class="t"><div class="sup">Academia Blackstars</div><h1>${esc(titulo)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${rol ? `<span class="insignia">${rol}</span>` : ''}</header>`;
}
function navegacion(activa) {
  const items = [['inicio', 'Inicio', 'casa', null], ['clases', 'Clases', 'clases', 'clases'], ['alumnas', 'Alumnas', 'alumnas', 'alumnas'], ['caja', 'Caja', 'caja', 'caja'], ['mas', 'Más', 'puntos', null]];
  return `<nav class="nav" aria-label="Navegación">${items.filter((i) => !i[3] || puedeVer(i[3])).map((i) => `<a href="#/${i[0]}" class="${activa === i[0] ? 'on' : ''}">${ico(i[2], 22)}${i[1]}</a>`).join('')}</nav>`;
}
function pintar(html, nav = null, botonMas = null) {
  $app.innerHTML = html + (botonMas ? `<button class="mas-flotante" aria-label="Añadir" data-ir="${esc(botonMas)}">${ico('mas', 26)}</button>` : '') + (nav !== false ? navegacion(nav) : '');
  window.scrollTo(0, 0);
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
    if (c.tipo === 'bool') { out[c.k] = form.elements[c.k].checked; return; }
    let v = fd.get(c.k); v = v == null ? '' : String(v).trim();
    if (v === '') out[c.k] = null;
    else if (c.tipo === 'numero' || c.tipo === 'dinero') out[c.k] = Number(v.replace(',', '.'));
    else out[c.k] = v;
  });
  return out;
}

/* Pantalla de alta / edición reutilizable */
async function pantallaForm({ titulo, tabla, modulo, campos, id = null, volver, despues, valoresIniciales = {}, transformar = (d) => d }) {
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
  pintar(cabecera('Nueva contraseña', { volver: '#/inicio' }) + `<main class="cont"><form class="form tarjeta" id="frm">
    <div class="campo"><label for="pw">Nueva contraseña</label><input id="pw" type="password" minlength="8" autocomplete="new-password" required><div class="ayuda">Mínimo 8 caracteres.</div></div>
    <button class="btn pri ancho">Guardar</button></form></main>`, false);
  document.getElementById('frm').onsubmit = async (ev) => {
    ev.preventDefault();
    const { error } = await sb.auth.updateUser({ password: ev.target.pw.value });
    if (error) aviso(traducirError(error), true); else { aviso('Contraseña cambiada'); location.hash = '#/inicio'; }
  };
}

/* ---------- inicio ---------- */
async function pantallaInicio() {
  const hoy = hoyISO(), dia = diaISO();
  const profesora = !S.admin && Object.values(S.permisos).some((p) => p.solo_propias);
  // Todas las clases activas propias (a una profesora con "solo lo suyo" la base de datos solo le da las suyas).
  const clases = puedeVer('clases') ? await intentar(() => q(sb.from('clases')
    .select('id,nombre,profesoras(nombre),inscripciones(count),' + SEL_HOR)
    .eq('activa', true).is('escuela_amiga_id', null))) : [];
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
    return `<a class="clase-hero" href="#/clase/${c.id}">
    <svg class="estrella" width="96" height="96" viewBox="0 0 24 24"><polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6" fill="#fff"/></svg>
    <div class="k"><span>${i === 0 ? 'Próxima clase · ' : ''}${cuando(c)}</span><span class="hora">${c._h ? hora(c._h.hora_inicio) : ''}</span></div>
    <h2>${esc(c.nombre)}</h2>
    <div class="d">${[esc(textoHorario(c)), c.profesoras ? 'Prof. ' + esc(c.profesoras.nombre) : '', alumnas + (alumnas === 1 ? ' alumna' : ' alumnas')].filter(Boolean).join(' · ')}</div>
    ${n > 1 ? `<button class="sig-clase" data-sig="${i}" aria-label="Siguiente clase">${ico('sig', 22)}</button>` : ''}</a>`;
  }).join('');
  const bloqueClases = !puedeVer('clases') ? '' : n
    ? `<div class="slider"><div class="carrusel uno" id="carrusel">${tarjetas}</div>${n > 1 ? `<div class="puntos-slider" id="puntos">${clases.map((c, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>`
    : `<div class="clase-hero vacia"><div class="k"><span>Clases</span></div><h2>Aún no hay clases</h2><div class="d">${puedeEditar('clases') ? 'Crea la primera y aparecerá aquí.' : 'Cuando tengas clases asignadas aparecerán aquí.'}</div>
       ${puedeEditar('clases') ? `<a class="btn-hero" href="#/clase/nueva">${ico('mas', 16)} Crear clase</a>` : ''}</div>`;
  const tarjetaCaja = puedeVer('caja') ? `<a class="tarjeta-caja" href="#/caja"><span class="ico-caja">${ico('caja', 26)}</span><span class="txt"><b>Caja</b><span>Ingresos y gastos por día</span></span>${ico('sig', 22)}</a>` : '';
  const accesos = (profesora ? [
    ['clases', '#/clases', 'clases', 'Mis clases', 'Horarios y alumnas', false],
    ['alumnas', '#/alumnas', 'alumnas', 'Mis alumnas', 'Fichas y contacto', false],
    ['incidencias', '#/incidencia/nueva', 'alerta', 'Incidencia', 'Apuntar lo que pasa', true],
    ['eventos', '#/eventos', 'evento', 'Mis eventos', 'Próximos', false],
    ['normas', '#/normas', 'normas', 'Normas', 'Reglas de la escuela', false]
  ] : [
    ['alumnas', '#/alumna/nueva', 'insc', 'Nueva alumna', 'Dar de alta', true],
    ['caja', `#/caja/nuevo?fecha=${hoy}`, 'euro', 'Movimiento', 'Ingreso o gasto', true],
    ['incidencias', '#/incidencia/nueva', 'alerta', 'Incidencia', 'Apuntar lo que pasa', true],
    ['eventos', '#/eventos', 'evento', 'Eventos', 'Próximos', false],
    ['formularios', '#/formularios', 'form', 'Formularios', 'Enlaces por WhatsApp', false],
    ['escuelas_amigas', '#/escuelas', 'escuela', 'Escuela amiga', 'Clases y cuota', false]
  ]).filter((x) => x[5] ? puedeEditar(x[0]) : puedeVer(x[0]));
  pintar(cabecera('Inicio', { sub: capital(fechaLarga(hoy)) }) + `<main class="cont">
    ${bloqueClases}
    ${tarjetaCaja}
    ${accesos.length ? `<div class="seccion">Accesos rápidos</div><div class="accesos">${accesos.map((x) => `<a class="acceso" href="${x[1]}"><span class="ico">${ico(x[2])}</span><b>${x[3]}</b><span>${x[4]}</span></a>`).join('')}</div>` : ''}
    ${!S.admin && !Object.values(S.permisos).some((p) => p.puede_ver) ? vacio('Aún no tienes ningún módulo asignado. La administración te dará acceso.') : ''}
  </main>`, 'inicio');
  const car = document.getElementById('carrusel'), puntos = document.getElementById('puntos');
  if (car && puntos) {
    const actual = () => Math.round(car.scrollLeft / car.clientWidth);
    car.addEventListener('scroll', () => { const k = actual(); puntos.querySelectorAll('i').forEach((p, j) => p.classList.toggle('on', j === k)); }, { passive: true });
    car.querySelectorAll('[data-sig]').forEach((b) => b.onclick = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const k = (+b.dataset.sig + 1) % n; car.scrollTo({ left: k * car.clientWidth, behavior: 'smooth' });
    });
  }
}

/* ---------- más ---------- */
function pantallaMas() {
  const items = [
    ['eventos', '#/eventos', 'evento', 'Eventos', 'Talleres, shows y fiestas'],
    ['profesoras', '#/profesoras', 'profe', 'Profesoras', 'Equipo y clases asignadas'],
    ['incidencias', '#/incidencias', 'alerta', 'Incidencias', 'Lo que pasa en clase'],
    ['normas', '#/normas', 'normas', 'Normas', 'Reglas de la escuela'],
    ['inscripciones', '#/inscripciones', 'insc', 'Inscripciones', 'Altas y bajas en clases'],
    ['formularios', '#/formularios', 'form', 'Formularios', 'Enlaces para alumnas y respuestas'],
    ['escuelas_amigas', '#/escuelas', 'escuela', 'Escuelas amigas', 'Clases externas, cuota y coincidencias']
  ].filter((i) => puedeVer(i[0]));
  const ic = (n) => `<span class="ini">${ico(n)}</span>`;
  pintar(cabecera('Más', { sub: 'Todo lo demás, a un toque' }) + `<main class="cont">
    <div class="tarjeta" style="display:flex;gap:12px;align-items:center"><span class="ini" style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(201,165,90,0.18);color:#8F6A1C;font-weight:700">${esc(iniciales(S.perfil && S.perfil.nombre))}</span>
      <div style="flex:1"><b>${esc(S.perfil ? S.perfil.nombre : '')}</b><div style="font-size:13px;color:var(--texto2)">${S.admin ? 'Administración · acceso completo' : esc(S.usuario.email)}</div></div></div>
    <div class="lista">${items.map((i) => fila({ href: i[1], tit: i[3], det: i[4], iconoHtml: ic(i[2]), der: ico('sig') })).join('')}
    ${S.admin ? fila({ href: '#/permisos', tit: 'Permisos', det: 'Quién ve y edita qué', iconoHtml: ic('llave'), der: '<span class="chip oro">Solo admin</span>' }) : ''}
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
  const tarjetas = lista.map((c) => {
    const n = c.inscripciones && c.inscripciones[0] ? c.inscripciones[0].count : 0;
    const quien = c.escuela_amiga_id ? `${esc(c.escuelas_amigas ? c.escuelas_amigas.nombre : '')}${c.profesora_externa ? ' · ' + esc(c.profesora_externa) : ''}` : (c.profesoras ? 'Prof. ' + esc(c.profesoras.nombre) : 'Sin profesora');
    return `<a class="tarjeta-clase ${c.escuela_amiga_id ? 'externa' : ''}" href="#/clase/${c.id}">
      <div class="tc-cab"><h2>${esc(c.nombre)}</h2>${c.escuela_amiga_id ? '<span class="chip oro">Externa</span>' : `<span class="chip mor">${n} ${n === 1 ? 'alumna' : 'alumnas'}</span>`}</div>
      <div class="tc-hor">${ico('clases', 16)} ${esc(textoHorario(c))}</div>
      <div class="tc-pie"><span>${quien}</span>${ico('sig', 18)}</div></a>`;
  }).join('');
  const titulo = S.admin || !(S.permisos.clases && S.permisos.clases.solo_propias) ? 'Clases' : 'Mis clases';
  pintar(cabecera(titulo, { sub: `${lista.length} ${f === 'inactivas' ? 'inactivas' : (lista.length === 1 ? 'activa' : 'activas')}` }) + `<main class="cont">
    ${titulo === 'Clases' ? `<div class="filtros">${[['propias', 'Nuestras'], ['amigas', 'Escuela amiga'], ['inactivas', 'Inactivas']].map(([k, t]) => `<button data-ir="#/clases?f=${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}
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
    ${!c.escuela_amiga_id && puedeVer('inscripciones') ? `<div class="seccion">Alumnas (${ins.length})</div>
      <div class="lista">${ins.map((i) => fila({ href: `#/alumna/${i.alumnas.id}`, tit: `${i.alumnas.nombre} ${i.alumnas.apellidos || ''}`, det: 'Desde ' + fechaCorta(i.fecha_alta), der: i.alumnas.cuota === 'media' ? '<span class="chip oro">½ mes</span>' : '' })).join('') || vacio('Nadie inscrita todavía.')}</div>
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
  const f = params.get('f') || 'activa', claseSel = params.get('clase');
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
  const claseObj = clases.find((c) => c.id === claseSel);
  const titulo = claseSel ? (claseSel === 'sin' ? 'Sin clase' : claseObj ? claseObj.nombre : 'Clase') : 'Alumnas';
  const sub = claseSel ? `${deClase(claseSel).length} ${f === 'activa' ? 'activas' : 'de baja'}` : `${nActivas} activas · ${todas.length - nActivas} de baja`;
  pintar(cabecera(titulo, { sub, volver: claseSel ? `#/alumnas?f=${f}` : null }) + `<main class="cont">
    <div class="buscar">${ico('buscar')}<input id="buscar" type="search" placeholder="${claseSel ? 'Buscar en esta clase' : 'Buscar alumna'}" autocomplete="off"></div>
    ${claseSel ? '' : `<div class="filtros">${[['activa', 'Activas'], ['baja', 'Bajas'], ['todas', 'Todas']].map(([k, t]) => `<button data-ir="#/alumnas?f=${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>`}
    <div class="lista" id="lista"></div></main>`, 'alumnas', puedeEditar('alumnas') ? '#/alumna/nueva' : null);
  const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filaAlumna = (a) => {
    const cls = (a.inscripciones || []).filter((i) => !i.fecha_baja && i.clases).map((i) => i.clases.nombre).join(' · ');
    const chips = (a.estado === 'activa' ? '<span class="chip ok">Activa</span>' : '<span class="chip gris">Baja</span>') + (a.cuota === 'media' ? '<span class="chip oro">½ mes</span>' : '');
    return fila({ href: `#/alumna/${a.id}`, tit: `${a.nombre} ${a.apellidos || ''}`, det: esc(cls || 'Sin clase'), der: `<span class="chips">${chips}</span>` });
  };
  const tarjetaClase = (id, nombre, horario, n) => `<a class="tarjeta-clase" href="#/alumnas?f=${f}&clase=${id}">
    <div class="tc-cab"><h2>${esc(nombre)}</h2><span class="contador ${f === 'baja' ? 'gris' : ''}">${n}</span></div>
    ${horario ? `<div class="tc-hor">${ico('clases', 16)} ${esc(horario)}</div>` : ''}
    <div class="tc-pie"><span>${n === 1 ? '1 alumna' : n + ' alumnas'} ${f === 'activa' ? (n === 1 ? 'activa' : 'activas') : 'de baja'}</span>${ico('sig', 18)}</div></a>`;
  const dibujar = () => {
    const t = quitarTildes(document.getElementById('buscar').value.trim());
    const coincide = (a) => quitarTildes(`${a.nombre} ${a.apellidos || ''} ${a.telefono || ''}`).includes(t);
    let html;
    if (claseSel) html = deClase(claseSel).filter((a) => !t || coincide(a)).map(filaAlumna).join('') || vacio(t ? 'No hay coincidencias.' : 'No hay alumnas aquí.');
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
  document.getElementById('buscar').oninput = dibujar; dibujar();
}
async function pantallaAlumna(id) {
  if (!puedeVer('alumnas')) return sinPermiso();
  const a = await q(sb.from('alumnas').select('*').eq('id', id).single());
  const ins = puedeVer('inscripciones') ? await intentar(() => q(sb.from('inscripciones').select('id,fecha_alta,fecha_baja,clases(id,nombre,' + SEL_HOR + ')').eq('alumna_id', id).order('fecha_alta', { ascending: false }))) : [];
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
    ${puedeVer('inscripciones') ? `<div class="seccion">Clases</div><div class="lista">${ins.filter((i) => !i.fecha_baja).map((i) => fila({ href: `#/clase/${i.clases.id}`, tit: i.clases.nombre, det: `${esc(textoHorario(i.clases))} · desde ${fechaCorta(i.fecha_alta)}`, der: puedeEditar('inscripciones') ? `<button class="chip no" data-baja-ins="${i.id}" style="border:0;cursor:pointer;min-height:32px">Quitar</button>` : '' })).join('') || vacio('No está en ninguna clase.')}</div>
      ${ins.some((i) => i.fecha_baja) ? `<div class="seccion">Clases anteriores</div><div class="lista">${ins.filter((i) => i.fecha_baja).map((i) => fila({ href: `#/clase/${i.clases.id}`, tit: i.clases.nombre, det: `${fechaCorta(i.fecha_alta)} – ${fechaCorta(i.fecha_baja)}` })).join('')}</div>` : ''}
      ${puedeEditar('inscripciones') && a.estado === 'activa' ? `<a class="btn sec" href="#/inscripcion/nueva?alumna=${id}">${ico('mas')} Añadir a una clase</a>` : ''}` : ''}
    ${puedeEditar('alumnas') ? `<div class="botones"><a class="btn sec" href="#/alumna/${id}/editar">${ico('lapiz')} Editar</a>
      ${a.estado === 'activa' ? `<button class="btn peligro" id="baja">Dar de baja</button>` : `<button class="btn sec" id="alta">Volver a dar de alta</button>`}</div>` : ''}
    ${autorDe(a)}
  </main>`, 'alumnas');
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

/* ---------- inscripciones ---------- */
async function pantallaInscripciones() {
  if (!puedeVer('inscripciones')) return sinPermiso();
  const l = await q(sb.from('inscripciones').select('id,fecha_alta,fecha_baja,alumnas(id,nombre,apellidos),clases(nombre)').order('creado_en', { ascending: false }).limit(100));
  pintar(cabecera('Inscripciones', { volver: '#/mas', sub: 'Últimos movimientos en clases' }) + `<main class="cont"><div class="lista">${l.map((i) => fila({
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

/* ---------- caja ---------- */
async function pantallaCaja(params) {
  if (!puedeVer('caja')) return sinPermiso();
  const hoy = hoyISO();
  const mes = params.get('mes') || hoy.slice(0, 7);
  const [y, m] = mes.split('-').map(Number);
  const ini = `${mes}-01`, fin = `${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01`;
  const movs = await q(sb.from('caja').select('id,fecha,tipo,concepto,importe').gte('fecha', ini).lt('fecha', fin).order('fecha', { ascending: false }));
  const porDia = {}; let tIn = 0, tOut = 0;
  movs.forEach((x) => { (porDia[x.fecha] = porDia[x.fecha] || []).push(x); if (x.tipo === 'ingreso') tIn += +x.importe; else tOut += +x.importe; });
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`, next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const primero = (new Date(y, m - 1, 1).getDay() + 6) % 7, nDias = new Date(y, m, 0).getDate();
  let cal = DIAS_C.map((d) => `<div class="dow">${d}</div>`).join('') + '<div></div>'.repeat(primero);
  for (let d = 1; d <= nDias; d++) {
    const f = `${mes}-${pad(d)}`, l = porDia[f] || [];
    const pi = l.some((x) => x.tipo === 'ingreso'), po = l.some((x) => x.tipo === 'gasto');
    cal += `<button data-ir="#/caja/dia/${f}" class="${f === hoy ? 'hoy' : ''} ${l.length ? 'con' : ''}">${d}<span class="puntos">${pi ? '<i class="bg-in"></i>' : ''}${po ? '<i class="bg-out"></i>' : ''}</span></button>`;
  }
  const dias = Object.keys(porDia).sort().reverse().map((f) => {
    const l = porDia[f]; let i = 0, o = 0; l.forEach((x) => { if (x.tipo === 'ingreso') i += +x.importe; else o += +x.importe; });
    const d = aFecha(f);
    return fila({ href: `#/caja/dia/${f}`, ini: d.getDate(), tit: capital(d.toLocaleDateString('es-ES', { weekday: 'long' })), det: esc(l.map((x) => x.concepto).slice(0, 3).join(' · ')),
      der: `<span style="text-align:right">${i ? `<div class="in">+${eur(i)}</div>` : ''}${o ? `<div class="out">−${eur(o)}</div>` : ''}</span>` });
  }).join('');
  const titulo = capital(new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
  pintar(cabecera('Caja', { sub: 'Ingresos y gastos por día' }) + `<main class="cont">
    <div class="mes"><button data-ir="#/caja?mes=${prev}" aria-label="Mes anterior">${ico('volver')}</button><h2>${titulo}</h2><button data-ir="#/caja?mes=${next}" aria-label="Mes siguiente">${ico('sig')}</button></div>
    <div class="totales"><div><small>Ingresos</small><b class="in">${eur(tIn)}</b></div><div><small>Gastos</small><b class="out">${eur(tOut)}</b></div><div><small>Balance</small><b>${eur(tIn - tOut)}</b></div></div>
    <div class="tarjeta"><div class="calendario">${cal}</div></div>
    <div class="seccion">Días con movimientos</div><div class="lista">${dias || vacio('Sin movimientos este mes.')}</div>
  </main>`, 'caja', puedeEditar('caja') ? `#/caja/nuevo?fecha=${mes === hoy.slice(0, 7) ? hoy : ini}` : null);
}
async function pantallaCajaDia(fecha) {
  if (!puedeVer('caja')) return sinPermiso();
  const movs = await q(sb.from(S.admin ? 'caja_con_autor' : 'caja').select('*,clases(nombre),alumnas(nombre,apellidos),escuelas_amigas(nombre)').eq('fecha', fecha).order('creado_en'));
  let i = 0, o = 0; movs.forEach((x) => { if (x.tipo === 'ingreso') i += +x.importe; else o += +x.importe; });
  const met = Object.fromEntries(METODOS);
  pintar(cabecera(capital(fechaLarga(fecha)), { volver: `#/caja?mes=${fecha.slice(0, 7)}`, sub: 'Caja del día' }) + `<main class="cont">
    <div class="totales"><div><small>Ingresos</small><b class="in">${eur(i)}</b></div><div><small>Gastos</small><b class="out">${eur(o)}</b></div><div><small>Balance</small><b>${eur(i - o)}</b></div></div>
    <div class="lista">${movs.map((x) => fila({ href: puedeEditar('caja') ? `#/caja/${x.id}/editar` : `#/caja/dia/${fecha}`, ini: x.tipo === 'ingreso' ? '+' : '−', tit: x.concepto,
      det: esc([x.metodo ? met[x.metodo] : '', x.clases ? x.clases.nombre : '', x.alumnas ? x.alumnas.nombre : '', x.escuelas_amigas ? x.escuelas_amigas.nombre : '', x.registrado_por ? 'por ' + x.registrado_por : ''].filter(Boolean).join(' · ')),
      der: `<span class="${x.tipo === 'ingreso' ? 'in' : 'out'}">${x.tipo === 'ingreso' ? '+' : '−'}${eur(x.importe)}</span>` })).join('') || vacio('No hay movimientos este día.')}</div>
  </main>`, 'caja', puedeEditar('caja') ? `#/caja/nuevo?fecha=${fecha}` : null);
}
async function formCaja(params, id = null) {
  if (!puedeEditar('caja')) return sinPermiso();
  const reg = id ? await q(sb.from('caja').select('*').eq('id', id).single()) : null;
  const ini = reg || { fecha: params.get('fecha') || hoyISO(), tipo: params.get('tipo') || 'ingreso', importe: params.get('importe'), concepto: params.get('concepto'), escuela_amiga_id: params.get('escuela') };
  let tipo = ini.tipo;
  const [clases, alumnas, escuelas] = await Promise.all([
    puedeVer('clases') ? intentar(() => opcionesClases(true)) : [], puedeVer('alumnas') ? intentar(opcionesAlumnas) : [], puedeVer('escuelas_amigas') ? intentar(opcionesEscuelas) : []
  ]);
  const campos = [
    { k: 'fecha', label: 'Fecha', tipo: 'fecha', req: true },
    { k: 'concepto', label: 'Concepto', req: true, ph: 'Mensualidad Salsa, alquiler…' },
    { k: 'importe', label: 'Importe (€)', tipo: 'dinero', req: true },
    { k: 'metodo', label: 'Forma de pago', tipo: 'select', opciones: METODOS },
    ...(clases.length ? [{ k: 'clase_id', label: 'Clase (opcional)', tipo: 'select', opciones: clases }] : []),
    ...(alumnas.length ? [{ k: 'alumna_id', label: 'Alumna (opcional)', tipo: 'select', opciones: alumnas }] : []),
    ...(escuelas.length ? [{ k: 'escuela_amiga_id', label: 'Escuela amiga (opcional)', tipo: 'select', opciones: escuelas }] : [])
  ];
  const volver = `#/caja/dia/${ini.fecha}`;
  pintar(cabecera(id ? 'Editar movimiento' : 'Nuevo movimiento', { volver }) + `<main class="cont"><form class="form tarjeta" id="frm">
    <div class="tipo"><button type="button" data-t="ingreso" class="in">Ingreso</button><button type="button" data-t="gasto" class="out">Gasto</button></div>
    ${campos.map((c) => campoHtml(c, ini[c.k])).join('')}
    <button class="btn pri ancho" type="submit">Guardar</button>
    ${id && S.admin ? '<button class="btn peligro ancho" type="button" id="borrar">Borrar definitivamente</button>' : ''}
  </form>${autorDe(reg)}</main>`, false);
  const marcar = () => $app.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tipo));
  $app.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tipo = b.dataset.t; marcar(); }); marcar();
  const form = document.getElementById('frm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const datos = Object.assign(leerForm(form, campos), { tipo });
    if (!(datos.importe > 0)) { aviso('El importe tiene que ser mayor que 0', true); return; }
    try {
      if (id) await q(sb.from('caja').update(datos).eq('id', id)); else await q(sb.from('caja').insert(datos));
      aviso('Guardado'); location.hash = `#/caja/dia/${datos.fecha}`;
    } catch (e) { aviso(traducirError(e), true); }
  };
  const b = document.getElementById('borrar');
  if (b) b.onclick = async () => {
    if (!confirm('¿Borrar este movimiento? No se puede deshacer.')) return;
    try { await q(sb.from('caja').delete().eq('id', id)); aviso('Borrado'); location.hash = volver; } catch (e) { aviso(traducirError(e), true); }
  };
}

/* ---------- incidencias ---------- */
async function pantallaIncidencias(params) {
  if (!puedeVer('incidencias')) return sinPermiso();
  const f = params.get('f') || 'todas';
  let r = sb.from(S.admin ? 'incidencias_con_autor' : 'incidencias').select('*,clases(nombre),alumnas(nombre,apellidos)').order('fecha', { ascending: false }).limit(200);
  if (f === 'semana') { const d = new Date(); d.setDate(d.getDate() - 7); r = r.gte('fecha', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); }
  const l = await q(r);
  pintar(cabecera('Incidencias', { volver: '#/mas', sub: 'Lo que pasa en clase' }) + `<main class="cont">
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

/* ---------- normas ---------- */
async function pantallaNormas() {
  if (!puedeVer('normas')) return sinPermiso();
  const l = await q(sb.from('normas').select('*').order('activa', { ascending: false }).order('titulo'));
  pintar(cabecera('Normas', { volver: '#/mas', sub: 'Reglas de la escuela' }) + `<main class="cont">${l.map((n) => `<div class="tarjeta" ${n.activa ? '' : 'style="opacity:.55"'}>
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><h2>${esc(n.titulo)}</h2>${puedeEditar('normas') ? `<a href="#/norma/${n.id}" aria-label="Editar" style="color:var(--morado3)">${ico('lapiz')}</a>` : ''}</div>
    <p style="margin:8px 0 0;white-space:pre-wrap;color:var(--texto2)">${esc(n.contenido)}</p></div>`).join('') || vacio('Aún no hay normas.')}</main>`, 'mas', puedeEditar('normas') ? '#/norma/nueva' : null);
}
const formNorma = (id) => pantallaForm({
  titulo: id ? 'Editar norma' : 'Nueva norma', tabla: 'normas', modulo: 'normas', id, volver: '#/normas',
  campos: [{ k: 'titulo', label: 'Título', req: true }, { k: 'contenido', label: 'Texto', tipo: 'textarea', req: true }, { k: 'activa', label: 'Norma en vigor', tipo: 'bool', def: true }]
});

/* ---------- profesoras ---------- */
async function pantallaProfesoras() {
  if (!puedeVer('profesoras')) return sinPermiso();
  const l = await q(sb.from('profesoras').select('*,clases(count)').order('activa', { ascending: false }).order('nombre'));
  pintar(cabecera('Profesoras', { volver: '#/mas', sub: 'Equipo y clases asignadas' }) + `<main class="cont"><div class="lista">${l.map((p) => fila({
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
}

/* ---------- eventos ---------- */
async function pantallaEventos(params) {
  if (!puedeVer('eventos')) return sinPermiso();
  const f = params.get('f') || 'proximos', hoy = hoyISO();
  let r = sb.from('eventos').select('id,titulo,fecha,hora,lugar,inscripciones_evento(count)');
  r = f === 'proximos' ? r.gte('fecha', hoy).order('fecha') : r.lt('fecha', hoy).order('fecha', { ascending: false });
  const l = await q(r);
  pintar(cabecera('Eventos', { volver: '#/mas', sub: 'Talleres, shows y fiestas' }) + `<main class="cont">
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
  const coord = e.coordinadora_id && puedeVer('profesoras') ? await intentar(() => q(sb.from('profesoras').select('nombre').eq('id', e.coordinadora_id).single())) : null;
  const ed = puedeEditar('eventos');
  pintar(cabecera(e.titulo, { volver: '#/eventos', sub: capital(fechaLarga(e.fecha)) + (e.hora ? ' · ' + hora(e.hora) : '') }) + `<main class="cont">
    <div class="tarjeta"><dl class="datos">
      <dt>Lugar</dt><dd>${esc(e.lugar || '—')}</dd><dt>Coordina</dt><dd>${esc(coord && coord.nombre ? coord.nombre : '—')}</dd>
      ${e.precio_alumna != null ? `<dt>Precio</dt><dd>${eur(e.precio_alumna)}</dd>` : ''}${e.inscripcion_hasta ? `<dt>Inscripción hasta</dt><dd>${fechaCorta(e.inscripcion_hasta)}</dd>` : ''}
      ${e.descripcion ? `<dt>Descripción</dt><dd>${esc(e.descripcion)}</dd>` : ''}${e.normas ? `<dt>Normas</dt><dd>${esc(e.normas)}</dd>` : ''}${e.condiciones ? `<dt>Condiciones</dt><dd>${esc(e.condiciones)}</dd>` : ''}
    </dl></div>
    ${ed ? `<a class="btn sec" href="#/evento/${id}/editar">${ico('lapiz')} Editar evento</a>` : ''}
    <div class="seccion">Profesoras (${profs.length})</div>
    <div class="lista">${profs.map((p) => fila({ href: `#/evento/${id}`, tit: p.profesoras ? p.profesoras.nombre : '—', der: ed ? `<button class="chip no" data-quitar-prof="${p.profesora_id}" style="border:0;cursor:pointer;min-height:32px">Quitar</button>` : '' })).join('') || vacio('Sin profesoras asignadas.')}</div>
    ${ed && puedeVer('profesoras') ? `<div class="campo"><select id="addProf"><option value="">+ Añadir profesora…</option>${(await intentar(opcionesProfesoras)).filter(([pid]) => !profs.some((p) => p.profesora_id === pid)).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></div>` : ''}
    <div class="seccion">Alumnas inscritas (${ins.filter((i) => i.estado === 'inscrita').length})</div>
    <div class="lista">${ins.map((i) => fila({ href: `#/alumna/${i.alumnas.id}`, tit: `${i.alumnas.nombre} ${i.alumnas.apellidos || ''}`, der: i.estado === 'inscrita' ? (ed ? `<button class="chip ok" data-cancelar="${i.id}" style="border:0;cursor:pointer;min-height:32px">Inscrita</button>` : '<span class="chip ok">Inscrita</span>') : '<span class="chip gris">Cancelada</span>' })).join('') || vacio('Nadie inscrita todavía.')}</div>
    ${ed && puedeVer('alumnas') ? `<div class="campo"><select id="addAlu"><option value="">+ Inscribir alumna…</option>${(await intentar(opcionesAlumnas)).filter(([aid]) => !ins.some((i) => i.alumnas.id === aid)).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></div>` : ''}
    ${autorDe(e)}
  </main>`, 'mas');
  const sp = document.getElementById('addProf');
  if (sp) sp.onchange = async () => { if (!sp.value) return; try { await q(sb.from('evento_profesoras').insert({ evento_id: id, profesora_id: sp.value })); router(); } catch (er) { aviso(traducirError(er), true); } };
  const sa = document.getElementById('addAlu');
  if (sa) sa.onchange = async () => { if (!sa.value) return; try { await q(sb.from('inscripciones_evento').insert({ evento_id: id, alumna_id: sa.value })); router(); } catch (er) { aviso(traducirError(er), true); } };
  $app.querySelectorAll('[data-quitar-prof]').forEach((b) => b.onclick = async (ev) => { ev.preventDefault(); ev.stopPropagation();
    try { await q(sb.from('evento_profesoras').delete().eq('evento_id', id).eq('profesora_id', b.dataset.quitarProf)); router(); } catch (er) { aviso(traducirError(er), true); } });
  $app.querySelectorAll('[data-cancelar]').forEach((b) => b.onclick = async (ev) => { ev.preventDefault(); ev.stopPropagation();
    if (!confirm('¿Cancelar la inscripción de esta alumna?')) return;
    try { await q(sb.from('inscripciones_evento').update({ estado: 'cancelada' }).eq('id', b.dataset.cancelar)); router(); } catch (er) { aviso(traducirError(er), true); } });
}
async function formEvento(id) {
  await pantallaForm({
    titulo: id ? 'Editar evento' : 'Nuevo evento', tabla: 'eventos', modulo: 'eventos', id, volver: id ? `#/evento/${id}` : '#/eventos', despues: (r) => `#/evento/${r.id}`,
    campos: [
      { k: 'titulo', label: 'Título', req: true }, { k: 'fecha', label: 'Fecha', tipo: 'fecha', req: true }, { k: 'hora', label: 'Hora', tipo: 'hora' },
      { k: 'lugar', label: 'Lugar' }, { k: 'coordinadora_id', label: 'Coordina', tipo: 'select', opciones: puedeVer('profesoras') ? await intentar(opcionesProfesoras) : [] },
      { k: 'descripcion', label: 'Descripción', tipo: 'textarea' }, { k: 'precio_alumna', label: 'Precio por alumna (€)', tipo: 'dinero' },
      { k: 'inscripcion_hasta', label: 'Inscripción hasta', tipo: 'fecha' }, { k: 'normas', label: 'Normas del evento', tipo: 'textarea' },
      { k: 'condiciones', label: 'Condiciones (plazos, vestuario…)', tipo: 'textarea' }
    ]
  });
}

/* ---------- escuelas amigas ---------- */
async function pantallaEscuelas() {
  if (!puedeVer('escuelas_amigas')) return sinPermiso();
  const l = await q(sb.from('escuela_amiga_resumen').select('*').order('nombre'));
  pintar(cabecera('Escuelas amigas', { volver: '#/mas', sub: 'Clases externas, cuota y coincidencias' }) + `<main class="cont">
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
  pintar(cabecera('Formularios', { volver: '#/mas', sub: 'Enlaces por WhatsApp y respuestas' }) + `<main class="cont"><div class="lista">${l.map((f) => fila({
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
  const sel = params.get('p') || (perfiles[0] && perfiles[0].id);
  const p = perfiles.find((x) => x.id === sel);
  const filas = p ? await q(sb.from('permisos').select('*').eq('perfil_id', p.id)) : [];
  const per = {}; filas.forEach((f) => { per[f.modulo] = f; });
  const soloSuyo = filas.some((f) => f.solo_propias);
  const enlaceUsuarios = 'https://supabase.com/dashboard/project/cwgkmdxdvzrqtgpgqrru/auth/users';
  pintar(cabecera('Permisos', { volver: '#/mas', sub: 'Quién ve y edita qué' }) + `<main class="cont">
    ${perfiles.length ? `<div class="filtros">${perfiles.map((x) => `<button data-ir="#/permisos?p=${x.id}" class="${x.id === sel ? 'on' : ''}">${esc(x.nombre)}</button>`).join('')}</div>` : ''}
    ${p ? `<div class="tarjeta">
      <div class="perm"><span class="cab-p" style="text-align:left">Módulo</span><span class="cab-p">Ver</span><span class="cab-p">Editar</span></div>
      ${MODULOS.map(([m, t]) => { const v = per[m] && per[m].puede_ver, e = per[m] && per[m].puede_escribir;
        return `<div class="perm"><span style="font-weight:600">${t}</span><button class="${v ? 'on' : ''}" data-m="${m}" data-a="ver" aria-label="Ver ${t}" aria-pressed="${!!v}">${ico('ojo')}</button><button class="${e ? 'on' : ''}" data-m="${m}" data-a="editar" aria-label="Editar ${t}" aria-pressed="${!!e}">${ico('lapiz')}</button></div>`; }).join('')}
    </div>
    <label class="check"><input type="checkbox" id="solo" ${soloSuyo ? 'checked' : ''}><span><b>Solo ve lo suyo</b><br><span style="font-size:13px;color:var(--texto2)">Para profesoras: solo sus clases, sus alumnas, sus incidencias y sus eventos. Enlaza antes su ficha en Profesoras.</span></span></label>
    <label class="check"><input type="checkbox" id="activo" ${p.activo ? 'checked' : ''}><span><b>Acceso activo</b><br><span style="font-size:13px;color:var(--texto2)">Si lo quitas, no verá nada aunque tenga permisos.</span></span></label>
    <div class="campo"><label for="nom">Nombre que se muestra</label><input id="nom" value="${esc(p.nombre)}"></div>
    <p style="font-size:13px;color:var(--texto2);margin:0">Ojo = puede ver. Lápiz = puede editar. Quien edita un módulo también lo ve. Borrar definitivamente es solo de la administración.</p>`
    : vacio('Todavía no hay más personas. Cuando quieras dar acceso a alguien, créale un usuario y aparecerá aquí sin ningún permiso.')}
    <a class="btn sec" href="${enlaceUsuarios}" target="_blank" rel="noopener">${ico('mas')} Añadir persona (en Supabase)</a>
  </main>`, 'mas');
  if (!p) return;
  const guardar = async (m, ver, editar) => {
    const solo = document.getElementById('solo').checked;
    try {
      if (!ver && !editar) await q(sb.from('permisos').delete().eq('perfil_id', p.id).eq('modulo', m));
      else await q(sb.from('permisos').upsert({ perfil_id: p.id, modulo: m, puede_ver: ver, puede_escribir: editar, solo_propias: solo }));
      per[m] = ver || editar ? { puede_ver: ver, puede_escribir: editar } : undefined;
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
    try { await q(sb.from('permisos').update({ solo_propias: ev.target.checked }).eq('perfil_id', p.id)); aviso(ev.target.checked ? 'Ahora solo ve lo suyo' : 'Ahora ve todo lo de sus módulos'); } catch (e) { aviso(traducirError(e), true); }
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
   ENRUTADOR
   ====================================================================== */
async function router() {
  const qs = new URLSearchParams(location.search);
  if (qs.get('f')) return formularioPublico(qs.get('f'));
  if (!S.usuario) return pantallaLogin();
  const [ruta, query] = (location.hash.replace(/^#\/?/, '') || 'inicio').split('?');
  const params = new URLSearchParams(query || '');
  const p = ruta.split('/');
  try {
    switch (p[0]) {
      case 'inicio': return await pantallaInicio();
      case 'mas': return pantallaMas();
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
      case 'inscripcion': return await formInscripcion(params);
      case 'caja':
        if (p[1] === 'dia') return await pantallaCajaDia(p[2]);
        if (p[1] === 'nuevo') return await formCaja(params);
        if (p[2] === 'editar') return await formCaja(params, p[1]);
        return await pantallaCaja(params);
      case 'incidencias': return await pantallaIncidencias(params);
      case 'incidencia': return await formIncidencia(p[1] === 'nueva' ? null : p[1]);
      case 'normas': return await pantallaNormas();
      case 'norma': return await formNorma(p[1] === 'nueva' ? null : p[1]);
      case 'profesoras': return await pantallaProfesoras();
      case 'profesora': return await formProfesora(p[1] === 'nueva' ? null : p[1]);
      case 'eventos': return await pantallaEventos(params);
      case 'evento':
        if (p[1] === 'nuevo') return await formEvento(null);
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
      case 'permisos': return await pantallaPermisos(params);
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
