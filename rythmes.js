/*
 * Boîte à rythmes : des instrus synthétisées en direct (aucun fichier, aucun droit d'auteur).
 * 5 styles, BPM au choix, en boucle de 4 mesures (grosse caisse, caisse claire, charley, basse, accords).
 */
(function (root) {
  // Pas de 16e de note : 16 pas par mesure
  const STYLES = {
    boombap: {
      nom: 'Boom bap', bpm: 90, swing: 0.18, nappe: 0.07, basse808: false,
      kick: [0, 6, 8, 11], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], ouvert: [14], clap: []
    },
    trap: {
      nom: 'Trap', bpm: 140, swing: 0, nappe: 0.045, basse808: true,
      kick: [0, 7, 10], snare: [], clap: [8], hat: [...Array(16).keys()], ouvert: [], roulement: [12, 13, 14, 15]
    },
    drill: {
      nom: 'Drill', bpm: 142, swing: 0, nappe: 0.04, basse808: true,
      kick: [0, 10], snare: [8, 15], clap: [], hat: [0, 3, 6, 8, 11, 14], ouvert: [], glisse: true
    },
    lofi: {
      nom: 'Lo-fi', bpm: 80, swing: 0.22, nappe: 0.09, basse808: false, vinyle: true,
      kick: [0, 9], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], ouvert: [], clap: []
    },
    oldschool: {
      nom: 'Old school', bpm: 98, swing: 0.08, nappe: 0.05, basse808: false,
      kick: [0, 8, 10], snare: [4, 12], clap: [4, 12], hat: [...Array(16).keys()], ouvert: [6, 14]
    }
  };

  // Progression en la mineur : Am – F – C – G (une mesure par accord)
  const ACCORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  const BASSES = [55, 43.65, 65.41, 49];

  function creer(ctx, sortie) {
    const maitre = ctx.createGain();
    maitre.gain.value = 0.85;
    maitre.connect(sortie);

    // bruit blanc partagé (caisse claire, charley, vinyle)
    const bruit = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const donnees = bruit.getChannelData(0);
    for (let k = 0; k < donnees.length; k++) donnees[k] = Math.random() * 2 - 1;

    let style = STYLES.boombap, bpm = 90, debut = 0, prochain = 0, numero = 0, minuterie = null, enCours = false, vinyle = null;

    const enveloppe = (gain, t, pic, duree) => {
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(pic, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    };

    function kick(t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      enveloppe(g, t, 1, 0.45);
      o.connect(g).connect(maitre);
      o.start(t); o.stop(t + 0.5);
    }

    function bruitFiltre(t, { type = 'highpass', freq = 1000, pic = 0.5, duree = 0.2 }) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = bruit;
      f.type = type; f.frequency.value = freq;
      enveloppe(g, t, pic, duree);
      s.connect(f).connect(g).connect(maitre);
      s.start(t, Math.random() * 0.5); s.stop(t + duree + 0.05);
    }

    function snare(t) {
      bruitFiltre(t, { freq: 1200, pic: 0.45, duree: 0.2 });
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 185;
      enveloppe(g, t, 0.35, 0.12);
      o.connect(g).connect(maitre);
      o.start(t); o.stop(t + 0.15);
    }

    function clap(t) {
      for (let k = 0; k < 3; k++) bruitFiltre(t + k * 0.012, { type: 'bandpass', freq: 1500, pic: 0.35, duree: 0.12 });
    }

    function hat(t, ouvert, fort = 1) {
      bruitFiltre(t, { freq: 7500, pic: (ouvert ? 0.12 : 0.08) * fort, duree: ouvert ? 0.28 : 0.045 });
    }

    function basse(t, freq, duree, glisse) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = style.basse808 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(glisse ? freq * 1.5 : freq, t);
      if (glisse) o.frequency.exponentialRampToValueAtTime(freq, t + 0.15);
      f.type = 'lowpass'; f.frequency.value = 400;
      enveloppe(g, t, style.basse808 ? 0.55 : 0.35, duree);
      o.connect(f).connect(g).connect(maitre);
      o.start(t); o.stop(t + duree + 0.05);
    }

    function nappe(t, accord, duree) {
      const g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1100;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(style.nappe, t + 0.08);
      g.gain.setValueAtTime(style.nappe, t + duree * 0.7);
      g.gain.linearRampToValueAtTime(0.0001, t + duree);
      f.connect(g).connect(maitre);
      for (const freq of accord) {
        for (const desaccord of [-4, 4]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = desaccord;
          o.connect(f);
          o.start(t); o.stop(t + duree + 0.05);
        }
      }
    }

    function jouerPas(n, t) {
      const pas = n % 16, mesure = Math.floor(n / 16) % 4;
      const duree16 = 60 / bpm / 4;
      if (pas === 0) nappe(t, ACCORDS[mesure], duree16 * 16);
      if (style.kick.includes(pas)) {
        kick(t);
        basse(t, BASSES[mesure], style.basse808 ? duree16 * 6 : duree16 * 3, style.glisse && pas !== 0);
      }
      if (style.snare.includes(pas)) snare(t);
      if (style.clap.includes(pas)) clap(t);
      if (style.hat.includes(pas)) hat(t, style.ouvert.includes(pas), pas % 4 === 0 ? 1 : 0.7);
      // roulements de charley (trap) sur la dernière mesure
      if (style.roulement && mesure === 3 && style.roulement.includes(pas)) hat(t + duree16 / 2, false, 0.6);
    }

    function planifier() {
      const duree16 = 60 / bpm / 4;
      while (prochain < ctx.currentTime + 0.12) {
        // swing : les contretemps de croche arrivent un peu en retard
        const decale = (numero % 4 === 2) ? style.swing * duree16 : 0;
        jouerPas(numero, prochain + decale);
        prochain += duree16;
        numero++;
      }
    }

    function demarrerVinyle() {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = bruit; s.loop = true;
      f.type = 'bandpass'; f.frequency.value = 3000;
      g.gain.value = 0.012;
      s.connect(f).connect(g).connect(maitre);
      s.start();
      vinyle = s;
    }

    return {
      STYLES,
      get enCours() { return enCours; },
      get bpm() { return bpm; },
      // quand : instant (horloge audio) du premier temps
      demarrer(nouveauBpm, idStyle = 'boombap', quand = ctx.currentTime + 0.06) {
        this.arreter();
        style = STYLES[idStyle] || STYLES.boombap;
        bpm = nouveauBpm || style.bpm;
        debut = quand; prochain = quand; numero = 0;
        enCours = true;
        if (style.vinyle) demarrerVinyle();
        planifier();
        minuterie = setInterval(planifier, 25);
      },
      arreter() {
        clearInterval(minuterie);
        minuterie = null;
        enCours = false;
        try { vinyle && vinyle.stop(); } catch { /* déjà arrêté */ }
        vinyle = null;
      },
      // position dans l'instru (secondes depuis le premier temps), comme audio.currentTime
      position() { return enCours ? ctx.currentTime - debut : null; }
    };
  }

  root.Rythmes = { creer, STYLES };
})(typeof window !== 'undefined' ? window : globalThis);
