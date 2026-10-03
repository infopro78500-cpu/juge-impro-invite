/* Page de l'invité : rejoint la salle, reçoit l'instru, part en même temps que l'hôte, envoie ses phrases */
(function () {
  const $ = (id) => document.getElementById(id);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const scene = Scene.creer($('scene'));

  const etat = {
    liaison: null, ctx: null, gain: null, micStream: null, detecteur: null,
    decalage: null, pings: [],           // décalage d'horloge hôte − local (ms)
    config: {}, morceaux: [], recu: 0, attendu: null,
    instruBuffer: null, source: null, debutInstruCtx: 0,
    tDepartHote: null, enCours: false, reco: null, interim: '', debutSegment: null,
    snapshot: null, snapshotRecu: 0, fin: null, nomHote: 'Hôte', nom: 'Invité', actifPrecedent: null, grille: null
  };

  // ---------- Accueil ----------
  const params = new URLSearchParams(location.search);
  $('code').value = (params.get('salle') || '').toUpperCase();
  try { $('nom').value = localStorage.getItem('juge-impro-nom') || ''; } catch { /* stockage indisponible */ }
  if (!SR) erreur('Ouvre cette page dans Google Chrome ou Microsoft Edge sur ordinateur : la reconnaissance vocale n’est pas disponible dans ce navigateur.');
  // Brave expose la reconnaissance vocale mais ne la fait pas fonctionner
  else if (navigator.brave) erreur('Brave ne fait pas fonctionner la reconnaissance vocale : ouvre ce lien dans Google Chrome ou Microsoft Edge.');

  function erreur(msg) { $('erreur').hidden = !msg; $('erreur').textContent = msg || ''; }
  const statut = (texte) => { $('statut').textContent = texte; };

  $('rejoindre').addEventListener('click', rejoindre);
  $('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') rejoindre(); });
  $('nom').addEventListener('keydown', (e) => { if (e.key === 'Enter') rejoindre(); });

  async function rejoindre() {
    const code = $('code').value.trim().toUpperCase();
    etat.nom = ($('nom').value.trim() || 'Invité').slice(0, 30);
    if (!code) { erreur('Entre le code de la salle.'); return; }
    try { localStorage.setItem('juge-impro-nom', etat.nom); } catch { /* stockage indisponible */ }
    try {
      etat.ctx = new (window.AudioContext || window.webkitAudioContext)();
      etat.gain = etat.ctx.createGain();
      etat.gain.gain.value = +$('volume').value;
      etat.gain.connect(etat.ctx.destination);
      etat.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const analyseur = etat.ctx.createAnalyser();
      analyseur.fftSize = 1024;
      etat.ctx.createMediaStreamSource(etat.micStream).connect(analyseur);
      etat.detecteur = Tempo.creerDetecteurVoix(analyseur);
    } catch {
      erreur('Autorise le micro pour rejoindre (icône à gauche de l’adresse), puis réessaie.');
      return;
    }
    try {
      etat.liaison = Reseau.creerLiaison({
        role: 'invite', code, nom: etat.nom, flux: etat.micStream,
        surMessage, surBinaire, surStatut: statutLiaison, surFluxDistant
      });
    } catch (err) {
      erreur(err.message);
      return;
    }
    $('accueil').hidden = true;
    $('salle').hidden = false;
    statut('Connexion à la salle…');
    requestAnimationFrame(boucle);
  }

  function surFluxDistant(flux) {
    const lecteur = $('voix-hote');
    lecteur.srcObject = flux;
    lecteur.play().catch(() => { });
  }

  function statutLiaison(e, detail) {
    if (e === 'salle') statut(`Salle ${$('code').value.toUpperCase()} : en attente de l’hôte…`);
    else if (e === 'ouvert') { etat.nomHote = detail || 'Hôte'; statut(`✅ Connecté à ${etat.nomHote}`); synchroniserHorloge(); }
    else if (e === 'complet') statut('Cette salle a déjà un invité.');
    else if (e === 'failed') statut('Connexion directe impossible (réseau trop strict). Essaie en partage de connexion 4G.');
    else if (e === 'ferme' || e === 'disconnected') statut('Connexion perdue avec l’hôte. Recharge la page pour revenir.');
    else if (e === 'erreur-salle') statut('Impossible de joindre le serveur de salle (connexion internet ?).');
  }

  // ---------- Horloge commune ----------
  // On garde la mesure dont l'aller-retour est le plus court : c'est la plus fiable
  function synchroniserHorloge() {
    etat.pings = [];
    let n = 0;
    const t = setInterval(() => {
      etat.liaison.envoyer('ping', { tg: performance.now() });
      if (++n >= 12) clearInterval(t);
    }, 120);
  }
  const tempsSession = () => (etat.tDepartHote == null || etat.decalage == null)
    ? null : (performance.now() + etat.decalage - etat.tDepartHote) / 1000;

  // ---------- Messages de l'hôte ----------
  function surMessage(m) {
    switch (m.type) {
      case 'pong': {
        const maintenant = performance.now();
        const rtt = maintenant - m.tg;
        etat.pings.push({ rtt, decalage: m.th + rtt / 2 - maintenant });
        etat.pings.sort((a, b) => a.rtt - b.rtt);
        etat.decalage = etat.pings[0].decalage;
        break;
      }
      case 'config':
        etat.config = m;
        etat.nomHote = m.nomHote || etat.nomHote;
        majGrille();
        if (m.boite) {
          // instru générée sur place : rien à télécharger
          const st = Rythmes.STYLES[m.boite.style];
          $('statut-instru').textContent = `🥁 Boîte à rythmes · ${st ? st.nom : ''} · ${Math.round(m.boite.bpm)} BPM`;
          $('secours').hidden = true;
          etat.liaison.envoyer('instru-ok', {});
        }
        break;
      case 'instru-debut':
        etat.morceaux = []; etat.recu = 0; etat.attendu = m;
        $('statut-instru').textContent = 'Réception de l’instru… 0 %';
        break;
      case 'instru-fin': assemblerInstru(); break;
      case 'depart': depart(m); break;
      case 'etat': etat.snapshot = m; etat.snapshotRecu = performance.now(); break;
      case 'stop': arreterLocal(); break;
      case 'fin': etat.fin = { ...m.fin, niveau: null, record: false }; break;
    }
  }

  function surBinaire(morceau) {
    etat.morceaux.push(morceau);
    etat.recu += morceau.byteLength;
    if (etat.attendu && etat.morceaux.length % 16 === 0) {
      $('statut-instru').textContent = `Réception de l’instru… ${Math.round(100 * etat.recu / etat.attendu.taille)} %`;
    }
  }

  async function chargerInstru(tampon, nom) {
    etat.instruBuffer = await etat.ctx.decodeAudioData(tampon);
    $('statut-instru').textContent = `🎵 ${nom}`;
    $('secours').hidden = true;
    etat.liaison.envoyer('instru-ok', {});
  }

  async function assemblerInstru() {
    const blob = new Blob(etat.morceaux, { type: etat.attendu ? etat.attendu.typeMime : 'audio/mpeg' });
    etat.morceaux = [];
    try { await chargerInstru(await blob.arrayBuffer(), etat.attendu ? etat.attendu.nom : 'instru'); }
    catch { $('statut-instru').textContent = 'Instru reçue mais illisible.'; $('secours').hidden = false; }
  }

  $('instru-locale').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { await chargerInstru(await f.arrayBuffer(), f.name); }
    catch { $('statut-instru').textContent = 'Ce fichier audio est illisible.'; }
  });
  $('volume').addEventListener('input', (e) => { if (etat.gain) etat.gain.gain.value = +e.target.value; });
  $('format').addEventListener('change', (e) => scene.setFormat(e.target.value));
  $('plein-ecran').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $('scene-boite').requestFullscreen?.();
  });

  function majGrille() {
    etat.grille = etat.config.bpm ? Tempo.grille(etat.config.bpm, etat.config.offset || 0) : null;
  }

  // ---------- Départ synchronisé ----------
  function depart(m) {
    etat.config = { ...etat.config, ...m };
    majGrille();
    etat.tDepartHote = m.tDepart;
    etat.fin = null; etat.snapshot = null; etat.actifPrecedent = null; etat.interim = '';
    if (etat.decalage == null) etat.decalage = 0; // pas encore mesuré : on fait au mieux
    etat.ctx.resume();
    const delai = (m.tDepart - etat.decalage - performance.now()) / 1000; // en secondes
    if (m.boite) {
      if (!etat.boite) etat.boite = Rythmes.creer(etat.ctx, etat.gain);
      etat.boite.demarrer(m.boite.bpm, m.boite.style, etat.ctx.currentTime + Math.max(0, delai));
    } else if (etat.instruBuffer) {
      try { etat.source && etat.source.stop(); } catch { /* déjà arrêtée */ }
      const s = etat.ctx.createBufferSource();
      s.buffer = etat.instruBuffer;
      s.loop = m.boucle !== false;
      s.connect(etat.gain);
      const debut = etat.ctx.currentTime + Math.max(0, delai);
      const retard = Math.max(0, -delai) % etat.instruBuffer.duration; // si le message arrive en retard
      s.start(debut, retard);
      etat.source = s;
      etat.debutInstruCtx = debut - retard;
    } else {
      $('secours').hidden = false;
    }
    setTimeout(() => { etat.enCours = true; demarrerReco(); }, Math.max(0, delai * 1000));
  }

  function tempsInstru() {
    if (etat.boite && etat.boite.enCours) return etat.boite.position() - (etat.ctx.outputLatency || 0);
    if (!etat.source || !etat.instruBuffer) return null;
    const t = etat.ctx.currentTime - etat.debutInstruCtx - (etat.ctx.outputLatency || 0);
    if (t < 0) return null;
    return etat.source.loop ? t % etat.instruBuffer.duration : t;
  }

  // ---------- Reconnaissance vocale : les phrases partent chez l'hôte ----------
  function demarrerReco() {
    if (!SR) return;
    const reco = new SR();
    reco.lang = 'fr-FR';
    reco.continuous = true;
    reco.interimResults = true;
    reco.onresult = (e) => {
      const t = tempsSession();
      if (t == null) return;
      let interim = '';
      for (let k = e.resultIndex; k < e.results.length; k++) {
        const r = e.results[k];
        if (etat.debutSegment == null) etat.debutSegment = t;
        if (r.isFinal) {
          const texte = r[0].transcript.trim();
          if (texte) etat.liaison.envoyer('segment', { texte, t0: etat.debutSegment, t1: t });
          etat.debutSegment = null;
        } else interim += r[0].transcript;
      }
      etat.interim = interim;
    };
    reco.onerror = (e) => {
      if (e.error === 'not-allowed') statut('Micro refusé : autorise-le puis recharge la page.');
      else if (e.error === 'network') statut('Reconnaissance vocale indisponible : vérifie ta connexion, et utilise Chrome ou Edge (pas Brave).');
    };
    reco.onend = () => { if (etat.enCours) setTimeout(() => { try { reco.start(); } catch { /* déjà relancée */ } }, 100); };
    reco.start();
    etat.reco = reco;
  }

  function arreterLocal() {
    etat.enCours = false;
    const reco = etat.reco;
    setTimeout(() => { try { reco && reco.stop(); } catch { /* déjà arrêtée */ } }, 1200);
    // comme chez l'hôte : l'instru continue 5 s sur l'écran de fin
    const source = etat.source;
    setTimeout(() => {
      try { source && source.stop(); } catch { /* déjà arrêtée */ }
      if (etat.boite) etat.boite.arreter();
    }, 6500);
  }

  // Petit signal au changement de tour
  function bip(aigu) {
    if (!etat.ctx) return;
    const o = etat.ctx.createOscillator(), g = etat.ctx.createGain(), t = etat.ctx.currentTime;
    o.type = 'triangle';
    o.frequency.value = aigu ? 990 : 660;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(etat.ctx.destination);
    o.start(t); o.stop(t + 0.4);
  }

  // ---------- Boucle d'affichage : la même scène que chez l'hôte ----------
  function boucle() {
    const voix = etat.detecteur ? etat.detecteur(performance.now() / 1000) : { rms: 0 };
    $('niveau').style.width = Math.min(100, (voix.rms || 0) * 600) + '%';

    const tSession = tempsSession();
    const snap = etat.snapshot;
    let partie = null;
    if (snap && !etat.fin) {
      const age = (performance.now() - etat.snapshotRecu) / 1000;
      partie = {
        ...snap,
        t: snap.t + age,
        popups: snap.popups.map((x) => ({ ...x, t0: snap.t - x.age })).filter((x) => snap.t + age - x.t0 < x.duree),
        marqueurs: snap.marqueurs.map((m) => ({ ...m, t: snap.t - m.age })),
        feat: snap.feat ? { ...snap.feat, reste: Math.max(0, snap.feat.reste - age) } : null,
        attaques: [], objectifs: [], rafale: null, modeNom: 'Featuring', modeIcone: '🤝',
        paliersHype: () => Jeu.paliersHype(snap.hype), tauxPrecision: () => null
      };
      if (snap.feat && snap.feat.actif !== etat.actifPrecedent) {
        if (etat.actifPrecedent != null) { bip(false); setTimeout(() => bip(true), 120); }
        etat.actifPrecedent = snap.feat.actif;
      }
    }
    const lignes = snap ? [...(snap.lignes || [])] : [];
    if (etat.interim.trim()) lignes.push({ mots: etat.interim.trim().split(/\s+/).map((texte) => ({ texte })), interim: true });
    const avantDepart = tSession != null && tSession < 0;
    scene.dessiner({
      t: partie ? partie.t : (tSession || 0),
      enCours: Boolean(partie) && (etat.enCours || Boolean(snap)),
      partie, grille: etat.grille, tInstru: tempsInstru(), lignes,
      chrono: snap ? snap.chrono : '', chronoAlerte: snap ? snap.chronoAlerte : false,
      mode: { id: 'featuring', ...Jeu.MODES.featuring },
      consignes: [{ libelle: 'FEATURING EN LIGNE', valeur: `${etat.nomHote}  ×  ${etat.nom}`, sous: etat.liaison && etat.liaison.ouvert ? 'Connectés ✓' : 'Connexion…' }],
      fin: etat.fin,
      consigne: avantDepart ? `Départ dans ${Math.ceil(-tSession)}…` : (etat.instruBuffer || etat.config.boite ? 'Prêt : l’hôte lance la session' : 'En attente de l’instru…')
    });
    requestAnimationFrame(boucle);
  }
})();
