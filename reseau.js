/*
 * Réseau du mode Featuring en ligne.
 * - Supabase Realtime sert uniquement de « standard » : on s'y retrouve avec un code de salle
 *   et on échange les signaux WebRTC.
 * - Ensuite tout passe en direct entre les deux navigateurs (WebRTC) : la voix, l'instru,
 *   les phrases reconnues et l'état du jeu.
 */
(function (root) {
  const CONFIG = {
    // Projet Supabase gratuit « Judge-mic » : sert uniquement de relais de connexion
    supabaseUrl: 'https://vxgxrmtgzaaccxxxbmaf.supabase.co',
    // Clé publique (« publishable ») : prévue pour être visible dans une page web
    supabaseCle: 'sb_publishable_lC3DjTtBjTf0ys--vVwwag_qZj10QDv',
    // Adresse publique de la page invité (GitHub Pages) ; vide = page servie en local
    pageInvite: 'https://infopro78500-cpu.github.io/juge-impro-invite/'
  };
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I/L

  function nouveauCode(n = 6) {
    const octets = crypto.getRandomValues(new Uint8Array(n));
    return [...octets].map((o) => ALPHABET[o % ALPHABET.length]).join('');
  }

  function lienInvite(code) {
    const base = CONFIG.pageInvite || `${location.origin}/invite/`;
    return `${base}?salle=${encodeURIComponent(code)}`;
  }

  /*
   * role : 'hote' ou 'invite'
   * flux : MediaStream du micro local (envoyé à l'autre)
   * rappels : surMessage(objet), surBinaire(ArrayBuffer), surStatut(etat, detail), surFluxDistant(MediaStream)
   */
  function creerLiaison({ role, code, nom, flux, surMessage, surBinaire, surStatut = () => { }, surFluxDistant }) {
    if (!root.supabase) throw new Error('Bibliothèque Supabase non chargée (connexion internet ?)');
    const sb = root.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseCle, { auth: { persistSession: false } });
    // Une petite requête en base : un projet gratuit inactif 7 jours est mis en pause par Supabase
    sb.rpc('ping').then(() => { }, () => { });
    const canal = sb.channel(`juge-impro:salle:${code}`, { config: { broadcast: { self: false } } });
    const monId = nouveauCode(10);
    let pc = null, dc = null, idDistant = null, nomDistant = null;
    let attente = []; // candidats ICE reçus avant la description distante
    let relance = null;

    const signal = (contenu) => canal.send({ type: 'broadcast', event: 'signal', payload: { de: role, id: monId, pour: idDistant, ...contenu } });

    function nouvellePC() {
      if (pc) pc.close();
      pc = new RTCPeerConnection({ iceServers: ICE });
      attente = [];
      if (flux) flux.getAudioTracks().forEach((piste) => pc.addTrack(piste, flux));
      pc.onicecandidate = (e) => { if (e.candidate) signal({ candidate: e.candidate.toJSON() }); };
      pc.ontrack = (e) => { if (surFluxDistant) surFluxDistant(e.streams[0] || new MediaStream([e.track])); };
      pc.onconnectionstatechange = () => surStatut(pc.connectionState, nomDistant);
      return pc;
    }

    function brancherCanal(canalDonnees) {
      dc = canalDonnees;
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = 1 << 20;
      dc.onopen = () => { clearInterval(relance); surStatut('ouvert', nomDistant); };
      dc.onclose = () => surStatut('ferme', nomDistant);
      dc.onmessage = (e) => {
        if (typeof e.data === 'string') { try { surMessage(JSON.parse(e.data)); } catch { /* message illisible */ } }
        else if (surBinaire) surBinaire(e.data);
      };
    }

    async function viderAttente() {
      for (const c of attente) await pc.addIceCandidate(c).catch(() => { });
      attente = [];
    }

    // L'invité se présente ; l'hôte lui propose une liaison directe
    canal.on('broadcast', { event: 'bonjour' }, async ({ payload }) => {
      if (role !== 'hote') return;
      const occupe = pc && ['connected', 'connecting'].includes(pc.connectionState) && payload.id !== idDistant;
      if (occupe) { canal.send({ type: 'broadcast', event: 'complet', payload: { pour: payload.id } }); return; }
      if (payload.id === idDistant && pc && pc.connectionState !== 'failed' && pc.connectionState !== 'closed') return; // simple répétition
      idDistant = payload.id;
      nomDistant = String(payload.nom || 'Invité').slice(0, 30);
      surStatut('invite-arrive', nomDistant);
      nouvellePC();
      brancherCanal(pc.createDataChannel('jeu', { ordered: true }));
      await pc.setLocalDescription(await pc.createOffer());
      signal({ sdp: pc.localDescription.toJSON(), nom });
    });

    canal.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      if (payload.de === role || (payload.pour && payload.pour !== monId)) return;
      try {
        if (payload.sdp && payload.sdp.type === 'offer' && role === 'invite') {
          idDistant = payload.id;
          nomDistant = String(payload.nom || 'Hôte').slice(0, 30);
          nouvellePC();
          pc.ondatachannel = (e) => brancherCanal(e.channel);
          await pc.setRemoteDescription(payload.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          signal({ sdp: pc.localDescription.toJSON() });
          await viderAttente();
        } else if (payload.sdp && payload.sdp.type === 'answer' && role === 'hote' && pc) {
          await pc.setRemoteDescription(payload.sdp);
          await viderAttente();
        } else if (payload.candidate) {
          if (pc && pc.remoteDescription) await pc.addIceCandidate(payload.candidate).catch(() => { });
          else attente.push(payload.candidate);
        }
      } catch (err) {
        surStatut('erreur', err.message);
      }
    });

    canal.on('broadcast', { event: 'complet' }, ({ payload }) => { if (role === 'invite' && payload.pour === monId) { clearInterval(relance); surStatut('complet'); } });
    // L'hôte annonce sa présence (utile si l'invité est arrivé avant lui)
    canal.on('broadcast', { event: 'hote-present' }, () => { if (role === 'invite' && !(dc && dc.readyState === 'open')) direBonjour(); });

    const direBonjour = () => canal.send({ type: 'broadcast', event: 'bonjour', payload: { id: monId, nom } });

    canal.subscribe((statut) => {
      if (statut === 'SUBSCRIBED') {
        surStatut('salle');
        if (role === 'invite') {
          direBonjour();
          // tant que la liaison directe n'est pas ouverte, on se représente régulièrement
          relance = setInterval(() => { if (!(dc && dc.readyState === 'open')) direBonjour(); }, 4000);
        } else {
          canal.send({ type: 'broadcast', event: 'hote-present', payload: {} });
        }
      } else if (statut === 'CHANNEL_ERROR' || statut === 'TIMED_OUT') {
        surStatut('erreur-salle', statut);
      }
    });

    return {
      code,
      get ouvert() { return Boolean(dc && dc.readyState === 'open'); },
      get nomDistant() { return nomDistant; },
      envoyer(type, donnees = {}) {
        if (dc && dc.readyState === 'open') dc.send(JSON.stringify({ type, ...donnees }));
      },
      async envoyerBinaire(tampon) {
        if (!(dc && dc.readyState === 'open')) return;
        if (dc.bufferedAmount > 4 << 20) await new Promise((ok) => { dc.onbufferedamountlow = () => { dc.onbufferedamountlow = null; ok(); }; });
        dc.send(tampon);
      },
      fermer() {
        clearInterval(relance);
        try { dc && dc.close(); } catch { /* déjà fermé */ }
        try { pc && pc.close(); } catch { /* déjà fermé */ }
        sb.removeChannel(canal);
      }
    };
  }

  // Envoi d'un fichier (l'instru) en morceaux de 16 Ko
  async function envoyerFichier(liaison, fichier, surProgres = () => { }) {
    const tampon = await fichier.arrayBuffer();
    const taille = tampon.byteLength, MORCEAU = 16 * 1024;
    liaison.envoyer('instru-debut', { nom: fichier.name, taille, typeMime: fichier.type || 'audio/mpeg' });
    for (let pos = 0; pos < taille; pos += MORCEAU) {
      await liaison.envoyerBinaire(tampon.slice(pos, pos + MORCEAU));
      if ((pos / MORCEAU) % 32 === 0) surProgres(pos / taille);
    }
    liaison.envoyer('instru-fin', {});
    surProgres(1);
  }

  root.Reseau = { CONFIG, nouveauCode, lienInvite, creerLiaison, envoyerFichier };
})(typeof window !== 'undefined' ? window : globalThis);
