/*
 * Page des spectateurs (Public en live) : envoyer un mot au rappeur, chauffer la salle avec des 🔥,
 * et suivre le sort de ses mots (à l'écran, placé, pas placé).
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const MOT_VALIDE = /^[a-zàâäéèêëîïôöùûüÿçœæ][a-zàâäéèêëîïôöùûüÿçœæ'-]{1,23}$/;
  const ETATS = {
    envoi: '📨 envoyé…', file: '⏳ en file d’attente', affiche: '📺 à l’écran !', place: '✅ PLACÉ !',
    expire: '⌛ pas placé cette fois', refuse: '🚫 refusé', retire: '🚫 écarté par le rappeur', silence: '❔ pas de réponse du live'
  };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const monId = Reseau.nouveauCode(10);
  const mesMots = [];
  let canal = null, dernierEnvoi = 0, flammes = 0, minuterieFlamme = null;

  try { $('pseudo').value = localStorage.getItem('juge-impro-pseudo') || ''; } catch { /* stockage indisponible */ }
  $('pseudo').addEventListener('change', () => { try { localStorage.setItem('juge-impro-pseudo', $('pseudo').value.trim()); } catch { /* stockage indisponible */ } });

  const lireCode = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = lireCode(new URLSearchParams(location.search).get('salle'));
  if (code) entrer(code); else $('accueil').hidden = false;
  $('entrer').addEventListener('click', () => {
    const c = lireCode($('code').value);
    if (c.length < 4) return;
    history.replaceState(null, '', `?salle=${c}`);
    entrer(c);
  });

  function entrer(c) {
    $('accueil').hidden = true;
    $('salle').hidden = false;
    try {
      canal = Reseau.creerCanalPublic({
        code: c, surEvenement,
        surStatut: (st) => {
          if (st === 'SUBSCRIBED') { statut(`✅ Connecté au live · code ${c}`); canal.envoyer('bonjour', { de: monId }); }
          else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') statut('Connexion impossible : vérifie ta connexion internet.');
        }
      });
    } catch (err) { statut(err.message); }
  }
  const statut = (t) => { $('statut').textContent = t; };
  const message = (t) => { $('message').textContent = t; };

  function surEvenement(ev, x) {
    if (ev === 'etat') {
      $('mot-ecran').textContent = x.enCours ? (x.mot ? x.mot.toUpperCase() : '…') : 'pas d’impro en cours';
      $('compteurs').textContent = `${x.enCours ? `🎤 ${x.mode || 'Impro'} en cours` : '⏸️ Le rappeur se prépare'} · ${x.recus || 0} mot(s) reçu(s) · 🔥 ${x.flammes || 0}${x.file ? ` · ${x.file} en attente` : ''}`;
    } else if (ev === 'statut') {
      const m = mesMots.find((y) => y.id === x.id);
      if (!m) return;
      m.etat = x.etat;
      m.raison = x.raison || '';
      if (x.etat === 'place' && navigator.vibrate) navigator.vibrate([60, 40, 140]);
      rendre();
    }
  }

  $('form-mot').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!canal) return;
    const mot = $('mot').value.trim().toLowerCase().replace(/[’`]/g, "'");
    if (!MOT_VALIDE.test(mot)) return message('Un seul mot, en lettres (2 à 24 caractères).');
    const attente = 6000 - (Date.now() - dernierEnvoi);
    if (attente > 0) return message(`Attends ${Math.ceil(attente / 1000)} s avant ton prochain mot.`);
    dernierEnvoi = Date.now();
    const id = Reseau.nouveauCode(12);
    const m = { id, mot, etat: 'envoi', raison: '' };
    mesMots.unshift(m);
    canal.envoyer('mot', { id, de: monId, mot, pseudo: $('pseudo').value.trim().slice(0, 20) });
    // sans réponse du live au bout de 6 s, la salle est sans doute fermée
    setTimeout(() => { if (m.etat === 'envoi') { m.etat = 'silence'; rendre(); } }, 6000);
    $('mot').value = '';
    message('Envoyé ! Regarde le live 👀');
    rendre();
  });

  // les flammes partent groupées, une fois par seconde (3 au plus)
  $('flamme').addEventListener('click', () => {
    if (!canal) return;
    flammes = Math.min(3, flammes + 1);
    const b = $('flamme');
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
    if (!minuterieFlamme) minuterieFlamme = setTimeout(() => {
      canal.envoyer('flamme', { de: monId, n: flammes });
      flammes = 0;
      minuterieFlamme = null;
    }, 1000);
  });

  function rendre() {
    $('mes-mots').innerHTML = mesMots.slice(0, 12).map((m) => `<li class="${m.etat}"><b>${esc(m.mot)}</b>
      <span>${ETATS[m.etat] || ''}${m.raison ? ` · ${esc(m.raison)}` : ''}</span></li>`).join('');
  }
})();
