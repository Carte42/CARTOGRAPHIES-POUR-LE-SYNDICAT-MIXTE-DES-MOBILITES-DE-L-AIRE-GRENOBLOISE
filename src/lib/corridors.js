// L'arbre des corridors, et son lettrage.
//
// Porté de `annexes/temps_parcours.py:construire_arbre` et de la classe `Arbre`
// de `annexes/spidermap.py`, qui composent la planche imprimée. Les règles sont
// celles de la planche, à la ligne près : deux destinations desservies par le
// même itinéraire partagent leur branche jusqu'à l'embranchement réel, et le
// lettrage rouvre à chaque tour le corridor le plus chargé à sa première vraie
// bifurcation.

import { chemin, azimut } from './graphe.js'
import { PALETTE, LETTRES } from './charte.js'

function moyenneAngulaire(angles) {
  let s = 0, c = 0
  for (const a of angles) { s += Math.sin(a); c += Math.cos(a) }
  return Math.atan2(s, c)
}

export function ecartAngulaire(a, b) {
  return ((a - b + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
}

/** Temps, distances et itinéraires vers les destinations, depuis un départ. */
export function desservir(G, calcul, destinations, depart, vitesse) {
  const out = []
  for (const d of destinations) {
    if (!isFinite(calcul.dist[d.i])) continue
    const r = chemin(calcul, d.i)
    let L = 0, amen = 0
    for (const e of r.aretes) {
      L += G.L[e]
      if (G.amenage[e]) amen += G.L[e]
    }
    const { angle, vol_m } = azimut(G.lat[depart], G.lon[depart], d.lat, d.lon)
    out.push({
      ...d,
      km: L / 1000,
      minutes: L / 1000 / vitesse * 60,
      part_amenagee: L ? amen / L : 0,
      azimut: angle,
      vol_km: vol_m / 1000,
      detour: vol_m ? L / vol_m : null,
      chemin: r,
    })
  }
  out.sort((a, b) => a.minutes - b.minutes)
  return out
}

/** Arbre des corridors partagés, réduit à ses points remarquables : la racine,
 *  les embranchements et les destinations. Entre deux, la branche est une
 *  simple liaison. */
export function construireArbre(G, depart, dessertes, vitesse) {
  const passage = new Map()
  const pere = new Map()
  for (const d of dessertes) {
    const route = d.chemin.sommets
    for (let i = 0; i < route.length; i++) {
      const n = route[i]
      passage.set(n, (passage.get(n) || 0) + 1)
      if (i) pere.set(n, route[i - 1])
    }
  }

  const arrivees = new Set(dessertes.map((d) => d.i))
  const fils = new Map()
  for (const [n, p] of pere) {
    if (!fils.has(p)) fils.set(p, new Set())
    fils.get(p).add(n)
  }
  const remarquables = new Set([depart, ...arrivees])
  for (const [n, f] of fils) if (f.size > 1) remarquables.add(n)

  // distance cumulée depuis le départ, le long de l'arbre
  const cumul = new Map([[depart, 0]])
  for (const d of dessertes) {
    const { sommets, aretes } = d.chemin
    let m = 0
    for (let k = 0; k < aretes.length; k++) {
      m += G.L[aretes[k]]
      const v = sommets[k + 1]
      if (!cumul.has(v)) cumul.set(v, m)
    }
  }

  const liaisons = []
  const vus = new Set()
  for (const d of dessertes) {
    let precedent = depart
    for (const n of d.chemin.sommets.slice(1)) {
      if (!remarquables.has(n)) continue
      const cle = precedent + ':' + n
      if (!vus.has(cle)) { vus.add(cle); liaisons.push({ de: precedent, vers: n }) }
      precedent = n
    }
  }

  const noeuds = new Map()
  for (const n of remarquables) {
    const km = (cumul.get(n) || 0) / 1000
    noeuds.set(n, {
      lat: G.lat[n], lon: G.lon[n], km,
      minutes: km / vitesse * 60,
      desservies: passage.get(n) || 0,
    })
  }
  return { racine: depart, noeuds, liaisons }
}

/** Lettrage et coloration des corridors, sur l'arbre réduit. */
export class Corridors {
  constructor(arbre, dessertes, cible = 8) {
    this.noeuds = arbre.noeuds
    this.racine = arbre.racine
    this.fils = new Map()
    this.pere = new Map()
    for (const l of arbre.liaisons) {
      if (!this.fils.has(l.de)) this.fils.set(l.de, [])
      this.fils.get(l.de).push(l.vers)
      this.pere.set(l.vers, l.de)
    }
    this.destinations = new Map(dessertes.map((d) => [d.i, d]))
    this._cache = new Map()
    this.angle = new Map()
    this._poserAngles()
    this._poserCouleurs(cible)
  }

  sousDestinations(n) {
    if (this._cache.has(n)) return this._cache.get(n)
    let res = []
    if (this.destinations.has(n)) res.push(n)
    for (const f of this.fils.get(n) || []) res = res.concat(this.sousDestinations(f))
    this._cache.set(n, res)
    return res
  }

  _poserAngles() {
    for (const n of this.noeuds.keys()) {
      const sous = this.sousDestinations(n)
      if (this.destinations.has(n)) this.angle.set(n, this.destinations.get(n).azimut)
      else if (sous.length) {
        this.angle.set(n, moyenneAngulaire(sous.map((s) => this.destinations.get(s).azimut)))
      } else this.angle.set(n, 0)
    }
  }

  _attribuer(tetes) {
    // Le corridor d'un nœud est la tête la plus proche en remontant : c'est ce
    // qui garantit que tout l'arbre est couvert, tronc et antennes compris.
    const attrib = new Map()
    const pile = [[this.racine, null]]
    while (pile.length) {
      let [n, t] = pile.pop()
      if (tetes.includes(n)) t = n
      attrib.set(n, t)
      for (const f of this.fils.get(n) || []) pile.push([f, t])
    }
    return attrib
  }

  _utiles(tetes) {
    const attrib = this._attribuer(tetes)
    const porte = new Set([...this.destinations.keys()].map((s) => attrib.get(s)))
    return tetes.filter((t) => porte.has(t))
  }

  /** Embranchement où le réseau diverge le plus : le plus de destinations
   *  séparées, dans les directions les plus opposées. */
  _meilleureCoupe(tetes, attrib) {
    const charge = new Map()
    for (const s of this.destinations.keys()) {
      const t = attrib.get(s)
      charge.set(t, (charge.get(t) || 0) + 1)
    }
    let meilleur = null
    for (const [n, t] of attrib) {
      if (t === null || t === undefined) continue
      const fils = (this.fils.get(n) || []).filter((x) => !tetes.includes(x))
      if (fils.length < 2) continue
      const tailles = fils.map((x) => [this.sousDestinations(x).length, x])
        .sort((a, b) => b[0] - a[0])
      if (tailles[1][0] < 1) continue
      const ecart = Math.abs(ecartAngulaire(this.angle.get(tailles[0][1]),
                                            this.angle.get(tailles[1][1])))
      const note = Math.min(tailles[0][0], tailles[1][0]) * Math.max(ecart, 0.05)
                   * Math.sqrt(charge.get(t) || 1)
      if (meilleur === null || note > meilleur[0]) meilleur = [note, t, fils]
    }
    return meilleur
  }

  _poserCouleurs(cible) {
    let tetes = [...(this.fils.get(this.racine) || [])]
    if (!tetes.length) tetes = [this.racine]
    while (this._utiles(tetes).length < cible) {
      const coupe = this._meilleureCoupe(tetes, this._attribuer(tetes))
      if (!coupe) break
      for (const x of coupe[2]) if (!tetes.includes(x)) tetes.push(x)
    }
    tetes = this._utiles(tetes)
    // Une coupe ouvre deux corridors d'un coup et peut dépasser le nuancier :
    // on rend alors au corridor amont les têtes les moins chargées.
    while (tetes.length > PALETTE.length) {
      const attrib = this._attribuer(tetes)
      const charge = new Map(tetes.map((t) => [t, 0]))
      for (const s of this.destinations.keys()) {
        if (charge.has(attrib.get(s))) charge.set(attrib.get(s), charge.get(attrib.get(s)) + 1)
      }
      let pire = tetes[0]
      for (const t of tetes) if (charge.get(t) < charge.get(pire)) pire = t
      tetes = this._utiles(tetes.filter((t) => t !== pire))
    }
    tetes.sort((a, b) => this.angle.get(a) - this.angle.get(b))

    this.groupes = tetes
    this.lettre = new Map(tetes.map((t, i) => [t, LETTRES[i % LETTRES.length]]))
    const teinte = new Map(tetes.map((t, i) => [t, PALETTE[i % PALETTE.length]]))
    this.tete = this._attribuer(tetes)
    this.couleur = new Map()
    for (const n of this.noeuds.keys()) {
      this.couleur.set(n, teinte.get(this.tete.get(n)) || '#231F20')
    }
  }

  /** Destinations d'un corridor, du plus proche au plus lointain. Attribuées
   *  par la tête et non par la descendance : ce qui est posé sur le tronc avant
   *  la bifurcation appartient au corridor et doit figurer dans sa liste. */
  dessertes(groupe) {
    return [...this.destinations.entries()]
      .filter(([s]) => this.tete.get(s) === groupe)
      .map(([, d]) => d)
      .sort((a, b) => a.minutes - b.minutes)
  }

  /** Dernière desserte de chaque corridor : sur un plan de réseau, le terminus
   *  se marque autrement. */
  terminus() {
    const out = new Set()
    for (const g of this.groupes) {
      const d = this.dessertes(g)
      if (d.length) out.add(d[d.length - 1].i)
    }
    return out
  }
}

/** Deux destinations de même azimut et de même temps se superposeraient. On
 *  n'écarte que ce qui se touche, et de peu : l'angle porte une information
 *  géographique, le déformer au-delà de quelques degrés ferait mentir la carte. */
export function ecarterPoints(corridors, echelle, minimum = 14, borne = 9) {
  const dests = [...corridors.destinations.keys()]
  const base = new Map(dests.map((n) => [n, corridors.angle.get(n)]))
  const angle = new Map(base)
  const rayon = (n) => corridors.noeuds.get(n).minutes * echelle
  const xy = (n, a) => [rayon(n) * Math.sin(a), -rayon(n) * Math.cos(a)]
  const limite = (borne * Math.PI) / 180

  for (let tour = 0; tour < 400; tour++) {
    const poussee = new Map(dests.map((n) => [n, 0]))
    let bouge = false
    for (let i = 0; i < dests.length; i++) {
      const a = dests[i]
      const [xa, ya] = xy(a, angle.get(a))
      for (let j = i + 1; j < dests.length; j++) {
        const b = dests[j]
        const [xb, yb] = xy(b, angle.get(b))
        const d = Math.hypot(xa - xb, ya - yb)
        if (d < minimum && d > 0) {
          const sens = ecartAngulaire(angle.get(a), angle.get(b)) > 0 ? 1 : -1
          const f = 0.004 * (minimum - d) / minimum
          poussee.set(a, poussee.get(a) + sens * f)
          poussee.set(b, poussee.get(b) - sens * f)
          bouge = true
        }
      }
    }
    if (!bouge) break
    for (const n of dests) {
      let a = angle.get(n) + poussee.get(n)
      a -= 0.04 * ecartAngulaire(a, base.get(n))
      const e = ecartAngulaire(a, base.get(n))
      if (Math.abs(e) > limite) a = base.get(n) + Math.sign(e) * limite
      angle.set(n, a)
    }
  }
  return angle
}
