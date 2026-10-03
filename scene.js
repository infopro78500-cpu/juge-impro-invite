/*
 * Scène : tout le spectacle dessiné dans un canvas (affichage live + export vidéo + carte de score).
 * Formats : '16:9' (1920×1080, piste horizontale) ou '9:16' (1080×1920, piste verticale façon Guitar Hero).
 */
(function (root) {
  const POLICE = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  const C = {
    texte: '#f4f4fa', doux: '#9a9ab5', or: '#ffcc00', rose: '#ff3d6e', vert: '#3ddc97', bleu: '#4fb3ff',
    violet: '#c77dff', cyan: '#00e5ff'
  };
  const COULEUR_MULT = { 1: '#9a9ab5', 2: C.bleu, 3: C.vert, 4: C.or };
  const COULEUR_ATTAQUE = { pile: C.or, bien: C.vert, hors: '#ff6b81', neutre: '#d0d0e0' };

  function creer(canvas) {
    const ctx = canvas.getContext('2d');
    let format = '16:9', W = 1920, H = 1080, u = 1;
    let enregistreur = null, morceaux = [];

    function setFormat(f) {
      format = f === '9:16' ? '9:16' : '16:9';
      [W, H] = format === '9:16' ? [1080, 1920] : [1920, 1080];
      canvas.width = W; canvas.height = H;
      u = Math.min(W, H) / 1080;
    }
    setFormat('16:9');

    const police = (taille, graisse = 800) => `${graisse} ${Math.round(taille * u)}px ${POLICE}`;
    const vertical = () => format === '9:16';

    function texte(str, x, y, { taille = 40, graisse = 800, couleur = C.texte, align = 'left', base = 'alphabetic', ombre = 0, alpha = 1, maxL } = {}) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = police(taille, graisse);
      ctx.textAlign = align; ctx.textBaseline = base;
      if (ombre) { ctx.shadowColor = couleur; ctx.shadowBlur = ombre * u; }
      ctx.fillStyle = couleur;
      ctx.fillText(str, x, y, maxL);
      ctx.restore();
    }

    function rect(x, y, w, h, r, couleur, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = couleur;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r * u);
      ctx.fill();
      ctx.restore();
    }

    // ---------- Fond : couleur selon la hype, flash sur chaque temps ----------
    function fond(e) {
      const h = e.partie ? e.partie.hype / 100 : 0.3;
      const g = ctx.createRadialGradient(W / 2, H * 0.45, 50 * u, W / 2, H * 0.45, Math.max(W, H) * 0.75);
      const chaud = `rgb(${Math.round(30 + 70 * h)}, ${Math.round(14 + 6 * h)}, ${Math.round(46 - 20 * h)})`;
      g.addColorStop(0, chaud);
      g.addColorStop(1, '#07070c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (e.grille && e.tInstru != null && e.enCours) {
        const b = e.grille.temps(e.tInstru);
        const frac = b - Math.floor(b);
        const fort = ((Math.floor(b) % 4) + 4) % 4 === 0;
        ctx.fillStyle = `rgba(255, 204, 0, ${(fort ? 0.09 : 0.045) * Math.pow(1 - frac, 3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // ---------- En-tête : titre, chrono, score ----------
    function entete(e) {
      const p = e.partie;
      const score = p ? p.score : 0;
      if (p && p.joueurs) return enteteFeaturing(e);
      const fil = e.habillage && e.habillage.filigrane ? e.habillage.marque : null;
      if (vertical()) {
        if (fil) signature(fil, W / 2, 90 * u, { taille: 44, align: 'center' });
        else texte("JUGE D'IMPRO", W / 2, 90 * u, { taille: 44, align: 'center', couleur: C.or });
        texte(score.toLocaleString('fr-FR'), W / 2, 230 * u, { taille: 120, graisse: 900, align: 'center', ombre: 25 });
        texte(e.chrono || '', W / 2, 290 * u, { taille: 40, graisse: 700, align: 'center', couleur: e.chronoAlerte ? C.rose : C.doux });
      } else {
        if (fil) signature(fil, 60 * u, 90 * u, { taille: 42 });
        else texte("JUGE D'IMPRO", 60 * u, 90 * u, { taille: 42, couleur: C.or });
        if (e.niveau) texte(`Niv. ${e.niveau.num} · ${e.niveau.titre}`, 60 * u, 132 * u, { taille: 26, graisse: 600, couleur: C.doux });
        texte(e.chrono || '', W / 2, 100 * u, { taille: 64, graisse: 800, align: 'center', couleur: e.chronoAlerte ? C.rose : C.texte });
        texte(score.toLocaleString('fr-FR'), W - 60 * u, 110 * u, { taille: 96, graisse: 900, align: 'right', ombre: 25 });
        texte('POINTS', W - 60 * u, 145 * u, { taille: 24, graisse: 700, align: 'right', couleur: C.doux });
      }
    }

    // Featuring : un score par rappeur, celui qui a le micro est mis en avant
    function enteteFeaturing(e) {
      const p = e.partie;
      const n = p.joueurs.length;
      if (e.habillage && e.habillage.filigrane && e.habillage.marque) signature(e.habillage.marque, 40 * u, 52 * u, { taille: 24 });
      const actif = p.feat && p.feat.actif != null ? p.feat.actif : -1;
      const yChrono = vertical() ? 80 * u : 70 * u;
      texte(e.chrono || '', W / 2, yChrono, { taille: vertical() ? 44 : 48, graisse: 800, align: 'center', couleur: e.chronoAlerte ? C.rose : C.texte });
      const y = vertical() ? 250 * u : 160 * u;
      p.joueurs.forEach((j, k) => {
        const x = W * (k + 0.5) / n;
        const on = k === actif;
        if (on) rect(x - (W / n) * 0.35, y - 120 * u, (W / n) * 0.7, 150 * u, 18, 'rgba(0,229,255,.12)');
        texte(`${on ? '🎤 ' : ''}${j.nom.toUpperCase()}`, x, y - 70 * u, { taille: 30, graisse: 800, align: 'center', couleur: on ? C.cyan : C.doux, maxL: (W / n) * 0.85 });
        texte(j.score.toLocaleString('fr-FR'), x, y + 5 * u, { taille: n > 2 ? 64 : 80, graisse: 900, align: 'center', couleur: on ? C.texte : '#b8b8cc', ombre: on ? 20 : 0 });
        if (p.battle) pastillesRounds(x, y + 48 * u, p.battle, k);
      });
      if (p.battle) {
        const r = Math.min(p.battle.rounds, (p.feat && p.feat.round != null ? p.feat.round : 0) + 1);
        texte(`🥊 ROUND ${r}/${p.battle.rounds}`, W / 2, yChrono + 46 * u, { taille: 28, graisse: 900, align: 'center', couleur: C.rose });
      }
    }

    // Une pastille par round : dorée si gagné par ce MC, grise si perdu ou nul, vide si pas encore jugé
    function pastillesRounds(x, y, b, k) {
      const pas = 34 * u;
      b.resultats.forEach((r, i) => {
        const cx = x + (i - (b.rounds - 1) / 2) * pas;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, y, 11 * u, 0, Math.PI * 2);
        if (r && r.vainqueur === k) { ctx.fillStyle = C.or; ctx.shadowColor = C.or; ctx.shadowBlur = 14 * u; ctx.fill(); }
        else if (r) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill(); }
        else { ctx.lineWidth = 3 * u; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke(); }
        ctx.restore();
      });
    }

    // ---------- Multiplicateur, combo et jauge de hype ----------
    function jauges(e) {
      const p = e.partie;
      if (!p) return;
      const [, libelle, emoji] = p.paliersHype();
      const mult = p.multiplicateur;
      const cm = COULEUR_MULT[mult];
      let cx, cy, jx, jy, jw;
      if (vertical()) { cx = 150 * u; cy = 420 * u; jx = 270 * u; jy = 400 * u; jw = W - 330 * u; }
      else { cx = 150 * u; cy = 300 * u; jx = 270 * u; jy = 280 * u; jw = 520 * u; }
      // pastille ×N
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, 78 * u, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
      ctx.lineWidth = 8 * u; ctx.strokeStyle = cm; ctx.shadowColor = cm; ctx.shadowBlur = mult > 1 ? 30 * u : 0;
      ctx.stroke();
      ctx.restore();
      texte(`×${mult}`, cx, cy + 22 * u, { taille: 64, graisse: 900, align: 'center', couleur: cm });
      texte(p.combo > 0 ? `COMBO ${p.combo}` : 'COMBO', cx, cy + 115 * u, { taille: 26, graisse: 800, align: 'center', couleur: p.combo > 0 ? C.texte : C.doux });
      // jauge de hype
      texte(`${emoji}  ${libelle}`, jx, jy - 4 * u, { taille: 30, graisse: 700 });
      rect(jx, jy + 14 * u, jw, 26 * u, 13, 'rgba(255,255,255,.1)');
      const grad = ctx.createLinearGradient(jx, 0, jx + jw, 0);
      grad.addColorStop(0, C.bleu); grad.addColorStop(0.5, C.or); grad.addColorStop(1, C.rose);
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(jx, jy + 14 * u, Math.max(26 * u, jw * p.hype / 100), 26 * u, 13 * u); ctx.fill();
      ctx.restore();
      texte('HYPE', jx, jy + 72 * u, { taille: 22, graisse: 800, couleur: C.doux });
    }

    // ---------- Bandeau : objectifs du mode, mot en rafale, ou tour de featuring ----------
    function bandeau(e) {
      const p = e.partie;
      if (!p) return;
      const x = 60 * u, y = vertical() ? 560 * u : 440 * u;
      const w = vertical() ? W - 120 * u : 700 * u;

      if (p.feat && p.feat.actif != null) {
        const f = p.feat;
        const h = 150 * u;
        rect(x, y, w, h, 16, 'rgba(0,0,0,.5)');
        rect(x, y, 8 * u, h, 4, C.cyan);
        texte('AU MICRO', x + 28 * u, y + 36 * u, { taille: 22, graisse: 800, couleur: C.doux });
        texte(p.joueurs[f.actif].nom.toUpperCase(), x + 28 * u, y + 92 * u, { taille: 54, graisse: 900, couleur: C.cyan, ombre: 20, maxL: w * 0.6 });
        const ensuite = f.suivant != null && p.joueurs[f.suivant] ? `ensuite : ${p.joueurs[f.suivant].nom}` : 'dernier passage';
        texte(ensuite, x + w - 24 * u, y + 36 * u, { taille: 22, graisse: 700, align: 'right', couleur: f.suivant != null ? C.doux : C.rose, maxL: w * 0.4 });
        texte(`${f.mesuresRestantes} mes.`, x + w - 24 * u, y + 92 * u, { taille: 36, graisse: 900, align: 'right', couleur: f.mesuresRestantes <= 1 ? C.rose : C.texte });
        rect(x + 28 * u, y + h - 30 * u, w - 56 * u, 10 * u, 5, 'rgba(255,255,255,.12)');
        rect(x + 28 * u, y + h - 30 * u, (w - 56 * u) * Math.max(0, Math.min(1, f.reste / f.dureeTour)), 10 * u, 5, f.mesuresRestantes <= 1 ? C.rose : C.cyan);
        return;
      }

      if (p.rafale && p.rafale.courant) {
        const r = p.rafale, m = r.courant;
        const h = 150 * u;
        const age = e.t - m.t0;
        const pop = Math.min(1, age / 0.25);
        rect(x, y, w, h, 16, 'rgba(0,0,0,.5)');
        rect(x, y, 8 * u, h, 4, m.place ? C.vert : C.violet);
        texte(m.place ? 'PLACÉ ✓' : 'MOT À PLACER', x + 28 * u, y + 36 * u, { taille: 22, graisse: 800, couleur: m.place ? C.vert : C.doux });
        texte(`${r.places}/${r.total} placés`, x + w - 24 * u, y + 36 * u, { taille: 22, graisse: 800, align: 'right', couleur: C.doux });
        ctx.save();
        ctx.translate(x + 28 * u, y + 96 * u);
        ctx.scale(1.3 - 0.3 * pop, 1.3 - 0.3 * pop);
        texte(m.mot.toUpperCase(), 0, 0, { taille: 60, graisse: 900, couleur: m.place ? C.vert : C.or, ombre: 25, maxL: m.pseudo ? w * 0.62 : w - 60 * u });
        ctx.restore();
        if (m.pseudo) texte(`📺 de ${m.pseudo}`, x + w - 24 * u, y + 92 * u, { taille: 20, graisse: 700, align: 'right', couleur: '#ff8c42', maxL: w * 0.32 });
        const reste = Math.max(0, Math.min(1, (m.t1 - e.t) / (m.t1 - m.t0)));
        rect(x + 28 * u, y + h - 30 * u, w - 56 * u, 10 * u, 5, 'rgba(255,255,255,.12)');
        rect(x + 28 * u, y + h - 30 * u, (w - 56 * u) * reste, 10 * u, 5, reste < 0.25 ? C.rose : C.violet);
        return;
      }

      const objs = p.objectifs || [];
      if (!objs.length) { cartePublic(e, x, y, w); return; }
      const lh = vertical() ? 38 * u : 44 * u;
      const h = 56 * u + objs.length * lh;
      rect(x, y, w, h, 16, 'rgba(0,0,0,.45)');
      rect(x, y, 8 * u, h, 4, C.violet);
      texte(`${p.modeIcone} MODE ${p.modeNom.toUpperCase()}`, x + 28 * u, y + 38 * u, { taille: 24, graisse: 800, couleur: C.violet });
      objs.forEach((o, k) => {
        const yy = y + 56 * u + (k + 0.75) * lh;
        const [icone, couleur] = o.etat === 'ok' ? ['✓', C.vert] : o.etat === 'rate' ? ['✗', C.rose] : ['•', C.texte];
        texte(`${icone} ${o.libelle} : ${o.texte}`, x + 28 * u, yy, { taille: vertical() ? 25 : 27, graisse: 700, couleur, maxL: w - 190 * u });
        texte(o.progression || '', x + w - 24 * u, yy, { taille: 24, graisse: 800, align: 'right', couleur: o.etat === 'encours' ? C.doux : couleur });
      });
      cartePublic(e, x, y + h + 16 * u, w);
    }

    // Public en live : le mot proposé par un spectateur, à placer avant la fin de la barre
    function cartePublic(e, x, y, w) {
      const c = e.partie.public && e.partie.public.courant;
      if (!c) return;
      const h = 124 * u;
      const reste = Math.max(0, Math.min(1, (c.t1 - e.t) / (c.t1 - c.t0)));
      rect(x, y, w, h, 16, 'rgba(0,0,0,.5)');
      rect(x, y, 8 * u, h, 4, c.place ? C.vert : '#ff8c42');
      texte(c.place ? 'MOT DU PUBLIC PLACÉ ✓' : '📺 LE PUBLIC PROPOSE', x + 28 * u, y + 34 * u, { taille: 22, graisse: 800, couleur: c.place ? C.vert : '#ff8c42' });
      if (c.pseudo) texte(`de ${c.pseudo}`, x + w - 24 * u, y + 34 * u, { taille: 20, graisse: 700, align: 'right', couleur: C.doux, maxL: w * 0.4 });
      texte(c.mot.toUpperCase(), x + 28 * u, y + 88 * u, { taille: 50, graisse: 900, couleur: c.place ? C.vert : C.texte, ombre: 18, maxL: w - 60 * u });
      rect(x + 28 * u, y + h - 20 * u, w - 56 * u, 8 * u, 4, 'rgba(255,255,255,.12)');
      rect(x + 28 * u, y + h - 20 * u, (w - 56 * u) * reste, 8 * u, 4, reste < 0.25 ? C.rose : '#ff8c42');
    }

    // QR code du Public en live : grand sur l'écran titre, petit pendant l'impro
    function qrPublic(e, titre) {
      const pub = e.public;
      if (!pub || !pub.qr || (e.partie && e.partie.studio && !titre)) return;
      const v = vertical();
      const cote = (titre ? (v ? 230 : 250) : (v ? 120 : 150)) * u;
      const x = titre ? W - (v ? 60 : 70) * u - cote : W - 60 * u - cote;
      const y = titre ? H - (v ? 330 : 140) * u - cote : (v ? 40 * u : H - 260 * u - cote);
      const n = pub.qr.length, marge = 3, pas = cote / (n + 2 * marge);
      rect(x, y, cote, cote, 10, '#ffffff');
      ctx.fillStyle = '#000000';
      pub.qr.forEach((ligne, r) => ligne.forEach((noir, k) => {
        if (noir) ctx.fillRect(x + (k + marge) * pas, y + (r + marge) * pas, pas + 0.6, pas + 0.6);
      }));
      // la légende reste dans l'image : calée sur le bord droit du QR
      texte(titre ? '📲 ENVOIE TES MOTS AU RAPPEUR' : '📲 TES MOTS', x + cote, y - 14 * u, { taille: titre ? 24 : 18, graisse: 900, align: 'right', couleur: '#ff8c42' });
      texte(`code ${pub.code} · ${pub.recus} mot${pub.recus > 1 ? 's' : ''} · 🔥 ${pub.flammes}`, x + cote / 2, y + cote + (titre ? 30 : 24) * u,
        { taille: titre ? 22 : 16, graisse: 700, align: 'center', couleur: C.doux });
    }

    // ---------- Paroles (rimes en couleur) ----------
    function paroles(e) {
      const lignes = e.lignes || [];
      const zone = vertical()
        ? { x: 60 * u, y: 730 * u, w: W - 120 * u, h: 370 * u, taille: 50 }
        : { x: 840 * u, y: 230 * u, w: W - 900 * u, h: 320 * u, taille: 46 };
      // découpe en lignes visuelles
      ctx.font = police(zone.taille, 700);
      const espace = ctx.measureText(' ').width;
      const visuelles = [];
      for (const l of lignes) {
        let courante = [], largeur = 0;
        for (const m of l.mots) {
          const w = ctx.measureText(m.texte).width;
          if (largeur + w > zone.w && courante.length) { visuelles.push({ mots: courante, interim: l.interim }); courante = []; largeur = 0; }
          courante.push({ ...m, w });
          largeur += w + espace;
        }
        if (courante.length) visuelles.push({ mots: courante, interim: l.interim });
      }
      const pas = zone.taille * 1.35 * u;
      const max = Math.floor(zone.h / pas);
      const affichees = visuelles.slice(-max);
      affichees.forEach((l, k) => {
        const age = affichees.length - 1 - k;
        const alpha = l.interim ? 0.55 : Math.max(0.3, 1 - age * 0.22);
        let x = zone.x;
        const y = zone.y + (k + 1) * pas;
        for (const m of l.mots) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = police(zone.taille, m.couleur ? 900 : 700);
          ctx.fillStyle = m.couleur || (l.interim ? C.doux : C.texte);
          if (m.couleur) { ctx.shadowColor = m.couleur; ctx.shadowBlur = 18 * u; }
          ctx.fillText(m.texte, x, y);
          ctx.restore();
          x += m.w + espace;
        }
      });
      if (!affichees.length && e.enCours) {
        const p = e.partie;
        const qui = p && p.joueurs && p.feat && p.feat.actif != null ? `🎤  ${p.joueurs[p.feat.actif].nom}…` : '🎤  À toi…';
        texte(qui, zone.x, zone.y + pas, { taille: zone.taille, graisse: 700, couleur: C.doux });
      }
    }

    // ---------- Prompteur (prise studio) : le brouillon défile en rythme ----------
    function prompteur(e) {
      const st = e.partie.studio;
      const v = vertical();
      const z = v ? { x: 60 * u, y: 735 * u, w: W - 120 * u, h: 440 * u } : { x: 840 * u, y: 205 * u, w: W - 900 * u, h: 590 * u };
      const n = st.lignes.length;
      const avant = e.t < st.depart;
      const fin = st.ligne >= n;
      const courante = Math.max(0, Math.min(st.ligne, n - 1));
      ctx.save();
      ctx.beginPath(); ctx.rect(z.x - 10 * u, z.y, z.w + 20 * u, z.h); ctx.clip();
      let y = z.y + 34 * u;
      if (avant) {
        const mesures = Math.ceil((st.depart - e.t) / st.uneMesure - 1e-6);
        texte(`LE TEXTE ARRIVE DANS ${mesures} MESURE${mesures > 1 ? 'S' : ''}`, z.x, y, { taille: 28, graisse: 900, couleur: C.or, ombre: 16 });
      } else if (!fin) texte(`LIGNE ${courante + 1}/${n}`, z.x, y, { taille: 26, graisse: 800, couleur: C.doux });
      else texte('PRISE TERMINÉE', z.x, y, { taille: 28, graisse: 900, couleur: C.vert });
      y += 26 * u;

      // une ligne du brouillon, coupée à la largeur de la zone ; les mots déjà dits passent en vert
      const ligne = (k, taille, alpha, etat) => {
        if (k < 0 || k >= n) return;
        const mots = st.attendus.filter((a) => a.ligne === k);
        ctx.font = police(taille, 800);
        const espace = ctx.measureText(' ').width;
        let x = z.x;
        y += taille * 1.3 * u;
        for (const a of mots) {
          const w = ctx.measureText(a.brut).width;
          if (x > z.x && x + w > z.x + z.w) { x = z.x; y += taille * 1.3 * u; }
          const couleur = a.dit ? C.vert : etat === 'passee' ? C.rose : C.texte;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = police(taille, a.dit || etat === 'active' ? 900 : 700);
          ctx.fillStyle = couleur;
          if (a.dit && etat === 'active') { ctx.shadowColor = C.vert; ctx.shadowBlur = 16 * u; }
          ctx.fillText(a.brut, x, y);
          ctx.restore();
          x += w + espace;
        }
        y += 14 * u;
      };

      if (!avant && courante > 0 && !fin) ligne(courante - 1, v ? 32 : 30, 0.5, 'passee');
      if (fin) ligne(n - 1, v ? 32 : 30, 0.5, 'passee');
      else {
        ligne(courante, v ? 54 : 50, avant ? 0.75 : 1, avant ? 'future' : 'active');
        // avancée dans la ligne en cours
        if (!avant) {
          const l = st.lignes[courante];
          const frac = Math.max(0, Math.min(1, (e.t - l.t0) / st.dureeLigne));
          rect(z.x, y, z.w, 8 * u, 4, 'rgba(255,255,255,.12)');
          rect(z.x, y, z.w * frac, 8 * u, 4, frac > 0.8 ? C.rose : C.cyan);
          y += 24 * u;
        }
        ligne(courante + 1, v ? 36 : 34, 0.55, 'future');
        ligne(courante + 2, v ? 36 : 34, 0.3, 'future');
      }
      ctx.restore();
    }

    // ---------- Piste rythmique ----------
    function piste(e) {
      const p = e.partie;
      const vert = vertical();
      const z = vert
        ? { x: W / 2 - 300 * u, y: 1200 * u, w: 600 * u, h: 620 * u }
        : { x: 40 * u, y: H - 250 * u, w: W - 80 * u, h: 190 * u };
      rect(z.x, z.y, z.w, z.h, 18, 'rgba(0,0,0,.5)');
      const futur = 2.6, passe = vert ? 0.9 : 1.4;
      // position le long de la piste : 0 = ligne de frappe ; dt > 0 = dans le futur
      const longueur = vert ? z.h : z.w;
      const pxs = longueur / (futur + passe);
      const frappe = vert ? z.y + z.h - passe * pxs : z.x + passe * pxs;
      const pos = (dt) => vert ? frappe - dt * pxs : frappe + dt * pxs;

      ctx.save();
      ctx.beginPath(); ctx.roundRect(z.x, z.y, z.w, z.h, 18 * u); ctx.clip();

      if (e.grille && e.tInstru != null) {
        const g = e.grille;
        const b0 = Math.floor(g.temps(e.tInstru - passe) * 2) / 2;
        for (let b = b0; g.offset + b * g.periode <= e.tInstru + futur; b += 0.5) {
          const dt = g.offset + b * g.periode - e.tInstru;
          const entier = Number.isInteger(b);
          const fort = entier && ((b % 4) + 4) % 4 === 0;
          const q = pos(dt);
          ctx.fillStyle = fort ? 'rgba(255,204,0,.85)' : entier ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.12)';
          const ep = (fort ? 8 : entier ? 4 : 2) * u;
          if (vert) ctx.fillRect(z.x + 30 * u, q - ep / 2, z.w - 60 * u, ep);
          else ctx.fillRect(q - ep / 2, z.y + 24 * u, ep, z.h - 48 * u);
        }
      } else {
        texte(e.enCours ? 'Charge une instru pour afficher les temps' : '', z.x + z.w / 2, z.y + z.h / 2 + 12 * u,
          { taille: 26, graisse: 600, align: 'center', couleur: C.doux });
      }

      // marqueurs de rimes / figures
      if (p) for (const m of p.marqueurs) {
        const q = pos(m.t - e.t);
        if (vert) texte(m.texte, z.x + z.w - 20 * u, q - 10 * u, { taille: 22, graisse: 800, align: 'right', couleur: m.couleur });
        else texte(m.texte, q + 8 * u, z.y + 44 * u, { taille: 22, graisse: 800, couleur: m.couleur });
      }
      // attaques de la voix
      if (p) for (const a of p.attaques) {
        const q = pos(a.t - e.t);
        const r = (a.qualite === 'pile' ? 16 : 11) * u;
        ctx.save();
        ctx.beginPath();
        if (vert) ctx.arc(z.x + z.w / 2 + Math.max(-1, Math.min(1, a.ecart * 8)) * 120 * u, q, r, 0, Math.PI * 2);
        else ctx.arc(q, z.y + z.h / 2 + Math.max(-1, Math.min(1, a.ecart * 8)) * 50 * u, r, 0, Math.PI * 2);
        ctx.fillStyle = COULEUR_ATTAQUE[a.qualite];
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = a.qualite === 'pile' ? 20 * u : 0;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // ligne de frappe (s'illumine sur le temps)
      let eclat = 0.4;
      if (e.grille && e.tInstru != null) {
        const b = e.grille.temps(e.tInstru);
        eclat = 0.4 + 0.6 * Math.pow(1 - (b - Math.floor(b)), 4);
      }
      ctx.save();
      ctx.strokeStyle = `rgba(0, 229, 255, ${eclat})`;
      ctx.shadowColor = C.cyan; ctx.shadowBlur = 25 * u * eclat;
      ctx.lineWidth = 6 * u;
      ctx.beginPath();
      if (vert) { ctx.moveTo(z.x + 10 * u, frappe); ctx.lineTo(z.x + z.w - 10 * u, frappe); }
      else { ctx.moveTo(frappe, z.y + 10 * u); ctx.lineTo(frappe, z.y + z.h - 10 * u); }
      ctx.stroke();
      ctx.restore();

      // légende + précision
      const prec = p && p.tauxPrecision ? p.tauxPrecision() : null;
      const lx = vert ? z.x : z.x + 20 * u, ly = vert ? z.y - 20 * u : z.y - 16 * u;
      const bpm = e.grille ? `${Math.round(e.grille.bpm)} BPM` : '';
      texte(`${bpm}${prec != null ? `   ·   PRÉCISION ${Math.round(prec * 100)} %` : ''}`, lx, ly, { taille: 24, graisse: 800, couleur: C.doux });
    }

    // ---------- Pop-ups ----------
    function popups(e) {
      const p = e.partie;
      if (!p) return;
      const liste = p.popups.slice(-2);
      const cx = W / 2;
      const baseY = vertical() ? 1290 * u : 735 * u;
      liste.forEach((x, k) => {
        const age = e.t - x.t0;
        const entree = Math.min(1, age / 0.15);
        const sortie = Math.min(1, Math.max(0, (x.duree - age) / 0.4));
        const echelle = (1.35 - 0.35 * entree) * x.taille;
        const y = baseY - (liste.length - 1 - k) * 110 * u - age * 30 * u;
        ctx.save();
        ctx.translate(cx, y);
        ctx.scale(echelle, echelle);
        texte(x.texte, 0, 0, { taille: vertical() ? 60 : 64, graisse: 900, align: 'center', couleur: x.couleur, ombre: 30, alpha: sortie, maxL: (W - 100 * u) / echelle });
        if (x.sous) texte(x.sous, 0, 44 * u, { taille: 28, graisse: 600, align: 'center', couleur: C.texte, alpha: sortie * 0.85, maxL: (W - 120 * u) / echelle });
        ctx.restore();
      });
    }

    // ---------- Écran titre ----------
    // ---------- Tournoi : tableau (ou classement de l'open mic), prochain match, champion ----------
    function ecranTournoi(e) {
      const to = e.tournoi, v = vertical();
      const marge = (e.public && e.public.qr ? 340 : 80) * u;
      texte(`🏟️ ${to.nom.toUpperCase()}`, W / 2, (v ? 130 : 90) * u, { taille: v ? 54 : 50, graisse: 900, align: 'center', couleur: C.or, ombre: 24, maxL: W - 100 * u });
      if (to.fini) {
        texte('🏆 CHAMPION', W / 2, H * (v ? 0.36 : 0.38), { taille: v ? 60 : 56, graisse: 900, align: 'center', couleur: C.doux });
        texte(to.champion.toUpperCase(), W / 2, H * (v ? 0.36 : 0.38) + 150 * u, { taille: v ? 130 : 150, graisse: 900, align: 'center', couleur: C.or, ombre: 60, maxL: W - 100 * u });
        if (to.coeurPublic) texte(`📺 Coup de cœur du public : ${to.coeurPublic}`, W / 2, H * (v ? 0.36 : 0.38) + 250 * u, { taille: 40, graisse: 800, align: 'center', couleur: '#ff8c42', maxL: W - 100 * u });
      } else if (to.format === 'elimination') {
        if (v) {
          // vertical : les matchs, tour par tour
          let y = 240 * u;
          for (const tour of to.tours) {
            texte(tour.nom.toUpperCase(), W / 2, y, { taille: 30, graisse: 900, align: 'center', couleur: C.doux });
            y += 56 * u;
            for (const m of tour.matchs) {
              const nom = (n) => n || (m.detail === 'exempt' ? '—' : '?');
              texte(`${nom(m.a)}  VS  ${nom(m.b)}`, W / 2, y, { taille: 40, graisse: 800, align: 'center', couleur: m.vainqueur ? C.doux : C.texte, maxL: W - 120 * u });
              if (m.vainqueur && m.detail !== 'exempt') texte(`→ ${m.vainqueur}`, W / 2, y + 42 * u, { taille: 28, graisse: 800, align: 'center', couleur: C.or });
              y += (m.vainqueur && m.detail !== 'exempt' ? 96 : 60) * u;
            }
            y += 24 * u;
          }
        } else {
          // horizontal : le tableau, une colonne par tour, puis le champion
          const cols = to.tours.length + 1, x0 = 80 * u, largeur = (W - x0 - marge) / cols;
          const haut = 150 * u, bas = H - 260 * u;
          to.tours.forEach((tour, c) => {
            const x = x0 + c * largeur;
            texte(tour.nom.toUpperCase(), x + largeur * 0.45, haut, { taille: 24, graisse: 900, align: 'center', couleur: C.doux });
            const n = tour.matchs.length, pas = (bas - haut - 40 * u) / n;
            tour.matchs.forEach((m, i) => {
              const y = haut + 40 * u + pas * i + pas / 2 - 50 * u;
              rect(x, y, largeur * 0.9, 100 * u, 12, 'rgba(0,0,0,.45)');
              [m.a, m.b].forEach((nom, k) => {
                const gagne = nom && nom === m.vainqueur;
                texte(nom || (m.detail === 'exempt' ? '—' : '…'), x + 16 * u, y + (k ? 82 : 38) * u, { taille: 28, graisse: gagne ? 900 : 700, couleur: gagne ? C.or : m.vainqueur ? C.doux : C.texte, maxL: largeur * 0.9 - 32 * u });
              });
            });
          });
          const xc = x0 + (cols - 1) * largeur;
          texte('CHAMPION', xc + largeur * 0.45, haut, { taille: 24, graisse: 900, align: 'center', couleur: C.doux });
          texte('🏆 ?', xc + largeur * 0.45, (haut + bas) / 2, { taille: 50, graisse: 900, align: 'center', couleur: C.or });
        }
      } else {
        // open mic : classement de la soirée
        const cl = to.classement || [];
        let y = (v ? 260 : 190) * u;
        texte('CLASSEMENT DE LA SOIRÉE', W / 2, y, { taille: 30, graisse: 900, align: 'center', couleur: C.doux });
        y += 64 * u;
        cl.slice(0, v ? 10 : 6).forEach((x, k) => {
          texte(`${['🥇', '🥈', '🥉'][k] || k + 1}  ${x.nom}`, W / 2 - (v ? 420 : 500) * u, y, { taille: 42, graisse: 900, couleur: k === 0 ? C.or : C.texte, maxL: (v ? 560 : 640) * u });
          texte(`${x.score.toLocaleString('fr-FR')} pts`, W / 2 + (v ? 420 : 500) * u, y, { taille: 40, graisse: 800, align: 'right', couleur: C.vert });
          y += 64 * u;
        });
        if (!cl.length) texte('Personne n’est encore passé au micro', W / 2, y, { taille: 34, graisse: 700, align: 'center', couleur: C.doux });
      }
      const p = to.prochain;
      if (p && !to.fini) {
        texte(p.type === 'match' ? 'PROCHAIN MATCH' : 'AU MICRO', W / 2, H - (v ? 330 : 150) * u, { taille: 30, graisse: 900, align: 'center', couleur: C.rose });
        texte(p.type === 'match' ? `${p.a}  VS  ${p.b}` : p.nom, W / 2, H - (v ? 230 : 70) * u, { taille: v ? 70 : 76, graisse: 900, align: 'center', couleur: C.texte, ombre: 30, maxL: W - marge - 100 * u });
      }
    }

    // après la finale : le champion en haut de l'écran de fin
    function championTournoi(e) {
      const to = e.tournoi;
      if (!to || !to.fini) return;
      rect(0, 0, W, 112 * u, 0, '#ffcc00');
      texte(`🏆 ${to.champion.toUpperCase()} REMPORTE « ${to.nom.toUpperCase()} »`, W / 2, 74 * u, { taille: vertical() ? 40 : 46, graisse: 900, align: 'center', couleur: '#16081f', maxL: W - 60 * u });
    }

    // vote du public (tournoi) par-dessus la scène : les voix arrivent en direct
    function voteTournoi(e) {
      const vo = e.tournoi && e.tournoi.vote;
      if (!vo) return;
      const v = vertical(), n = vo.choix.length;
      const hauteurLigne = (n > 4 ? 48 : 64) * u;
      const haut = 120 * u + Math.min(n, 10) * hauteurLigne, larg = Math.min(W - 80 * u, 1100 * u);
      const x = (W - larg) / 2, y = (v ? H * 0.55 : H - haut - 40 * u);
      rect(x, y, larg, haut, 22, 'rgba(10,8,18,.92)');
      ctx.save(); ctx.strokeStyle = '#ff8c42'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.roundRect(x, y, larg, haut, 22 * u); ctx.stroke(); ctx.restore();
      texte(vo.fini ? '📺 RÉSULTAT DU VOTE' : `📺 ${vo.titre.toUpperCase()} · ${Math.ceil(vo.reste)} s`, W / 2, y + 56 * u, { taille: 34, graisse: 900, align: 'center', couleur: '#ff8c42', maxL: larg - 60 * u });
      const total = vo.compte.reduce((a, b) => a + b, 0) || 1, max = Math.max(...vo.compte);
      vo.choix.slice(0, 10).forEach((c, k) => {
        const yy = y + 100 * u + k * hauteurLigne;
        const part = vo.compte[k] / total;
        rect(x + 40 * u, yy, larg - 80 * u, hauteurLigne - 14 * u, 10, 'rgba(255,255,255,.08)');
        rect(x + 40 * u, yy, (larg - 80 * u) * part, hauteurLigne - 14 * u, 10, vo.fini && vo.compte[k] === max && max > 0 ? 'rgba(255,204,0,.55)' : 'rgba(255,140,66,.45)');
        texte(c, x + 60 * u, yy + hauteurLigne * 0.6, { taille: n > 4 ? 26 : 32, graisse: 900, couleur: C.texte, maxL: larg * 0.6 });
        texte(String(vo.compte[k]), x + larg - 60 * u, yy + hauteurLigne * 0.6, { taille: n > 4 ? 26 : 32, graisse: 900, align: 'right', couleur: C.texte });
      });
    }

    function ecranTitre(e) {
      const v = vertical();
      const cons = e.consignes || [];
      if (!cons.length) {
        const cy = H * (v ? 0.38 : 0.36);
        texte("JUGE D'IMPRO", W / 2, cy, { taille: v ? 120 : 140, graisse: 900, align: 'center', couleur: C.or, ombre: 40 });
        texte('Le freestyle comme un jeu vidéo', W / 2, cy + 80 * u, { taille: 40, graisse: 600, align: 'center', couleur: C.doux });
        if (e.niveau) texte(`Niveau ${e.niveau.num} · ${e.niveau.titre}`, W / 2, cy + 160 * u, { taille: 36, graisse: 800, align: 'center' });
      } else {
        // Mode avec consignes : elles s'affichent en grand (parfait pour le début d'une vidéo)
        texte("JUGE D'IMPRO", W / 2, (v ? 170 : 110) * u, { taille: v ? 80 : 64, graisse: 900, align: 'center', couleur: C.or, ombre: 30 });
        if (e.mode) texte(`${e.mode.icone}  MODE ${e.mode.nom.toUpperCase()}`, W / 2, (v ? 270 : 190) * u, { taille: v ? 44 : 40, graisse: 900, align: 'center', couleur: C.violet, ombre: 20 });
        const y0 = (v ? 480 : 330) * u, pas = (v ? 250 : 200) * u;
        cons.forEach((c, k) => {
          const y = y0 + k * pas;
          texte(c.libelle, W / 2, y, { taille: 28, graisse: 800, align: 'center', couleur: C.doux });
          texte(c.valeur, W / 2, y + (v ? 80 : 78) * u, { taille: v ? 70 : 76, graisse: 900, align: 'center', couleur: e.roulette ? C.texte : C.or, ombre: e.roulette ? 0 : 30, maxL: W - 100 * u });
          if (c.sous) texte(c.sous, W / 2, y + (v ? 130 : 124) * u, { taille: 28, graisse: 600, align: 'center', couleur: C.doux, maxL: W - 100 * u });
        });
      }
      texte(e.consigne || 'Charge ton instru et lance l’impro', W / 2, H - (v ? 160 : 60) * u, { taille: 30, graisse: 600, align: 'center', couleur: C.doux });
    }

    // ---------- Écran de fin ----------
    function ecranFin(e) {
      const f = e.fin;
      ctx.fillStyle = 'rgba(5,5,10,.45)';
      ctx.fillRect(0, 0, W, H);
      const v = vertical();
      texte("JUGE D'IMPRO", W / 2, (v ? 110 : 70) * u, { taille: v ? 52 : 40, graisse: 900, align: 'center', couleur: C.or });
      if (f.battle) return ecranFinBattle(e);
      if (f.joueurs) return ecranFinFeaturing(e);
      const cx = W / 2;
      const yRang = v ? 640 * u : 420 * u;
      texte(f.modeNom && f.mode !== 'libre' ? `${f.modeIcone} MODE ${f.modeNom.toUpperCase()} · RANG` : 'RANG', cx, yRang - (v ? 300 : 270) * u,
        { taille: 36, graisse: 800, align: 'center', couleur: C.doux });
      texte(f.rang.lettre, cx, yRang, { taille: v ? 360 : 300, graisse: 900, align: 'center', couleur: f.rang.couleur, ombre: 60 });
      texte(f.rang.libelle.toUpperCase(), cx, yRang + 80 * u, { taille: 44, graisse: 800, align: 'center', couleur: f.rang.couleur });
      texte(`${f.score.toLocaleString('fr-FR')} points`, cx, yRang + (v ? 200 : 170) * u, { taille: 72, graisse: 900, align: 'center', ombre: 20 });
      if (f.elimine) texte(`💀 ÉLIMINÉ À ${chrono(f.tElimine)}`, cx, yRang + (v ? 270 : 230) * u, { taille: 40, graisse: 900, align: 'center', couleur: C.rose, ombre: 20 });
      else if (f.record) texte('★ NOUVEAU RECORD ★', cx, yRang + (v ? 270 : 230) * u, { taille: 40, graisse: 900, align: 'center', couleur: C.or, ombre: 30 });

      const pct = (x) => (x != null ? `${Math.round(x * 100)} %` : '–');
      const stats = f.studio ? [
        ['NOTE DE LA PRISE', `${fmt(f.studio.note)}/20`],
        ['DICTION', pct(f.studio.diction)],
        ['CALAGE', pct(f.studio.calage)],
        ['PRÉCISION', pct(f.studio.precision)]
      ] : [
        ['NOTE', f.noteFinale != null ? `${fmt(f.noteFinale)}/20` : `${fmt(f.note)}/20`],
        ['COMBO MAX', String(f.comboMax)],
        ['PRÉCISION', f.precision != null ? `${Math.round(f.precision * 100)} %` : '–'],
        ['HYPE', `${Math.round(f.hypeMoyenne)} %`]
      ];
      const yS = yRang + (v ? 420 : 340) * u;
      const colW = v ? (W - 120 * u) / 2 : 360 * u;
      stats.forEach(([lib, val], k) => {
        const col = v ? k % 2 : k, lig = v ? Math.floor(k / 2) : 0;
        const x = v ? 60 * u + colW * col + colW / 2 : cx + (k - 1.5) * colW;
        const y = yS + lig * 170 * u;
        texte(val, x, y, { taille: 64, graisse: 900, align: 'center' });
        texte(lib, x, y + 44 * u, { taille: 26, graisse: 800, align: 'center', couleur: C.doux });
      });
      let yD = yS + (v ? 400 : 130) * u;
      const objs = f.objectifs || [];
      const ligneObj = (o) => `${o.etat === 'ok' ? '✓' : '✗'} ${o.libelle}${o.progression && o.id !== 'style' ? ' ' + o.progression : ''}`;
      if (objs.length && v) {
        objs.forEach((o) => {
          texte(`${ligneObj(o)} · ${o.texte}`, cx, yD, { taille: 32, graisse: 800, align: 'center', couleur: o.etat === 'ok' ? C.vert : C.rose, maxL: W - 100 * u });
          yD += 52 * u;
        });
      } else if (objs.length) {
        const ok = objs.filter((o) => o.etat === 'ok').length;
        texte(objs.map(ligneObj).join('     '), cx, yD, { taille: 32, graisse: 800, align: 'center', couleur: ok === objs.length ? C.vert : ok ? C.or : C.rose, maxL: W - 100 * u });
        yD += 52 * u;
      }
      if (f.noteIA != null) texte(`Juge IA : ${fmt(f.noteIA)}/20`, cx, yD + 10 * u, { taille: 32, graisse: 700, align: 'center', couleur: C.or });
      else if (f.iaEnCours) texte('Le juge IA délibère…', cx, yD + 10 * u, { taille: 30, graisse: 600, align: 'center', couleur: C.doux });
      if (f.niveau && !(e.habillage && e.habillage.outro)) texte(`Niveau ${f.niveau.num} · ${f.niveau.titre}${f.niveauGagne ? '  ▲ NIVEAU SUPÉRIEUR !' : ''}`, cx, H - (v ? 120 : 40) * u,
        { taille: 30, graisse: 800, align: 'center', couleur: f.niveauGagne ? C.or : C.doux });
    }

    function ecranFinFeaturing(e) {
      const f = e.fin;
      const v = vertical();
      const cx = W / 2;
      texte('🤝 FEATURING', cx, (v ? 260 : 170) * u, { taille: 40, graisse: 900, align: 'center', couleur: C.violet });
      texte(f.vainqueur ? 'VAINQUEUR' : 'ÉGALITÉ PARFAITE', cx, (v ? 380 : 260) * u, { taille: 34, graisse: 800, align: 'center', couleur: C.doux });
      if (f.vainqueur) texte(f.vainqueur.toUpperCase(), cx, (v ? 500 : 370) * u, { taille: v ? 110 : 120, graisse: 900, align: 'center', couleur: C.or, ombre: 50, maxL: W - 100 * u });
      const n = f.joueurs.length;
      const yJ = (v ? 720 : 560) * u;
      f.joueurs.forEach((j, k) => {
        const x = W * (k + 0.5) / n;
        const gagne = j.nom === f.vainqueur;
        rect(x - (W / n) * 0.42, yJ - 70 * u, (W / n) * 0.84, (v ? 560 : 330) * u, 20, gagne ? 'rgba(255,204,0,.12)' : 'rgba(255,255,255,.05)');
        texte(j.nom.toUpperCase(), x, yJ, { taille: 36, graisse: 900, align: 'center', couleur: gagne ? C.or : C.texte, maxL: (W / n) * 0.8 });
        texte(j.score.toLocaleString('fr-FR'), x, yJ + 100 * u, { taille: 72, graisse: 900, align: 'center' });
        texte('POINTS', x, yJ + 140 * u, { taille: 22, graisse: 800, align: 'center', couleur: C.doux });
        const details = [j.note != null ? `${fmt(j.note)}/20` : '–', `combo ${j.comboMax}`];
        if (v) details.forEach((d, i) => texte(d, x, yJ + (230 + i * 70) * u, { taille: 40, graisse: 800, align: 'center' }));
        else texte(details.join('  ·  '), x, yJ + 210 * u, { taille: 32, graisse: 700, align: 'center' });
      });
      texte(`Score du duo : ${f.score.toLocaleString('fr-FR')}`, cx, H - (v ? 260 : 110) * u, { taille: 36, graisse: 800, align: 'center', couleur: C.cyan });
      if (f.niveau && !(e.habillage && e.habillage.outro)) texte(`Niveau ${f.niveau.num} · ${f.niveau.titre}`, cx, H - (v ? 140 : 40) * u, { taille: 28, graisse: 700, align: 'center', couleur: C.doux });
    }

    function ecranFinBattle(e) {
      const f = e.fin, b = f.battle;
      const v = vertical();
      const cx = W / 2;
      const joues = b.joues || b.rounds;
      const enAttente = b.resultats.slice(0, joues).some((r) => !r);
      texte('🥊 BATTLE', cx, (v ? 250 : 150) * u, { taille: 40, graisse: 900, align: 'center', couleur: C.rose });
      if (enAttente) {
        // petits points qui défilent pendant la délibération
        const points = '.'.repeat(1 + Math.floor((e.t * 2) % 3));
        texte(`LE JURY DÉLIBÈRE${points}`, cx, (v ? 440 : 300) * u, { taille: v ? 64 : 76, graisse: 900, align: 'center', couleur: C.doux });
      } else {
        const libelle = !f.vainqueur ? 'ÉGALITÉ' : b.departage === 'notes' ? 'VAINQUEUR AUX NOTES DU JURY' : b.departage === 'points' ? 'VAINQUEUR AUX POINTS' : 'VAINQUEUR';
        texte(libelle, cx, (v ? 370 : 230) * u, { taille: 34, graisse: 800, align: 'center', couleur: C.doux });
        if (f.vainqueur) texte(f.vainqueur.toUpperCase(), cx, (v ? 490 : 335) * u, { taille: 110, graisse: 900, align: 'center', couleur: C.or, ombre: 50, maxL: W - 100 * u });
      }
      const yJ = (v ? 700 : 480) * u;
      f.joueurs.forEach((j, k) => {
        const x = W * (k + 0.5) / 2;
        const gagne = !enAttente && j.nom === f.vainqueur;
        rect(x - W * 0.21, yJ - 60 * u, W * 0.42, (v ? 340 : 250) * u, 20, gagne ? 'rgba(255,204,0,.12)' : 'rgba(255,255,255,.05)');
        texte(j.nom.toUpperCase(), x, yJ, { taille: 36, graisse: 900, align: 'center', couleur: gagne ? C.or : C.texte, maxL: W * 0.38 });
        const vict = (b.victoires || [0, 0])[k];
        texte(String(vict), x, yJ + 105 * u, { taille: 92, graisse: 900, align: 'center', ombre: gagne ? 30 : 0, couleur: gagne ? C.or : C.texte });
        texte(vict > 1 ? 'ROUNDS GAGNÉS' : 'ROUND GAGNÉ', x, yJ + 140 * u, { taille: 22, graisse: 800, align: 'center', couleur: C.doux });
        texte(`${j.score.toLocaleString('fr-FR')} pts`, x, yJ + (v ? 230 : 175) * u, { taille: 30, graisse: 700, align: 'center', couleur: '#b8b8cc' });
      });
      let y = yJ + (v ? 380 : 255) * u;
      b.resultats.slice(0, joues).forEach((r, k) => {
        const qui = !r ? 'au jury…' : r.vainqueur == null ? 'égalité' : f.joueurs[r.vainqueur].nom;
        texte(`ROUND ${k + 1} · ${qui.toUpperCase()}`, cx, y, { taille: 30, graisse: 900, align: 'center', couleur: r ? C.or : C.doux, maxL: W - 120 * u });
        if (r && r.commentaire) {
          const com = r.commentaire.length > 150 ? r.commentaire.slice(0, 147) + '…' : r.commentaire;
          texte(`${r.source === 'ia' ? '🤖' : '🔢'} ${com}`, cx, y + 38 * u, { taille: 24, graisse: 600, align: 'center', couleur: C.doux, maxL: W - 120 * u });
        }
        y += (v ? 120 : 92) * u;
      });
      if (f.niveau && !(e.habillage && e.habillage.outro)) texte(`Niveau ${f.niveau.num} · ${f.niveau.titre}`, cx, H - (v ? 140 : 30) * u, { taille: 26, graisse: 700, align: 'center', couleur: C.doux });
    }

    const chrono = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;

    const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

    function dessiner(e) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      fond(e);
      if (!e.enCours && !e.fin) {
        if (e.tournoi) ecranTournoi(e); else ecranTitre(e);
        qrPublic(e, true);
        voteTournoi(e);
        return;
      }
      if (e.fin) { ecranFin(e); outro(e); championTournoi(e); voteTournoi(e); return; } // écran de fin épuré : c'est la carte de score à partager
      entete(e);
      jauges(e);
      bandeau(e);
      if (e.partie && e.partie.studio) prompteur(e);
      else if (e.habillage && e.habillage.sousTitres === 'reseaux') sousTitres(e);
      else paroles(e);
      piste(e);
      popups(e);
      qrPublic(e, false);
      intro(e);
    }

    // ---------- Habillage du MC : logo + @ (ou nom), intro, écran de fin, sous-titres façon réseaux ----------
    function signature(m, x, y, { taille = 40, align = 'left', couleur = C.or, alpha = 1 } = {}) {
      const txt = m.handle || m.nom || '';
      ctx.font = police(taille, 900);
      const largeurTexte = ctx.measureText(txt).width;
      const cote = m.logo ? taille * 1.35 * u : 0;
      const ecart = m.logo && txt ? 14 * u : 0;
      const total = cote + ecart + largeurTexte;
      let gauche = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
      if (m.logo) {
        const hauteur = cote * (m.logo.height / m.logo.width || 1);
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.drawImage(m.logo, gauche, y - taille * 0.85 * u - (hauteur - taille * u) / 2, cote, hauteur);
        ctx.restore();
        gauche += cote + ecart;
      }
      if (txt) texte(txt, gauche, y, { taille, graisse: 900, couleur, alpha, ombre: 12 });
    }

    // intro (2,5 s au début de l'impro, donc au début de la vidéo) : le MC se présente
    function intro(e) {
      const hb = e.habillage;
      if (!hb || !hb.intro || !e.partie || e.t > 2.6) return;
      const a = e.t < 1.8 ? 1 : Math.max(0, (2.6 - e.t) / 0.8);
      const m = hb.marque, v = vertical();
      ctx.save();
      ctx.globalAlpha = 0.88 * a;
      ctx.fillStyle = '#07060c';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const cy = H * (v ? 0.4 : 0.42);
      if (m.logo) {
        const cote = (v ? 280 : 220) * u, hauteur = cote * (m.logo.height / m.logo.width || 1);
        ctx.save(); ctx.globalAlpha = a;
        ctx.drawImage(m.logo, W / 2 - cote / 2, cy - hauteur - 30 * u, cote, hauteur);
        ctx.restore();
      }
      texte((m.nom || '').toUpperCase(), W / 2, cy + 70 * u, { taille: v ? 110 : 120, graisse: 900, align: 'center', couleur: C.texte, ombre: 40, alpha: a, maxL: W - 100 * u });
      if (m.handle) texte(m.handle, W / 2, cy + 140 * u, { taille: 44, graisse: 800, align: 'center', couleur: C.or, alpha: a });
      const p = e.partie;
      texte(`${p.modeIcone} ${p.modeNom.toUpperCase()}${e.grille ? ` · ${Math.round(e.grille.bpm)} BPM` : ''}`, W / 2, cy + 210 * u, { taille: 34, graisse: 800, align: 'center', couleur: C.doux, alpha: a });
    }

    // écran de fin : bandeau avec la marque et la phrase de fin
    function outro(e) {
      const hb = e.habillage;
      if (!hb || !hb.outro) return false;
      const v = vertical(), haut = (v ? 150 : 88) * u, y0 = H - haut - (v ? 60 : 8) * u;
      rect(40 * u, y0, W - 80 * u, haut, 18, 'rgba(0,0,0,.55)');
      if (v) {
        signature(hb.marque, W / 2, y0 + 60 * u, { taille: 40, align: 'center' });
        if (hb.cta) texte(hb.cta, W / 2, y0 + 118 * u, { taille: 32, graisse: 800, align: 'center', couleur: C.texte, maxL: W - 140 * u });
      } else {
        signature(hb.marque, 70 * u, y0 + 58 * u, { taille: 36 });
        if (hb.cta) texte(hb.cta, W - 70 * u, y0 + 58 * u, { taille: 32, graisse: 800, align: 'right', couleur: C.texte, maxL: W * 0.5 });
      }
      return true;
    }

    // sous-titres façon réseaux : la phrase en cours, en grand, contourée, rimes en couleur
    function sousTitres(e) {
      const lignes = e.lignes || [];
      const l = lignes[lignes.length - 1];
      const v = vertical();
      const taille = v ? 66 : 58, largeur = W - (v ? 120 : 260) * u, yBas = (v ? 1140 : 780) * u;
      if (!l) {
        if (e.enCours) texte('🎤', W / 2, yBas, { taille, align: 'center', couleur: C.doux });
        return;
      }
      ctx.font = police(taille, 900);
      const espace = ctx.measureText(' ').width;
      const rangs = [[]];
      let larg = 0;
      for (const m of l.mots) {
        const w = ctx.measureText(m.texte).width;
        if (larg + w > largeur && rangs[rangs.length - 1].length) { rangs.push([]); larg = 0; }
        rangs[rangs.length - 1].push({ ...m, w });
        larg += w + espace;
      }
      const visibles = rangs.slice(-2);
      const pas = taille * 1.25 * u;
      visibles.forEach((r, k) => {
        const total = r.reduce((t, m) => t + m.w, 0) + espace * (r.length - 1);
        let x = W / 2 - total / 2;
        const y = yBas - (visibles.length - 1 - k) * pas;
        for (const m of r) {
          ctx.save();
          ctx.font = police(taille, 900);
          ctx.lineJoin = 'round'; ctx.lineWidth = 10 * u; ctx.strokeStyle = '#000';
          ctx.globalAlpha = l.interim ? 0.75 : 1;
          ctx.strokeText(m.texte, x, y);
          ctx.fillStyle = m.couleur || '#ffffff';
          ctx.fillText(m.texte, x, y);
          ctx.restore();
          x += m.w + espace;
        }
      });
    }

    // ---------- Export ----------
    function demarrerEnregistrement(fluxAudio) {
      const flux = canvas.captureStream(30);
      if (fluxAudio) fluxAudio.getAudioTracks().forEach((piste) => flux.addTrack(piste));
      const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const type = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
      morceaux = [];
      enregistreur = new MediaRecorder(flux, { mimeType: type, videoBitsPerSecond: 8_000_000 });
      enregistreur.ondataavailable = (ev) => ev.data.size && morceaux.push(ev.data);
      enregistreur.start(1000);
    }

    function arreterEnregistrement() {
      return new Promise((ok) => {
        if (!enregistreur || enregistreur.state === 'inactive') return ok(null);
        enregistreur.onstop = () => {
          const type = enregistreur.mimeType || 'video/webm';
          ok({ blob: new Blob(morceaux, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm' });
          enregistreur = null;
        };
        enregistreur.stop();
      });
    }

    const capturer = () => new Promise((ok) => canvas.toBlob(ok, 'image/png'));

    return {
      setFormat, dessiner, demarrerEnregistrement, arreterEnregistrement, capturer,
      get format() { return format; }, get enregistre() { return Boolean(enregistreur); }
    };
  }

  root.Scene = { creer };
})(typeof window !== 'undefined' ? window : globalThis);
