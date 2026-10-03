/*
 * Classement entre potes : un défi par semaine, le même pour tout le monde (instru imposée),
 * et un tableau des scores par « crew », gardé dans le projet Supabase gratuit.
 * Servi aussi sur la page publique du classement (public/classement.html).
 */
(function (root) {
  const CLE_CREW = 'juge-impro-crew';
  const CLE_APPAREIL = 'juge-impro-appareil';
  const CREW_VALIDE = /^[A-Z0-9-]{3,24}$/;
  const STYLES_BOITE = ['boombap', 'trap', 'drill', 'lofi', 'oldschool'];
  let sb = null;
  const client = () => sb || (sb = root.supabase.createClient(Reseau.CONFIG.supabaseUrl, Reseau.CONFIG.supabaseCle, { auth: { persistSession: false } }));
  const lire = (cle) => { try { return localStorage.getItem(cle); } catch { return null; } };
  const ecrire = (cle, v) => { try { localStorage.setItem(cle, v); } catch { /* stockage indisponible */ } };

  // Semaine ISO, du lundi au dimanche : « 2026-S40 » (la même règle que la base de données)
  function semaine(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const annee = d.getUTCFullYear();
    const n = Math.ceil(((d - Date.UTC(annee, 0, 1)) / 86400000 + 1) / 7);
    return `${annee}-S${String(n).padStart(2, '0')}`;
  }
  function decalerSemaine(s, n) {
    const [annee, num] = s.split('-S').map(Number);
    // le jeudi de la semaine ISO, puis n semaines plus loin
    const jan4 = new Date(Date.UTC(annee, 0, 4));
    const lundi = new Date(jan4); lundi.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (num - 1 + n) * 7);
    return semaine(new Date(lundi.getUTCFullYear(), lundi.getUTCMonth(), lundi.getUTCDate()));
  }
  // jours restants avant dimanche minuit
  const joursRestants = (date = new Date()) => 7 - (date.getDay() || 7);

  // ---------- Défi de la semaine : tiré au sort à partir du numéro de semaine ----------
  const DEFIS = [
    () => ({ titre: 'Imposé de la semaine', mode: 'impose', config: Jeu.MODES.impose.tirer() }),
    () => ({ titre: 'Rafale de la semaine', mode: 'rafale', config: { mesures: 4, mots: Jeu.tirerMots(12), motsImposes: true } }),
    () => ({ titre: 'Chaîne de la semaine', mode: 'defi', config: { defi: 'rimeCible', ...Jeu.DEFIS.rimeCible.tirer(), objectif: 8 } }),
    () => ({ titre: 'Survie de la semaine', mode: 'survie', config: {} }),
    () => ({ titre: 'Mots de la semaine', mode: 'defi', config: { defi: 'mots', mots: Jeu.tirerMots(3) } })
  ];
  function defiDeLaSemaine(s = semaine()) {
    return Jeu.avecGraine('juge-impro:semaine:' + s, () => {
      const p = DEFIS[Math.floor(Math.random() * DEFIS.length)]();
      // instru imposée : la boîte à rythmes, au même tempo pour tout le monde
      const boite = STYLES_BOITE[Math.floor(Math.random() * STYLES_BOITE.length)];
      return { ...p, id: 'defi-semaine', semaine: s, duree: 60, boite, forcerBoite: true };
    });
  }

  // ---------- Crew et appareil ----------
  const normaliserCrew = (c) => String(c || '').toUpperCase().trim().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
  const crew = () => { const c = lire(CLE_CREW); return CREW_VALIDE.test(c || '') ? c : null; };
  function choisirCrew(c) {
    const n = normaliserCrew(c);
    if (!CREW_VALIDE.test(n)) return null;
    ecrire(CLE_CREW, n);
    return n;
  }
  const nouveauCrew = () => choisirCrew(`CREW-${Reseau.nouveauCode(5)}`);
  const quitterCrew = () => { try { localStorage.removeItem(CLE_CREW); } catch { /* stockage indisponible */ } };
  function appareil() {
    let a = lire(CLE_APPAREIL);
    if (!/^[A-Za-z0-9]{8,32}$/.test(a || '')) { a = Reseau.nouveauCode(16); ecrire(CLE_APPAREIL, a); }
    return a;
  }
  const lienPublic = (c) => `${Reseau.CONFIG.pagePublic || `${location.origin}/public/`}classement.html?crew=${encodeURIComponent(c)}`;

  // ---------- Scores ----------
  async function poster({ pseudo, score, note, rang }) {
    const c = crew();
    if (!c) throw new Error('Choisis d’abord ton crew (onglet Entraînement).');
    const { error } = await client().from('classement').insert({
      crew: c, semaine: semaine(), pseudo: String(pseudo || 'MC').trim().slice(0, 30) || 'MC', appareil: appareil(),
      score: Math.max(0, Math.min(50000, Math.round(score || 0))),
      note: note == null ? null : Math.max(0, Math.min(20, Math.round(note * 10) / 10)),
      rang: /^[SABCD]$/.test(rang || '') ? rang : null
    });
    if (error) {
      if (/row-level/.test(error.message)) throw new Error('La semaine vient de changer : ce score ne compte plus pour le classement.');
      if (/Trop de scores/.test(error.message)) throw new Error('Tu as déjà envoyé 20 scores cette semaine depuis cet ordi.');
      throw new Error('Envoi impossible (connexion internet ?)');
    }
    return c;
  }

  // Meilleur score de chaque MC du crew pour la semaine, avec le nombre d'essais
  async function tableau(c = crew(), s = semaine()) {
    if (!c) return [];
    const { data, error } = await client().from('classement').select('pseudo,score,note,rang,cree')
      .eq('crew', c).eq('semaine', s).order('score', { ascending: false }).order('cree', { ascending: true }).limit(500);
    if (error) throw new Error('Classement indisponible (connexion internet ?)');
    const parMC = new Map();
    for (const x of data) {
      const k = x.pseudo.trim().toLowerCase();
      if (!parMC.has(k)) parMC.set(k, { ...x, essais: 0 });
      parMC.get(k).essais++;
    }
    return [...parMC.values()];
  }

  root.Classement = {
    semaine, decalerSemaine, joursRestants, defiDeLaSemaine,
    crew, choisirCrew, nouveauCrew, quitterCrew, normaliserCrew, lienPublic, poster, tableau
  };
})(typeof window !== 'undefined' ? window : globalThis);
