// Chargement des données et calcul complet depuis un point de départ.

import { preparer, dijkstra, accrocher } from './graphe.js'
import { desservir, construireArbre, Corridors } from './corridors.js'

const BASE = import.meta.env.BASE_URL

async function json(nom) {
  const r = await fetch(BASE + 'data/' + nom)
  if (!r.ok) throw new Error('données introuvables : ' + nom)
  return r.json()
}

/** Le graphe et les métadonnées d'abord, la géométrie ensuite : la page est
 *  utilisable dès que le calcul l'est, le tracé arrive une seconde plus tard. */
export async function charger(surGeometrie) {
  const [brut, reference, meta] = await Promise.all([
    json('graphe.json'), json('reference.json'), json('meta.json'),
  ])
  const G = preparer(brut)
  json('geometrie.json').then(surGeometrie).catch(() => {})
  return { G, reference, meta }
}

/** Tout ce que la page affiche pour un départ donné. */
export function calculerDepuis(G, reference, meta, depart) {
  const t0 = performance.now()
  const calcul = dijkstra(G, depart)
  const dessertes = desservir(G, calcul, reference.destinations, depart,
                              meta.vitesse_kmh)
  const arbre = construireArbre(G, depart, dessertes, meta.vitesse_kmh)
  const corridors = new Corridors(arbre, dessertes)

  const minutes = dessertes.map((d) => d.minutes).sort((a, b) => a - b)
  const detours = dessertes.map((d) => d.detour).filter(Boolean).sort((a, b) => a - b)
  const communes = dessertes.filter((d) => d.famille === 'commune')
  const resume = {
    destinations: dessertes.length,
    communes: communes.length,
    poles: dessertes.length - communes.length,
    sous30: dessertes.filter((d) => d.minutes <= 30).length,
    communes_sous30: communes.filter((d) => d.minutes <= 30).length,
    minutes_max: minutes.length ? minutes[minutes.length - 1] : 0,
    detour_median: detours.length ? detours[Math.floor(detours.length / 2)] : null,
    part_amenagee: dessertes.length
      ? dessertes.reduce((s, d) => s + d.part_amenagee, 0) / dessertes.length : 0,
    ms: Math.round(performance.now() - t0),
  }
  return { depart, calcul, dessertes, arbre, corridors, resume }
}

export { accrocher }
