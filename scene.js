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
      if (vertical()) {
        texte("JUGE D'IMPRO", W / 2, 90 * u, { taille: 44, align: 'center', couleur: C.or });
        texte(score.toLocaleString('fr-FR'), W / 2, 230 * u, { taille: 120, graisse: 900, align: 'center', ombre: 25 });
        texte(e.chrono || '', W / 2, 290 * u, { taille: 40, graisse: 700, align: 'center', couleur: e.chronoAlerte ? C.rose : C.doux });
      } else {
        texte("JUGE D'IMPRO", 60 * u, 90 * u, { taille: 42, couleur: C.or });
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
        texte(`ensuite : ${p.joueurs[f.suivant].nom}`, x + w - 24 * u, y + 36 * u, { taille: 22, graisse: 700, align: 'right', couleur: C.doux, maxL: w * 0.4 });
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
        texte(m.mot.toUpperCase(), 0, 0, { taille: 60, graisse: 900, couleur: m.place ? C.vert : C.or, ombre: 25, maxL: w - 60 * u });
        ctx.restore();
        const reste = Math.max(0, Math.min(1, (m.t1 - e.t) / (m.t1 - m.t0)));
        rect(x + 28 * u, y + h - 30 * u, w - 56 * u, 10 * u, 5, 'rgba(255,255,255,.12)');
        rect(x + 28 * u, y + h - 30 * u, (w - 56 * u) * reste, 10 * u, 5, reste < 0.25 ? C.rose : C.violet);
        return;
      }

      const objs = p.objectifs || [];
      if (!objs.length) return;
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

      const stats = [
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
      if (f.niveau) texte(`Niveau ${f.niveau.num} · ${f.niveau.titre}${f.niveauGagne ? '  ▲ NIVEAU SUPÉRIEUR !' : ''}`, cx, H - (v ? 120 : 40) * u,
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
      if (f.niveau) texte(`Niveau ${f.niveau.num} · ${f.niveau.titre}`, cx, H - (v ? 140 : 40) * u, { taille: 28, graisse: 700, align: 'center', couleur: C.doux });
    }

    const chrono = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;

    const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

    function dessiner(e) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      fond(e);
      if (!e.enCours && !e.fin) { ecranTitre(e); return; }
      if (e.fin) { ecranFin(e); return; } // écran de fin épuré : c'est la carte de score à partager
      entete(e);
      jauges(e);
      bandeau(e);
      paroles(e);
      piste(e);
      popups(e);
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
