/*
 * Tempo : détection du BPM d'une instru, grille de temps, et détection des attaques de la voix
 * (pour savoir si le rappeur pose ses syllabes dans le temps).
 */
(function (root) {
  const FPS = 100; // résolution de l'enveloppe d'attaques (images par seconde)

  // Enveloppe « force d'attaque » : hausse d'énergie d'une image à l'autre (graves + spectre complet)
  function enveloppeAttaques(buffer, maxSecondes = 90) {
    const sr = buffer.sampleRate;
    const hop = Math.round(sr / FPS);
    const n = Math.min(buffer.length, Math.floor(maxSecondes * sr));
    const canaux = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) canaux.push(buffer.getChannelData(c));
    const nbImages = Math.floor(n / hop);
    const eTotal = new Float32Array(nbImages), eGrave = new Float32Array(nbImages);
    const a = Math.exp(-2 * Math.PI * 150 / sr); // passe-bas ~150 Hz (grosse caisse, basse)
    let lp = 0;
    for (let f = 0; f < nbImages; f++) {
      let st = 0, sg = 0;
      for (let k = f * hop; k < (f + 1) * hop; k++) {
        let x = 0;
        for (const ch of canaux) x += ch[k];
        x /= canaux.length;
        lp = (1 - a) * x + a * lp;
        st += x * x; sg += lp * lp;
      }
      eTotal[f] = st; eGrave[f] = sg;
    }
    const env = new Float32Array(nbImages);
    for (let f = 1; f < nbImages; f++) {
      const dT = Math.log(eTotal[f] + 1e-9) - Math.log(eTotal[f - 1] + 1e-9);
      const dG = Math.log(eGrave[f] + 1e-9) - Math.log(eGrave[f - 1] + 1e-9);
      env[f] = Math.max(0, dT) + 1.5 * Math.max(0, dG);
    }
    // on retire la moyenne locale (0,5 s) pour ne garder que les pics
    const W = Math.round(FPS / 4);
    const out = new Float32Array(nbImages);
    let somme = 0;
    for (let f = 0; f < nbImages; f++) {
      somme += env[f];
      if (f >= 2 * W) somme -= env[f - 2 * W];
      const moy = somme / Math.min(f + 1, 2 * W);
      const g = f - W >= 0 ? f - W : f;
      out[g] = Math.max(0, env[g] - moy);
    }
    return out;
  }

  function autocorr(env, lag) {
    let s = 0;
    for (let f = lag; f < env.length; f++) s += env[f] * env[f - lag];
    return s / (env.length - lag);
  }

  // Renvoie { bpm, offset (s) du premier temps fort, confiance (0-1) }
  function detecterBPM(buffer) {
    const env = enveloppeAttaques(buffer);
    if (env.length < FPS * 4) return null;
    const lagMin = Math.floor(60 * FPS / 200), lagMax = Math.ceil(60 * FPS / 55);
    const ac = [];
    for (let lag = lagMin; lag <= lagMax; lag++) ac[lag] = autocorr(env, lag);
    // préférence douce pour les tempos courants du rap (centre ~ 95 BPM)
    const poids = (bpm) => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 95) / 0.9, 2));
    let meilleur = lagMin, scoreMax = -Infinity, somme = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      // un vrai tempo résonne aussi au double de sa période
      const v = ac[lag] + 0.5 * (ac[2 * lag] ?? autocorr(env, 2 * lag));
      const sc = v * poids(60 * FPS / lag);
      somme += ac[lag];
      if (sc > scoreMax) { scoreMax = sc; meilleur = lag; }
    }
    // affinage par interpolation parabolique
    const y0 = ac[meilleur - 1] ?? ac[meilleur], y1 = ac[meilleur], y2 = ac[meilleur + 1] ?? ac[meilleur];
    const dec = (y0 - 2 * y1 + y2) !== 0 ? 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2) : 0;
    const periode = meilleur + Math.max(-0.5, Math.min(0.5, dec));
    // Affinage : le bon tempo est celui où les attaques « tombent » toujours à la même phase
    // (somme circulaire de longueur maximale). Une petite erreur de BPM dérive vite sur 1 min.
    const circulaire = (bpmTest) => {
      const P = 60 * FPS / bpmTest;
      let re = 0, im = 0;
      for (let f = 0; f < env.length; f++) {
        const ang = 2 * Math.PI * f / P;
        re += env[f] * Math.cos(ang); im += env[f] * Math.sin(ang);
      }
      return { mag: Math.hypot(re, im), phase: Math.atan2(im, re) };
    };
    const bpmGrossier = 60 * FPS / periode;
    let bpm = bpmGrossier, cMax = circulaire(bpmGrossier);
    for (let b = bpmGrossier - 1.5; b <= bpmGrossier + 1.5; b += 0.02) {
      const c = circulaire(b);
      if (c.mag > cMax.mag) { cMax = c; bpm = b; }
    }
    bpm = Math.round(bpm * 100) / 100;

    // phase : décalage qui aligne le mieux la grille sur les attaques
    const P = 60 * FPS / bpm;
    let meilleurePhase = (cMax.phase / (2 * Math.PI)) * P;
    if (meilleurePhase < 0) meilleurePhase += P;
    // temps fort de la mesure : celui des 4 temps qui frappe le plus (souvent la grosse caisse)
    let meilleurTemps = 0, maxTemps = -Infinity;
    for (let b = 0; b < 4; b++) {
      let s = 0;
      for (let t = meilleurePhase + b * P; t < env.length; t += 4 * P) s += env[Math.round(t)] || 0;
      if (s > maxTemps) { maxTemps = s; meilleurTemps = b; }
    }
    const offset = (meilleurePhase + meilleurTemps * P) / FPS;
    const moyenne = somme / (lagMax - lagMin + 1);
    const confiance = Math.max(0, Math.min(1, (ac[meilleur] / (moyenne || 1) - 1) / 3));
    return { bpm, offset: offset % (4 * 60 / bpm), confiance };
  }

  // Grille rythmique : position d'un instant t (en secondes dans l'instru) par rapport aux temps
  function grille(bpm, offset) {
    const periode = 60 / bpm;
    return {
      bpm, offset, periode,
      // numéro de temps (fractionnaire) à l'instant t
      temps: (t) => (t - offset) / periode,
      // écart signé (s) à la subdivision la plus proche (div = 2 → croches)
      ecart: (t, div = 2) => {
        const p = periode / div;
        const x = (t - offset) / p;
        return (x - Math.round(x)) * p;
      }
    };
  }

  // Tap tempo : moyenne des intervalles entre les tapes
  function creerTap() {
    let tapes = [];
    return (t = performance.now() / 1000) => {
      if (tapes.length && t - tapes[tapes.length - 1] > 2) tapes = [];
      tapes.push(t);
      if (tapes.length > 8) tapes.shift();
      if (tapes.length < 3) return null;
      const inter = (tapes[tapes.length - 1] - tapes[0]) / (tapes.length - 1);
      return Math.round(600 / inter) / 10;
    };
  }

  // Détecteur d'attaques de la voix (et de présence de voix) à partir d'un AnalyserNode
  function creerDetecteurVoix(analyseur) {
    const buf = new Float32Array(analyseur.fftSize);
    let lent = 0.01, plancher = 0.01, precedent = 0, derniereAttaque = -1, derniereVoix = -1;
    return (t) => {
      analyseur.getFloatTimeDomainData(buf);
      let s = 0;
      for (let k = 0; k < buf.length; k++) s += buf[k] * buf[k];
      const rms = Math.sqrt(s / buf.length);
      // plancher de bruit : suit lentement les minimums
      plancher = rms < plancher ? rms : plancher + (rms - plancher) * 0.002;
      lent += (rms - lent) * 0.05;
      const seuilVoix = Math.max(0.012, plancher * 3);
      const voix = rms > seuilVoix;
      if (voix) derniereVoix = t;
      let attaque = null;
      if (voix && rms > lent * 1.35 && rms > precedent * 1.15 && t - derniereAttaque > 0.09) {
        attaque = { t, force: Math.min(1, rms / (lent * 3)) };
        derniereAttaque = t;
      }
      precedent = rms;
      return { rms, voix, silence: derniereVoix < 0 ? 0 : t - derniereVoix, attaque };
    };
  }

  const api = { detecterBPM, grille, creerTap, creerDetecteurVoix, enveloppeAttaques };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tempo = api;
})(typeof window !== 'undefined' ? window : globalThis);
