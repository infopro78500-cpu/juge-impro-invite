/*
 * Page publique du classement d'un crew : le défi de la semaine et le meilleur score de chaque MC,
 * rafraîchi toutes les 30 secondes. Lecture seule.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const params = new URLSearchParams(location.search);
  const crew = Classement.normaliserCrew(params.get('crew'));
  const actuelle = Classement.semaine();
  let semaine = /^\d{4}-S\d{2}$/.test(params.get('semaine') || '') ? params.get('semaine') : actuelle;
  let minuterie = null;

  if (!/^[A-Z0-9-]{3,24}$/.test(crew)) {
    $('accueil').hidden = false;
    $('voir').addEventListener('click', () => {
      const c = Classement.normaliserCrew($('code').value);
      if (c.length >= 3) location.search = `?crew=${encodeURIComponent(c)}`;
    });
    return;
  }
  $('tableau').hidden = false;
  $('precedente').addEventListener('click', () => changer(-1));
  $('suivante').addEventListener('click', () => changer(1));

  function changer(n) {
    const s = Classement.decalerSemaine(semaine, n);
    if (s > actuelle) return;
    semaine = s;
    history.replaceState(null, '', `?crew=${encodeURIComponent(crew)}${semaine === actuelle ? '' : `&semaine=${semaine}`}`);
    afficher();
  }

  async function afficher() {
    clearTimeout(minuterie);
    const enCours = semaine === actuelle;
    $('titre').textContent = `Crew ${crew}`;
    $('sous-titre').textContent = enCours
      ? `Semaine ${semaine} · ${Classement.joursRestants() ? `encore ${Classement.joursRestants()} jour(s)` : 'dernier jour !'}`
      : `Semaine ${semaine} · terminée`;
    $('suivante').disabled = enCours;
    const dj = Classement.defiDeLaSemaine(semaine);
    const st = Rythmes.STYLES[dj.boite];
    $('defi').innerHTML = `<b>${esc(Jeu.MODES[dj.mode].icone)} ${esc(dj.titre)}</b>
      ${Jeu.consignes(dj.mode, dj.config).map((x) => `<span>${esc(x.libelle)} : ${esc(x.valeur)}</span>`).join('')}
      <span class="astuce">${dj.duree} s · instru : ${esc(st.nom)} ${st.bpm} BPM</span>`;
    try {
      const lignes = await Classement.tableau(crew, semaine);
      $('lignes').innerHTML = lignes.length
        ? lignes.map((x, k) => `<li class="${k < 3 ? 'top' : ''}"><span class="pos">${['🥇', '🥈', '🥉'][k] || k + 1}</span>
            <b>${esc(x.pseudo)}</b><span class="pts">${x.score.toLocaleString('fr-FR')} pts</span>
            <span class="astuce">${x.note != null ? `${String(x.note).replace('.', ',')}/20 · ` : ''}${x.rang ? `rang ${esc(x.rang)} · ` : ''}${x.essais} essai${x.essais > 1 ? 's' : ''}</span></li>`).join('')
        : `<li class="astuce">${enCours ? 'Personne n’a encore posté de score cette semaine.' : 'Aucun score cette semaine-là.'}</li>`;
      $('maj').textContent = enCours ? `Mis à jour à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · rafraîchi toutes les 30 s` : '';
    } catch (err) {
      $('lignes').innerHTML = `<li class="erreur">${esc(err.message)}</li>`;
    }
    if (enCours) minuterie = setTimeout(afficher, 30000);
  }
  afficher();
})();
