/*
 * Règles du jeu : modes, objectifs, combo, multiplicateur, hype du public, précision du flow, rang final.
 * Le jeu consomme les analyses (rimes / figures) et le détecteur de voix, image par image.
 */
(function (root) {
  const COMBO_RUPTURE_MOTS = 20;   // plus de 20 mots sans rime ni figure : le combo retombe
  const BLANC_S = 2.5;             // silence qui compte comme un blanc
  const FENETRE_PILE = 0.045;      // ±45 ms autour de la croche : « pile »
  const FENETRE_BIEN = 0.09;       // ±90 ms : « bien »
  const LATENCE_RECO = 0.7;        // la reconnaissance vocale rend les mots avec un peu de retard
  const GRACE_RAFALE = 2.5;        // délai de la reconnaissance vocale : un mot dit juste avant la fin compte

  const multiplicateurDe = (combo) => combo >= 10 ? 4 : combo >= 6 ? 3 : combo >= 3 ? 2 : 1;

  const PALIERS_HYPE = [
    [90, 'ÉMEUTE DANS LA SALLE', '🤯'],
    [70, 'Le public est chaud', '🔥'],
    [45, 'Ça bouge la tête', '😎'],
    [20, 'Ça écoute', '🙂'],
    [0, 'Le public décroche', '😴']
  ];
  const paliersHype = (h) => PALIERS_HYPE.find(([min]) => h >= min);

  const RANGS = [
    [0.82, 'S', '#ffcc00', 'Légendaire'],
    [0.68, 'A', '#3ddc97', 'Énorme'],
    [0.52, 'B', '#4fb3ff', 'Solide'],
    [0.38, 'C', '#c77dff', 'Correct'],
    [0, 'D', '#ff3d6e', 'À retravailler']
  ];

  // ---------- Contenus imposables ----------
  const MOTS = ['volcan', 'miroir', 'piano', 'sablier', 'boussole', 'cactus', 'satellite', 'labyrinthe', 'horloge',
    'tornade', 'aquarium', 'éclipse', 'chandelier', 'pyramide', 'origami', 'girafe', 'parachute', 'dragon', 'ascenseur',
    'trampoline', 'fantôme', 'glacier', 'papillon', 'marionnette', 'crocodile', 'météorite', 'diamant', 'échiquier',
    'phare', 'sous-marin', 'tatouage', 'escalier', 'ouragan', 'citrouille', 'robot', 'cathédrale', 'boomerang',
    'flamant', 'kangourou', 'pingouin', 'scaphandre', 'guillotine', 'parfum', 'lasso', 'igloo', 'tambour', 'comète',
    'pizza', 'vampire', 'requin', 'fusée', 'trésor', 'pirate', 'sirène', 'zombie', 'samouraï', 'jungle', 'désert'];
  const THEMES = ['La rue', 'Famille', 'Argent', 'Amour', 'Nature et cosmos', 'Spiritualité', 'Temps et mémoire',
    'Justice et prison', 'Pouvoir et egotrip', 'Émotions', 'Mort et violence', 'Rap et écriture'];
  const STYLES = {
    egotrip: { nom: 'Egotrip', consigne: 'Parle de toi, de ta force, de ton niveau' },
    storytelling: { nom: 'Storytelling', consigne: 'Raconte une histoire : des personnages, un début, une fin' },
    conscient: { nom: 'Rap conscient', consigne: 'Questionne ou dénonce la société' },
    melancolie: { nom: 'Mélancolique', consigne: 'Émotions, souvenirs, blessures' },
    clash: { nom: 'Clash', consigne: 'Attaque un adversaire imaginaire, en le tutoyant' },
    love: { nom: 'Love song', consigne: 'Parle d’amour' },
    slam: { nom: 'Slam', consigne: 'Émotion, anaphores, rythme libre porté par la voix' },
    poesie: { nom: 'Poétique', consigne: 'Images travaillées, vocabulaire lyrique' }
  };

  // Sons de fin de mot pour l'exercice « Chaîne de rimes » (codes du moteur phonétique)
  const SONS_CIBLES = [
    { cible: 'i', libelle: '[i]', exemples: 'nuit, vie, cri' }, { cible: 'e', libelle: '[é]', exemples: 'été, liberté, jamais' },
    { cible: 'A', libelle: '[an]', exemples: 'temps, sang, grand' }, { cible: 'O', libelle: '[on]', exemples: 'son, nom, raison' },
    { cible: 'u', libelle: '[ou]', exemples: 'fou, tout, debout' }, { cible: 'eR', libelle: '[èr]', exemples: 'terre, guerre, lumière' },
    { cible: 'ij', libelle: '[ille]', exemples: 'fille, famille, brille' }, { cible: 'aR', libelle: '[ar]', exemples: 'gare, art, retard' },
    { cible: 'aZ', libelle: '[age]', exemples: 'rage, page, voyage' }, { cible: 'abl', libelle: '[able]', exemples: 'table, diable, sable' },
    { cible: 'wa', libelle: '[oi]', exemples: 'moi, voix, froid' }, { cible: '2R', libelle: '[eur]', exemples: 'peur, cœur, douleur' }
  ];
  // Consonnes d'attaque pour l'exercice « Allitération »
  const CONSONNES = [
    { cible: 'p', libelle: '[p]', exemples: 'pierre, poing, paix' }, { cible: 'b', libelle: '[b]', exemples: 'balle, béton, bruit' },
    { cible: 't', libelle: '[t]', exemples: 'tigre, temps, terre' }, { cible: 'd', libelle: '[d]', exemples: 'dalle, destin, douleur' },
    { cible: 'k', libelle: '[k]', exemples: 'casse, cœur, crime' }, { cible: 'R', libelle: '[r]', exemples: 'rage, rue, rêve' },
    { cible: 's', libelle: '[s]', exemples: 'salle, sang, silence' }, { cible: 'f', libelle: '[f]', exemples: 'feu, folie, frère' },
    { cible: 'm', libelle: '[m]', exemples: 'mur, mère, mort' }
  ];

  const melanger = (arr) => [...arr].sort(() => Math.random() - 0.5);

  // Tirage reproductible (défi du jour : le même pour tout le monde ce jour-là)
  function avecGraine(graine, fn) {
    let h = 2166136261;
    for (const c of String(graine)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    let a = h >>> 0;
    const aleatoire = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const original = Math.random;
    Math.random = aleatoire; // le temps d'un tirage synchrone seulement
    try { return fn(); } finally { Math.random = original; }
  }
  const auHasard = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const tirerMots = (n = 3) => melanger(MOTS).slice(0, n);

  // ---------- Modes ----------
  const DEFIS = {
    mots: { nom: 'Mots imposés', tirer: () => ({ mots: tirerMots(3) }) },
    theme: { nom: 'Thème imposé', tirer: () => ({ theme: auHasard(THEMES) }) },
    style: { nom: 'Style imposé', tirer: () => ({ style: auHasard(Object.keys(STYLES)) }) },
    multis: { nom: 'Chasseur de multis', tirer: () => ({ objectif: 3 }) },
    riches: { nom: 'Rimes riches', tirer: () => ({ objectif: 5 }) },
    zeroBlanc: { nom: 'Zéro blanc', tirer: () => ({}) },
    flow: { nom: 'Calé sur le temps', tirer: () => ({ objectif: 65 }) },
    rimeCible: { nom: 'Chaîne de rimes', tirer: () => ({ son: auHasard(SONS_CIBLES), objectif: 6 }) },
    allit: { nom: 'Allitération', tirer: () => ({ consonne: auHasard(CONSONNES), objectif: 5 }) }
  };

  const MODES = {
    libre: { nom: 'Libre', icone: '🎤', description: 'Aucune contrainte : fais-toi plaisir.', tirer: () => ({}) },
    defi: { nom: 'Défi', icone: '🎯', description: 'Un défi au choix.', tirer: (id = 'mots') => ({ defi: id, ...DEFIS[id].tirer() }) },
    impose: {
      nom: 'Imposé', icone: '🎰', description: 'Style, thème et mots imposés.',
      tirer: () => ({ style: auHasard(Object.keys(STYLES)), theme: auHasard(THEMES), mots: tirerMots(3) })
    },
    rafale: {
      nom: 'Mots en rafale', icone: '⚡', description: 'Un nouveau mot tombe régulièrement : place-le avant le suivant.',
      tirer: () => ({ mesures: 4, mots: null })
    },
    survie: { nom: 'Survie', icone: '💀', description: 'Si la hype du public tombe à zéro, tu es éliminé.', tirer: () => ({}) },
    featuring: {
      nom: 'Featuring', icone: '🤝', description: 'À plusieurs sur la même prod : l’outil annonce les tours, chacun a son score.',
      tirer: () => ({ joueurs: ['MC 1', 'MC 2'], mesures: 8 })
    },
    studio: {
      nom: 'Prise studio', icone: '🎙️', description: 'Rappe un de tes brouillons : le prompteur défile en rythme, l’outil note ta diction et ton calage. Garde ta meilleure prise.',
      tirer: () => ({ lignes: [], mesuresParLigne: 2, intro: 2 })
    },
    battle: {
      nom: 'Battle', icone: '🥊', description: 'Deux MC s’affrontent en rounds ; le juge IA tranche chaque round comme un jury (sinon, les points).',
      tirer: () => ({ joueurs: ['MC 1', 'MC 2'], mesures: 16, rounds: 2 })
    }
  };

  // Badges gagnés (sauvegardés dans l'historique)
  const BADGES = {
    mots: '🧩 Mots placés', theme: '🗺️ Thème tenu', style: '🎭 Style respecté', multis: '🎯 Chasseur de multis',
    riches: '💎 Rimes riches', zeroBlanc: '🫁 Zéro blanc', flow: '🥁 Calé sur le temps', triple: '🎰 Triplé imposé',
    survie: '💀 Survivant', rafale: '⚡ Rafale tenue', rafaleParfaite: '🌩️ Rafale parfaite',
    rimeCible: '🔗 Chaîne de rimes', allit: '🔤 Allitération', defiDuJour: '📅 Défi du jour', battle: '🥊 Battle gagnée', studio: '🎙️ Prise propre'
  };

  const correspond = (coeur, mot) => {
    const m = mot.toLowerCase().trim();
    return coeur === m || coeur === m + 's' || coeur === m + 'x' || (m.length >= 6 && coeur.startsWith(m.slice(0, -1)));
  };

  // Texte d'aperçu des consignes (écran titre, options)
  function consignes(mode, config) {
    if (mode === 'impose') return [
      { libelle: 'STYLE', valeur: STYLES[config.style]?.nom || '?', sous: STYLES[config.style]?.consigne },
      { libelle: 'THÈME', valeur: config.theme },
      { libelle: 'MOTS', valeur: (config.mots || []).join(' · ') }
    ];
    if (mode === 'defi') return [{ libelle: 'DÉFI', valeur: DEFIS[config.defi].nom, sous: texteDefi(config.defi, config) }];
    if (mode === 'rafale') return [{ libelle: 'RAFALE', valeur: `Un mot toutes les ${config.mesures} mesures`, sous: config.mots ? 'Mots choisis par toi' : 'Mots tirés au sort' }];
    if (mode === 'survie') return [{ libelle: 'SURVIE', valeur: 'Garde le public avec toi', sous: 'Hype à zéro = éliminé' }];
    if (mode === 'featuring') return [{ libelle: 'FEATURING', valeur: (config.joueurs || []).join('  ×  '), sous: `${config.mesures} mesures chacun, à tour de rôle` }];
    if (mode === 'studio') return [{
      libelle: 'PRISE STUDIO', valeur: config.titre || 'Choisis un brouillon',
      sous: config.lignes && config.lignes.length ? `${config.lignes.length} ligne(s) · ${config.mesuresParLigne} mesure(s) par ligne` : 'Écris ou assemble un brouillon dans la Matière'
    }];
    if (mode === 'battle') return [{ libelle: 'BATTLE', valeur: (config.joueurs || []).slice(0, 2).join('  VS  '), sous: `${config.rounds} round(s) · ${config.mesures} mesures chacun` }];
    return [];
  }

  function texteDefi(id, c) {
    return {
      mots: () => `Place ces 3 mots : ${c.mots.join(', ')}`,
      theme: () => `Thème : ${c.theme} (au moins 3 mots du thème)`,
      style: () => `Style : ${STYLES[c.style].nom} (${STYLES[c.style].consigne.toLowerCase()})`,
      multis: () => `Place ${c.objectif} rimes multisyllabiques`,
      riches: () => `Place ${c.objectif} rimes riches`,
      zeroBlanc: () => 'Aucun silence de plus de 2,5 s, jusqu’au bout',
      flow: () => `Termine avec au moins ${c.objectif} % de précision rythmique`,
      rimeCible: () => `Place ${c.objectif} mots différents qui finissent en ${c.son.libelle} (${c.son.exemples}…)`,
      allit: () => `Place ${c.objectif} mots différents qui commencent par ${c.consonne.libelle} (${c.consonne.exemples}…)`
    }[id]();
  }

  function creerPartie({ mode = 'libre', config = {}, grille = null } = {}) {
    const p = {
      mode, modeNom: MODES[mode].nom, modeIcone: MODES[mode].icone, config, grille,
      objectifs: [], rafale: null, elimine: false, tElimine: null,
      score: 0, combo: 0, comboMax: 0, multiplicateur: 1,
      hype: mode === 'survie' ? 60 : 50, hypeCumul: 0, hypeTemps: 0,
      dernierePos: -1, vus: new Set(),
      blancs: 0, enBlanc: false, aParle: false,
      precision: { pile: 0, bien: 0, hors: 0, serie: 0 },
      attaques: [], marqueurs: [], popups: [],
      t: 0, termine: false, badges: [], sons: [], joueurs: null, feat: null
    };

    function popup(texte, { sous = '', couleur = '#ffcc00', taille = 1, duree = 1.6 } = {}) {
      p.popups.push({ texte, sous, couleur, taille, t0: p.t, duree });
      if (p.popups.length > 6) p.popups.shift();
    }

    function gagner(points, { hype = 0 } = {}) {
      const gain = Math.round(points * p.multiplicateur);
      p.score += gain;
      p.hype = Math.min(100, p.hype + hype);
      return gain;
    }

    function casserCombo(raison) {
      if (p.combo >= 3) popup('COMBO PERDU', { sous: raison, couleur: '#ff3d6e', taille: 0.8 });
      p.combo = 0;
      p.multiplicateur = 1;
    }

    // ---------- Objectifs ----------
    function objectif(id, libelle, texte, bonus, { verifier = () => { }, terminer = () => { } } = {}) {
      const o = { id, libelle, texte, bonus, etat: 'encours', progression: '', verifier, terminer };
      p.objectifs.push(o);
      return o;
    }
    function reussir(o) {
      if (o.etat !== 'encours') return;
      o.etat = 'ok';
      p.score += o.bonus;
      p.hype = Math.min(100, p.hype + 15);
      p.badges.push(o.id);
      popup(`${o.libelle.toUpperCase()} ✓  +${o.bonus}`, { sous: o.texte, couleur: '#c77dff', taille: 1.15, duree: 2.4 });
    }
    function rater(o, raison) {
      if (o.etat !== 'encours') return;
      o.etat = 'rate';
      popup(`${o.libelle.toUpperCase()} RATÉ`, { sous: raison, couleur: '#ff3d6e', taille: 0.9 });
    }

    function objMots(mots, bonus = 150) {
      const places = new Set();
      const maj = () => { o.texte = mots.map((m) => (places.has(m) ? `${m} ✓` : m)).join(' · '); o.progression = `${places.size}/${mots.length}`; };
      const o = objectif('mots', 'Mots imposés', '', bonus, {
        verifier: (res) => {
          for (const mot of mots) {
            if (places.has(mot) || !res.tokens.some((t) => correspond(t.coeur, mot))) continue;
            places.add(mot);
            const gain = gagner(50, { hype: 10 });
            popup(`MOT PLACÉ : ${mot.toUpperCase()}  +${gain}`, { couleur: '#c77dff' });
          }
          maj();
          if (places.size === mots.length) reussir(o);
        },
        terminer: () => rater(o, `${places.size}/${mots.length} mots placés`)
      });
      maj();
      return o;
    }

    function objTheme(theme, bonus = 150) {
      const o = objectif('theme', 'Thème', theme, bonus, {
        verifier: (res) => {
          const n = res.vocab.tousChamps[theme] || 0;
          o.progression = `${Math.min(n, 3)}/3`;
          if (n >= 3) reussir(o);
        },
        terminer: () => rater(o, 'pas assez de mots du thème')
      });
      o.progression = '0/3';
      return o;
    }

    // Le style se juge sur l'ensemble : verdict à la fin (le juge IA peut le confirmer ou l'infirmer)
    function objStyle(style, bonus = 200) {
      const o = objectif('style', 'Style', STYLES[style].nom, bonus, {
        verifier: (res) => { o.progression = `≈ ${Math.round((res.ecriture[style] || 0) * 100)} %`; },
        terminer: (res) => {
          const v = res.ecriture[style] || 0;
          const max = Math.max(...Object.values(res.ecriture));
          if (v >= 0.4 && v >= max * 0.7) reussir(o); else rater(o, 'style pas assez marqué');
        }
      });
      o.styleId = style;
      return o;
    }

    function objCompteur(id, libelle, cle, objectifN, bonus = 200) {
      const o = objectif(id, libelle, `${objectifN} à placer`, bonus, {
        verifier: (res) => {
          o.progression = `${Math.min(res.stats[cle], objectifN)}/${objectifN}`;
          if (res.stats[cle] >= objectifN) reussir(o);
        },
        terminer: () => rater(o, `${o.progression}`)
      });
      o.progression = `0/${objectifN}`;
      return o;
    }

    // Compte des mots différents qui passent un filtre phonétique (son final, consonne d'attaque)
    function objCibles(id, libelle, texte, filtre, objectifN, bonus = 250) {
      const trouves = new Set();
      const o = objectif(id, libelle, texte, bonus, {
        verifier: (res) => {
          for (const t of res.tokens) {
            if (t.outil || !t.voy.length || trouves.has(t.coeur) || !filtre(t)) continue;
            trouves.add(t.coeur);
            const gain = gagner(30, { hype: 6 });
            popup(`${t.brut.toUpperCase()}  ${Math.min(trouves.size, objectifN)}/${objectifN}  +${gain}`, { couleur: '#c77dff', taille: 0.85 });
          }
          o.progression = `${Math.min(trouves.size, objectifN)}/${objectifN}`;
          if (trouves.size >= objectifN) reussir(o);
        },
        terminer: () => rater(o, `${trouves.size}/${objectifN}`)
      });
      o.progression = `0/${objectifN}`;
      return o;
    }

    // ---------- Construction selon le mode ----------
    if (mode === 'defi') {
      const c = config;
      if (c.defi === 'mots') objMots(c.mots, 300);
      if (c.defi === 'theme') objTheme(c.theme, 250);
      if (c.defi === 'style') objStyle(c.style, 250);
      if (c.defi === 'multis') objCompteur('multis', 'Multis', 'multis', c.objectif, 250);
      if (c.defi === 'riches') objCompteur('riches', 'Rimes riches', 'riches', c.objectif, 250);
      if (c.defi === 'zeroBlanc') objectif('zeroBlanc', 'Zéro blanc', 'aucun silence de plus de 2,5 s', 300);
      if (c.defi === 'flow') objectif('flow', 'Calé sur le temps', `${c.objectif} % de précision`, 300);
      if (c.defi === 'rimeCible') objCibles('rimeCible', 'Chaîne de rimes', `mots en ${c.son.libelle}`, (t) => t.phSans.endsWith(c.son.cible), c.objectif);
      if (c.defi === 'allit') objCibles('allit', 'Allitération', `mots en ${c.consonne.libelle}`, (t) => t.ph[0] === c.consonne.cible, c.objectif);
    } else if (mode === 'impose') {
      objStyle(config.style);
      objTheme(config.theme);
      objMots(config.mots);
    } else if (mode === 'survie') {
      objectif('survie', 'Survie', 'garde la hype au-dessus de zéro', 300);
    } else if (mode === 'featuring' || mode === 'battle') {
      const noms = (config.joueurs || []).filter(Boolean);
      p.joueurs = (noms.length >= 2 ? noms : ['MC 1', 'MC 2']).slice(0, mode === 'battle' ? 2 : 4)
        .map((nom) => ({ nom, score: 0, comboMax: 0, evenements: 0 }));
      const dureeTour = grille ? config.mesures * 4 * grille.periode : config.mesures * 2.6;
      // les tours démarrent sur le premier temps fort de l'instru
      p.feat = { dureeTour, depart: grille ? grille.offset : 0, indexTour: -1 };
      if (mode === 'battle') {
        const rounds = Math.max(1, Math.min(3, config.rounds || 2));
        p.battle = {
          rounds, resultats: new Array(rounds).fill(null), points: Array.from({ length: rounds }, () => [0, 0]),
          fini: false, evenements: [], dureeTotale: p.feat.depart + rounds * 2 * dureeTour
        };
      }
    } else if (mode === 'studio') {
      const uneMesure = grille ? 4 * grille.periode : 2.6;
      const textes = (config.lignes || []).map((l) => String(l)).filter((l) => l.trim());
      const dureeLigne = Math.max(1, config.mesuresParLigne || 2) * uneMesure;
      const depart = (grille ? grille.offset : 0) + Math.max(1, config.intro || 2) * uneMesure;
      // les mots attendus, découpés comme ceux qu'on entend (même normalisation, même phonétique)
      const decoupe = root.Analyse ? root.Analyse.tokeniser(textes.map((texte) => ({ texte }))).tokens : [];
      p.studio = {
        uneMesure, dureeLigne, depart, ligne: -1, fini: false, diction: 0, calage: 0, note: null, cle: null,
        dureeTotale: depart + textes.length * dureeLigne + uneMesure,
        lignes: textes.map((texte, k) => ({ k, texte, t0: depart + k * dureeLigne, t1: depart + (k + 1) * dureeLigne, taux: 0, propre: false })),
        attendus: decoupe.map((t) => ({ brut: t.brut, coeur: t.coeur, phSans: t.phSans, ligne: t.seg, dit: false, t: null }))
      };
      const o = objectif('studio', 'Texte tenu', '80 % des mots du brouillon', 200, {
        verifier: (res) => verifierStudio(res),
        terminer: () => { if (p.studio.diction >= 0.8) reussir(o); else rater(o, `${Math.round(p.studio.diction * 100)} % des mots`); }
      });
      o.progression = '0 %';
    } else if (mode === 'rafale') {
      const liste = config.mots && config.mots.length ? config.mots : melanger(MOTS);
      const duree = grille ? config.mesures * 4 * grille.periode : config.mesures * 2.6;
      p.rafale = { liste, index: 0, duree, courant: null, attente: [], places: 0, total: 0 };
      const o = objectif('rafale', 'Rafale', 'place au moins 70 % des mots', 250);
      o.progression = '0/0';
    }

    // ---------- Featuring : à qui le tour ? ----------
    function indexTour(t) {
      const idx = Math.floor(Math.max(0, t - p.feat.depart) / p.feat.dureeTour);
      return p.battle ? Math.min(idx, p.battle.rounds * 2 - 1) : idx;
    }
    // En battle, celui qui ouvre change à chaque round : A-B, puis B-A, puis A-B
    function ordreTour(idx) {
      if (!p.battle) return idx % p.joueurs.length;
      const premier = Math.floor(idx / 2) % 2;
      return idx % 2 === 0 ? premier : 1 - premier;
    }
    function joueurDe(t) { return p.joueurs ? p.joueurs[ordreTour(indexTour(t))] : null; }

    function majFeaturing(t) {
      const f = p.feat;
      const brut = Math.floor(Math.max(0, t - f.depart) / f.dureeTour);
      const b = p.battle;
      // battle : le dernier tour terminé, la battle est finie (le dernier round part au jury)
      if (b && brut >= b.rounds * 2) {
        if (!b.fini) {
          b.fini = true;
          b.evenements.push({ type: 'finRound', round: b.rounds - 1 });
          popup('FIN DE LA BATTLE', { sous: 'le jury délibère…', couleur: '#ff3d6e', taille: 1.3, duree: 3 });
          p.sons.push('ding');
        }
        f.reste = 0;
        return;
      }
      const idx = brut;
      if (idx !== f.indexTour) {
        f.indexTour = idx;
        f.prevenu = false;
        p.combo = 0;
        p.multiplicateur = 1;
        const j = p.joueurs[ordreTour(idx)];
        if (b && idx % 2 === 0) {
          if (idx > 0) b.evenements.push({ type: 'finRound', round: idx / 2 - 1 });
          popup(`🥊 ROUND ${idx / 2 + 1}`, { sous: `${j.nom} ouvre`, couleur: '#ff3d6e', taille: 1.5, duree: 2.2 });
        } else {
          popup(`🎤 À TOI : ${j.nom.toUpperCase()}`, {
            sous: b ? 'réponds-lui !' : (idx === 0 ? 'c’est parti !' : `tour ${Math.floor(idx / p.joueurs.length) + 1}`),
            couleur: '#00e5ff', taille: 1.35, duree: 2.2
          });
        }
        p.sons.push('tour');
      }
      const debutSuivant = f.depart + (idx + 1) * f.dureeTour;
      const uneMesure = p.grille ? 4 * p.grille.periode : 2.6;
      const dernier = b && idx + 1 >= b.rounds * 2;
      if (!f.prevenu && !dernier && t >= debutSuivant - uneMesure) {
        f.prevenu = true;
        popup(`PRÉPARE-TOI : ${p.joueurs[ordreTour(idx + 1)].nom.toUpperCase()}`, { couleur: '#8b8ba3', taille: 0.8, duree: 1.8 });
        p.sons.push('prepare');
      }
      f.actif = ordreTour(idx);
      f.suivant = dernier ? null : ordreTour(idx + 1);
      f.reste = Math.max(0, debutSuivant - t);
      f.mesuresRestantes = Math.ceil(f.reste / uneMesure);
      if (b) f.round = Math.floor(idx / 2);
    }

    // ---------- Prise studio : le texte rappé comparé au brouillon ----------
    function majStudio(t) {
      const st = p.studio;
      st.ligne = Math.min(st.lignes.length, Math.floor((t - st.depart) / st.dureeLigne));
      if (!st.fini && t >= st.dureeTotale) {
        st.fini = true;
        popup('FIN DE LA PRISE', { couleur: '#00e5ff', taille: 1.2, duree: 2.5 });
      }
    }

    // deux mots « pareils » : même mot, même son (homophones), ou à un son près (erreur de reconnaissance)
    function memeMot(a, b) {
      if (a.coeur === b.coeur || correspond(a.coeur, b.coeur) || correspond(b.coeur, a.coeur)) return true;
      if (a.phSans && a.phSans === b.phSans) return true;
      return a.phSans.length >= 4 && b.phSans.length >= 4 && aUnSonPres(a.phSans, b.phSans);
    }
    function aUnSonPres(a, b) {
      if (Math.abs(a.length - b.length) > 1) return false;
      let i = 0, j = 0, diff = 0;
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++diff > 1) return false;
        if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
      }
      return diff + (a.length - i) + (b.length - j) <= 1;
    }

    // Plus longue suite de mots du brouillon retrouvés dans l'ordre (les ad-libs et les oublis sont tolérés)
    function aligner(attendus, dits) {
      const n = attendus.length, m = dits.length;
      const egal = attendus.map((a) => dits.map((b) => memeMot(a, b)));
      const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
        L[i][j] = egal[i][j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      const paires = [];
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (egal[i][j] && L[i][j] === L[i + 1][j + 1] + 1) { paires.push([i, j]); i++; j++; }
        else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
      }
      return paires;
    }

    function verifierStudio(res) {
      const st = p.studio;
      const cle = res.tokens.length + ':' + (res.tokens.length ? res.tokens[res.tokens.length - 1].coeur : '');
      if (cle === st.cle) return;
      st.cle = cle;
      // instant estimé de chaque mot entendu : réparti sur la durée de sa phrase
      const parPhrase = new Map();
      for (const t of res.tokens) {
        if (!parPhrase.has(t.seg)) parPhrase.set(t.seg, []);
        parPhrase.get(t.seg).push(t);
      }
      const instant = new Map();
      for (const l of parPhrase.values()) {
        const t1 = l[0].temps, tm = l[0].tMilieu;
        if (t1 == null || tm == null) continue;
        const t0 = 2 * tm - t1;
        l.forEach((t, k) => instant.set(t.i, t0 + (t1 - t0) * (k + 0.5) / l.length - LATENCE_RECO));
      }
      for (const a of st.attendus) { a.dit = false; a.t = null; }
      for (const [i, j] of aligner(st.attendus, res.tokens)) {
        st.attendus[i].dit = true;
        st.attendus[i].t = instant.get(res.tokens[j].i) ?? null;
      }
      for (const l of st.lignes) {
        const mots = st.attendus.filter((a) => a.ligne === l.k);
        l.taux = mots.length ? mots.filter((a) => a.dit).length / mots.length : 0;
        if (l.taux >= 0.8 && !l.propre && !p.termine) {
          l.propre = true;
          const gain = gagner(25, { hype: 5 });
          popup(`LIGNE ${l.k + 1} ✓  +${gain}`, { couleur: '#3ddc97', taille: 0.8, duree: 1.4 });
        }
      }
      const dits = st.attendus.filter((a) => a.dit).length;
      st.diction = st.attendus.length ? dits / st.attendus.length : 0;
      const o = p.objectifs.find((x) => x.id === 'studio');
      if (o) o.progression = `${Math.round(st.diction * 100)} %`;
    }

    // Note de la prise : diction (mots compris), calage des lignes sur le prompteur, précision rythmique
    function bilanStudio() {
      const st = p.studio;
      const mesure = st.uneMesure;
      for (const l of st.lignes) {
        const mots = st.attendus.filter((a) => a.ligne === l.k);
        const premier = mots.find((a) => a.dit && a.t != null);
        l.ecart = premier ? Math.round((premier.t - l.t0) * 100) / 100 : null;
        l.calage = premier ? Math.max(0, Math.min(1, 1 - Math.max(0, Math.abs(l.ecart) - 0.5 * mesure) / (1.5 * mesure))) : 0;
        l.manques = mots.filter((a) => !a.dit).map((a) => a.brut);
      }
      st.calage = st.lignes.length ? st.lignes.reduce((t, l) => t + l.calage, 0) / st.lignes.length : 0;
      const prec = tauxPrecision();
      const rythme = prec != null ? Math.min(1, prec / 0.75) : st.calage;
      st.note = Math.round(20 * (0.5 * st.diction + 0.3 * st.calage + 0.2 * rythme) * 10) / 10;
      return {
        note: st.note, diction: st.diction, calage: st.calage, precision: prec,
        brouillonId: p.config.brouillonId || null, titre: p.config.titre || null,
        interrompue: p.t < st.dureeTotale - mesure,
        lignes: st.lignes.map((l) => ({ texte: l.texte, taux: l.taux, ecart: l.ecart, manques: l.manques }))
      };
    }

    // ---------- Battle : verdict du jury pour chaque round ----------
    function resultatRound(r, res) {
      const b = p.battle;
      if (!b || r < 0 || r >= b.rounds || b.resultats[r]) return;
      b.resultats[r] = res;
      const nom = res.vainqueur == null ? 'ÉGALITÉ' : p.joueurs[res.vainqueur].nom.toUpperCase();
      popup(`🏆 ROUND ${r + 1} : ${nom}`, { sous: res.commentaire ? res.commentaire.slice(0, 90) : '', couleur: '#ffcc00', taille: 1.2, duree: 3.2 });
      p.sons.push('ding');
    }
    // round jugé sur les points (sans juge IA, ou si le jury ne répond pas)
    function resultatParPoints(r) {
      const [a, z] = p.battle.points[r];
      return { vainqueur: a === z ? null : (a > z ? 0 : 1), commentaire: `${a} points contre ${z}`, source: 'points' };
    }
    function bilanBattle() {
      const b = p.battle;
      const victoires = [0, 0];
      for (const r of b.resultats) if (r && r.vainqueur != null) victoires[r.vainqueur]++;
      const complet = b.resultats.every(Boolean);
      let vainqueur = null, departage = null;
      // égalité de rounds : les notes du jury IA départagent, puis les points du jeu
      const notes = [0, 1].map((k) => b.resultats.reduce((t, r) => t + (r && r.notes ? Number(r.notes[k]) || 0 : 0), 0));
      if (victoires[0] !== victoires[1]) vainqueur = victoires[0] > victoires[1] ? 0 : 1;
      else if (notes[0] !== notes[1]) { vainqueur = notes[0] > notes[1] ? 0 : 1; departage = 'notes'; }
      else if (p.joueurs[0].score !== p.joueurs[1].score) { vainqueur = p.joueurs[0].score > p.joueurs[1].score ? 0 : 1; departage = 'points'; }
      return { victoires, complet, vainqueur, vainqueurNom: vainqueur == null ? null : p.joueurs[vainqueur].nom, departage, notes };
    }

    function nouveauMotRafale(t) {
      const r = p.rafale;
      const mot = r.liste[r.index % r.liste.length];
      r.index++;
      r.courant = { mot, t0: t, t1: t + r.duree, place: false };
    }

    function verifierRafale(res) {
      const r = p.rafale;
      for (const item of [r.courant, ...r.attente]) {
        if (!item || item.place) continue;
        const tok = res.tokens.find((t) => t.temps != null && t.temps >= item.t0 - 0.5 && correspond(t.coeur, item.mot));
        if (!tok) continue;
        item.place = true;
        r.places++;
        const vitesse = Math.max(0, 1 - (Math.max(item.t0, tok.temps) - item.t0) / r.duree);
        const gain = gagner(60 + Math.round(40 * vitesse), { hype: 8 });
        popup(`PLACÉ : ${item.mot.toUpperCase()}  +${gain}`, { couleur: '#c77dff', taille: 1.1 });
      }
    }

    function majRafale(t) {
      const r = p.rafale;
      if (!r.courant && t >= 1) nouveauMotRafale(t);
      if (r.courant && t >= r.courant.t1) {
        r.total++;
        // le mot reste « rattrapable » pendant la grâce (latence de la reconnaissance vocale)
        if (!r.courant.place) r.attente.push(Object.assign(r.courant, { finGrace: r.courant.t1 + GRACE_RAFALE }));
        nouveauMotRafale(t);
      }
      r.attente = r.attente.filter((item) => {
        if (item.place) return false;
        if (t < item.finGrace) return true;
        p.hype = Math.max(0, p.hype - 6);
        casserCombo('mot raté');
        popup(`RATÉ : ${item.mot.toUpperCase()}`, { couleur: '#ff3d6e', taille: 0.9 });
        return false;
      });
      p.objectifs[0].progression = `${r.places}/${r.total}`;
    }

    // Nouveaux événements issus de l'analyse (rimes, figures)
    function surAnalyse(res) {
      const evs = [];
      for (const r of res.rimes) if (!p.vus.has(r.id)) evs.push({
        id: r.id, pos: r.i, pts: r.pts,
        texte: r.multi >= 2 ? `MULTI ×${r.multi}` : r.type === 'riche' ? 'RIME RICHE' : 'RIME',
        sous: r.multi >= 2
          ? `${r.spanJ.map((k) => res.tokens[k].brut).join(' ')} / ${r.spanI.map((k) => res.tokens[k].brut).join(' ')}`
          : `${res.tokens[r.j].brut} / ${res.tokens[r.i].brut}`,
        couleur: r.multi >= 2 ? '#ffcc00' : r.type === 'riche' ? '#ff8c42' : '#8b8ba3',
        gros: r.multi >= 2 || r.type === 'riche'
      });
      for (const f of res.figures) if (!p.vus.has(f.id)) evs.push({
        id: f.id, pos: f.b, pts: f.pts, texte: f.type.toUpperCase(), sous: f.detail, couleur: '#3ddc97', gros: true
      });
      evs.sort((a, b) => a.pos - b.pos);
      for (const e of evs) {
        p.vus.add(e.id);
        if (p.dernierePos >= 0 && e.pos - p.dernierePos > COMBO_RUPTURE_MOTS) casserCombo('trop long sans rimer');
        p.dernierePos = Math.max(p.dernierePos, e.pos);
        p.combo++;
        p.comboMax = Math.max(p.comboMax, p.combo);
        const avant = p.multiplicateur;
        p.multiplicateur = multiplicateurDe(p.combo);
        const gain = gagner(e.pts, { hype: Math.min(10, 2 + e.pts / 4) });
        if (p.joueurs) {
          // le point revient à celui qui avait le micro quand la phrase a été dite
          const tok = res.tokens[e.pos];
          const j = joueurDe(tok && tok.tMilieu != null ? tok.tMilieu : p.t);
          j.score += gain;
          if (p.battle) {
            const r = Math.min(p.battle.rounds - 1, Math.floor(indexTour(tok && tok.tMilieu != null ? tok.tMilieu : p.t) / 2));
            p.battle.points[r][p.joueurs.indexOf(j)] += gain;
          }
          j.evenements++;
          if (j === joueurDe(p.t)) j.comboMax = Math.max(j.comboMax, p.combo);
          e.sous = `${j.nom} · ${e.sous}`;
        }
        if (!p.studio && (e.gros || e.pts >= 10)) popup(`${e.texte}  +${gain}`, { sous: e.sous, couleur: e.couleur, taille: e.pts >= 20 ? 1.15 : 1 });
        if (p.multiplicateur > avant) popup(`MULTIPLICATEUR ×${p.multiplicateur}`, { couleur: '#00e5ff', taille: 0.9 });
        p.marqueurs.push({ t: p.t, texte: e.texte, couleur: e.couleur });
      }
      if (p.termine) return;
      for (const o of p.objectifs) if (o.etat === 'encours') o.verifier(res);
      if (p.rafale) verifierRafale(res);
    }

    // Appelé à chaque image : t = temps de session, tInstru = position dans l'instru (ou null)
    function tick(t, dt, voix, tInstru) {
      p.t = t;
      p.popups = p.popups.filter((x) => t - x.t0 < x.duree);
      if (p.termine) return;
      if (voix.voix) p.aParle = true;

      // Blancs : on ne compte qu'une fois le rappeur lancé
      if (p.aParle && voix.silence > BLANC_S && !p.enBlanc) {
        p.enBlanc = true;
        p.blancs++;
        p.hype = Math.max(0, p.hype - 12);
        casserCombo('blanc');
        popup('BLANC !', { couleur: '#ff3d6e', taille: 1.2 });
        const zb = p.objectifs.find((o) => o.id === 'zeroBlanc');
        if (zb) rater(zb, 'un blanc');
      }
      if (voix.voix) p.enBlanc = false;

      // La hype redescend toute seule, et vite pendant un silence (encore plus vite en Survie)
      let fuite = voix.silence > 1.2 && p.aParle ? 6 : 1.5;
      if (p.mode === 'survie') fuite *= 1.6;
      p.hype = Math.max(0, p.hype - fuite * dt);
      p.hypeCumul += p.hype * dt;
      p.hypeTemps += dt;
      if (p.mode === 'survie' && p.aParle && t > 4 && p.hype <= 0 && !p.elimine) {
        p.elimine = true;
        p.tElimine = t;
        rater(p.objectifs[0], 'le public a décroché');
        popup('ÉLIMINÉ', { sous: 'le public a décroché', couleur: '#ff3d6e', taille: 1.5, duree: 3 });
      }
      if (p.rafale) majRafale(t);
      if (p.feat) majFeaturing(t);
      if (p.studio) majStudio(t);

      // Précision rythmique sur les attaques franches de la voix
      if (voix.attaque && p.grille && tInstru != null && voix.attaque.force >= 0.3) {
        const e = p.grille.ecart(tInstru, 2);
        const qualite = Math.abs(e) <= FENETRE_PILE ? 'pile' : Math.abs(e) <= FENETRE_BIEN ? 'bien' : 'hors';
        p.precision[qualite]++;
        p.attaques.push({ t, qualite, ecart: e });
        if (qualite === 'pile') { gagner(3, { hype: 0.35 }); p.precision.serie++; }
        else if (qualite === 'bien') { gagner(1, { hype: 0.2 }); p.precision.serie++; }
        else p.precision.serie = 0;
        if (p.precision.serie > 0 && p.precision.serie % 24 === 0) {
          const gain = gagner(25, { hype: 5 });
          popup(`DANS LE TEMPS ×${p.precision.serie}  +${gain}`, { couleur: '#4fb3ff', taille: 0.85 });
        }
      } else if (voix.attaque) {
        p.attaques.push({ t, qualite: 'neutre', ecart: 0 });
      }
      // on ne garde que les dernières secondes pour l'affichage
      while (p.attaques.length && p.attaques[0].t < t - 8) p.attaques.shift();
      while (p.marqueurs.length && p.marqueurs[0].t < t - 8) p.marqueurs.shift();
    }

    function tauxPrecision() {
      const { pile, bien, hors } = p.precision;
      const n = pile + bien + hors;
      return n >= 10 ? (pile + 0.5 * bien) / n : null;
    }

    function rang(note) {
      const prec = tauxPrecision();
      const hypeMoy = p.hypeTemps ? p.hypeCumul / p.hypeTemps : p.hype;
      let perf = 0.55 * (note / 20) + 0.25 * (hypeMoy / 100) + 0.2 * (prec != null ? Math.min(1, prec / 0.75) : note / 20);
      if (p.elimine) perf *= 0.85;
      const [, lettre, couleur, libelle] = RANGS.find(([min]) => perf >= min);
      return { lettre, couleur, libelle, perf };
    }

    function resumeObjectifs() {
      return p.objectifs.map((o) => ({ id: o.id, libelle: o.libelle, texte: o.texte, etat: o.etat, progression: o.progression, bonus: o.bonus }));
    }

    // Fin de partie : objectifs, bonus, rang
    function terminer(res, duree) {
      for (const o of p.objectifs) if (o.etat === 'encours') o.verifier(res);
      if (p.rafale) {
        verifierRafale(res);
        const r = p.rafale;
        // le dernier mot compte s'il est placé ou affiché depuis plus de 3 s
        if (r.courant && (r.courant.place || p.t - r.courant.t0 >= 3)) r.total++;
        r.total = Math.max(r.total, r.places);
        const o = p.objectifs[0];
        o.progression = `${r.places}/${r.total}`;
        if (r.total >= 2 && r.places / r.total >= 0.7) reussir(o); else rater(o, `${o.progression} mots placés`);
        if (r.total >= 3 && r.places === r.total) p.badges.push('rafaleParfaite');
      }
      p.termine = true;
      const prec = tauxPrecision();
      for (const o of p.objectifs) {
        if (o.etat !== 'encours') continue;
        if (o.id === 'zeroBlanc') { if (p.aParle) reussir(o); else rater(o, 'pas de rap détecté'); }
        else if (o.id === 'flow') {
          o.progression = prec != null ? `${Math.round(prec * 100)} %` : 'pas assez de mesures';
          if (prec != null && prec * 100 >= p.config.objectif) reussir(o); else rater(o, o.progression);
        } else if (o.id === 'survie') {
          if (p.aParle && duree >= 20) reussir(o); else rater(o, 'impro trop courte');
        } else o.terminer(res);
      }
      if (p.mode === 'survie') p.score += Math.round(4 * (p.elimine ? p.tElimine : duree));
      if (p.mode === 'impose' && p.objectifs.every((o) => o.etat === 'ok')) {
        p.score += 250;
        p.badges.push('triple');
        popup('TRIPLÉ IMPOSÉ  +250', { couleur: '#ffcc00', taille: 1.3, duree: 3 });
      }
      let bonusCombo = p.comboMax * 10;
      let joueurs = null, vainqueur = null;
      if (p.joueurs) {
        // en featuring, chacun a son bonus de combo et le score du duo est la somme des deux
        for (const j of p.joueurs) j.score += j.comboMax * 10;
        bonusCombo = 0;
        p.score = p.joueurs.reduce((s, j) => s + j.score, 0);
        joueurs = p.joueurs.map((j) => ({ ...j }));
        const tri = [...joueurs].sort((a, b) => b.score - a.score);
        vainqueur = tri[0].score > tri[1].score ? tri[0].nom : null; // null = égalité
      } else p.score += bonusCombo;
      let battle = null;
      if (p.battle) {
        // battle arrêtée avant la fin : le round en cours part quand même au jury
        const roundEnCours = Math.min(p.battle.rounds - 1, Math.floor(indexTour(p.t) / 2));
        if (!p.battle.fini && !p.battle.evenements.some((e) => e.round === roundEnCours)) {
          p.battle.evenements.push({ type: 'finRound', round: roundEnCours });
        }
        battle = { rounds: p.battle.rounds, joues: roundEnCours + 1, resultats: [...p.battle.resultats], points: p.battle.points.map((x) => [...x]), ...bilanBattle() };
        vainqueur = battle.complet ? battle.vainqueurNom : vainqueur;
      }
      const studio = p.studio ? bilanStudio() : null;
      return {
        joueurs, vainqueur, battle, studio,
        score: p.score, bonusCombo, comboMax: p.comboMax, blancs: p.blancs,
        precision: prec, hypeMoyenne: p.hypeTemps ? p.hypeCumul / p.hypeTemps : p.hype,
        mode: p.mode, modeNom: p.modeNom, modeIcone: p.modeIcone,
        objectifs: resumeObjectifs(), badges: [...p.badges],
        elimine: p.elimine, tElimine: p.tElimine,
        rang: rang(studio ? studio.note : res.stats.note)
      };
    }

    // Verdict du juge IA sur le style imposé : peut valider ou retirer le bonus
    function verdictStyleIA(respecte) {
      const o = p.objectifs.find((x) => x.id === 'style');
      if (!o) return 0;
      let delta = 0;
      if (respecte && o.etat !== 'ok') { o.etat = 'ok'; p.score += o.bonus; delta = o.bonus; if (!p.badges.includes('style')) p.badges.push('style'); }
      else if (!respecte && o.etat === 'ok') { o.etat = 'rate'; p.score -= o.bonus; delta = -o.bonus; p.badges = p.badges.filter((b) => b !== 'style'); }
      return delta;
    }

    return Object.assign(p, {
      surAnalyse, tick, terminer, rang, tauxPrecision, verdictStyleIA, resumeObjectifs, joueurDe,
      resultatRound, resultatParPoints, bilanBattle, indexTour,
      paliersHype: () => paliersHype(p.hype)
    });
  }

  const api = {
    creerPartie, MODES, DEFIS, STYLES, THEMES, MOTS, BADGES, RANGS, SONS_CIBLES, CONSONNES, avecGraine,
    consignes, texteDefi, tirerMots, paliersHype, multiplicateurDe
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Jeu = api;
})(typeof window !== 'undefined' ? window : globalThis);
