// Le graphe routable, et le plus court chemin calculé dans le navigateur.
//
// C'est ce qui permet de déplacer le point de départ : la page ne consulte pas
// des temps précalculés, elle refait le calcul de la planche, sur le même graphe
// et avec les mêmes coûts.

/** Graphe en listes d'adjacence compressées, construit une fois au chargement. */
export function preparer(brut) {
  const n = brut.lon.length
  const m = brut.u.length
  const u = Int32Array.from(brut.u)
  const v = Int32Array.from(brut.v)
  const L = Float32Array.from(brut.L)
  const cout = Float32Array.from(brut.cout)
  const amenage = Uint8Array.from(brut.amenage)

  // deux demi-arêtes par arête : le réseau n'est pas orienté
  const tete = new Int32Array(n + 1)
  for (let e = 0; e < m; e++) { tete[u[e] + 1]++; tete[v[e] + 1]++ }
  for (let i = 0; i < n; i++) tete[i + 1] += tete[i]
  const curseur = Int32Array.from(tete)
  const voisin = new Int32Array(2 * m)
  const arete = new Int32Array(2 * m)
  for (let e = 0; e < m; e++) {
    voisin[curseur[u[e]]] = v[e]; arete[curseur[u[e]]++] = e
    voisin[curseur[v[e]]] = u[e]; arete[curseur[v[e]]++] = e
  }

  return {
    n, m, u, v, L, cout, amenage, tete, voisin, arete,
    lon: Float64Array.from(brut.lon),
    lat: Float64Array.from(brut.lat),
  }
}

/** Tas binaire minimal, à suppression paresseuse : un sommet amélioré est
 *  simplement réempilé, et l'entrée périmée est ignorée à la sortie. */
class Tas {
  constructor(capacite) {
    this.cle = new Float64Array(capacite)
    this.val = new Int32Array(capacite)
    this.taille = 0
  }
  pousser(cle, val) {
    if (this.taille === this.cle.length) this._agrandir()
    let i = this.taille++
    this.cle[i] = cle; this.val[i] = val
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.cle[p] <= this.cle[i]) break
      this._echanger(i, p); i = p
    }
  }
  retirer() {
    const cle = this.cle[0], val = this.val[0]
    this.taille--
    if (this.taille > 0) {
      this.cle[0] = this.cle[this.taille]; this.val[0] = this.val[this.taille]
      let i = 0
      for (;;) {
        const g = 2 * i + 1, d = g + 1
        let petit = i
        if (g < this.taille && this.cle[g] < this.cle[petit]) petit = g
        if (d < this.taille && this.cle[d] < this.cle[petit]) petit = d
        if (petit === i) break
        this._echanger(i, petit); i = petit
      }
    }
    return [cle, val]
  }
  _echanger(a, b) {
    const c = this.cle[a]; this.cle[a] = this.cle[b]; this.cle[b] = c
    const v = this.val[a]; this.val[a] = this.val[b]; this.val[b] = v
  }
  _agrandir() {
    const cle = new Float64Array(this.cle.length * 2)
    const val = new Int32Array(this.val.length * 2)
    cle.set(this.cle); val.set(this.val)
    this.cle = cle; this.val = val
  }
}

/** Dijkstra sur le coût de préférence, depuis un sommet, sur tout le graphe.
 *  Le coût dit quel itinéraire un cycliste choisit ; la longueur réelle et donc
 *  la durée se lisent ensuite sur les arêtes du chemin retenu. */
export function dijkstra(G, source) {
  const dist = new Float64Array(G.n).fill(Infinity)
  const pere = new Int32Array(G.n).fill(-1)
  const pereArete = new Int32Array(G.n).fill(-1)
  const fige = new Uint8Array(G.n)
  const tas = new Tas(1 << 16)

  dist[source] = 0
  tas.pousser(0, source)
  while (tas.taille) {
    const [d, x] = tas.retirer()
    if (fige[x]) continue
    fige[x] = 1
    for (let k = G.tete[x]; k < G.tete[x + 1]; k++) {
      const y = G.voisin[k]
      if (fige[y]) continue
      const nd = d + G.cout[G.arete[k]]
      if (nd < dist[y]) {
        dist[y] = nd
        pere[y] = x
        pereArete[y] = G.arete[k]
        tas.pousser(nd, y)
      }
    }
  }
  return { dist, pere, pereArete }
}

/** Tracé d'une arête, orienté dans le sens où on la parcourt.
 *
 *  `geometrie.json` oriente chaque tronçon du premier vers le second sommet de
 *  l'arête (`01_donnees_web.py`). Le sens de marche se lit donc sur le sommet
 *  d'où l'on vient, sans avoir à comparer des distances : c'est ce qui garantit
 *  qu'un tronçon ne se recolle jamais à l'envers.
 */
export function orienter(G, geometrie, e, depuis) {
  const g = geometrie[e]
  if (!g) return null
  return G.u[e] === depuis ? g : g.slice().reverse()
}

/** Chemin du départ vers un sommet : suite de sommets et suite d'arêtes. */
export function chemin(calcul, cible) {
  const sommets = [], aretes = []
  let x = cible
  while (x !== -1) {
    sommets.push(x)
    const e = calcul.pereArete[x]
    if (e !== -1) aretes.push(e)
    x = calcul.pere[x]
  }
  sommets.reverse(); aretes.reverse()
  return { sommets, aretes }
}

/** Sommet du réseau le plus proche d'un point, et son écart en mètres.
 *  Balayage direct des 54 000 sommets : quelques millisecondes, là où un index
 *  spatial demanderait une structure à tenir à jour pour rien. */
export function accrocher(G, lat, lon) {
  const cosLat = Math.cos((lat * Math.PI) / 180)
  let meilleur = -1, mieux = Infinity
  for (let i = 0; i < G.n; i++) {
    const dx = (G.lon[i] - lon) * cosLat
    const dy = G.lat[i] - lat
    const d = dx * dx + dy * dy
    if (d < mieux) { mieux = d; meilleur = i }
  }
  return { i: meilleur, ecart_m: Math.sqrt(mieux) * 111320 }
}

/** Azimut géographique et vol d'oiseau entre deux points, en radians et mètres.
 *  Approximation équirectangulaire locale : sur trente kilomètres, l'écart avec
 *  la projection légale reste sous le demi-degré, et l'angle ne sert qu'à
 *  orienter une branche du diagramme. */
export function azimut(lat0, lon0, lat, lon) {
  const cosLat = Math.cos((lat0 * Math.PI) / 180)
  const x = (lon - lon0) * cosLat * 111320
  const y = (lat - lat0) * 111320
  return { angle: Math.atan2(x, y), vol_m: Math.hypot(x, y) }
}
