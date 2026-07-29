import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BLANC, NOIR } from './lib/charte.js'
import { AMENAGEMENTS } from './lib/charte.js'

// Fonds de la Géoplateforme, sans clé. Ils sont atténués par filtre CSS : le
// réseau doit rester lisible sur l'un comme sur l'autre sans changer de couleur.
const FONDS = {
  plan: {
    nom: 'Plan IGN',
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    attribution: 'IGN — Géoplateforme',
    filtre: 'grayscale(0.58) brightness(1.06) contrast(0.9)',
  },
  ortho: {
    nom: 'Photographie aérienne',
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    attribution: 'IGN — Géoplateforme',
    filtre: 'saturate(0.55) brightness(1.02)',
  },
  osm: {
    nom: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    filtre: 'grayscale(0.5) brightness(1.05)',
  },
}

/** Remonte l'arbre de Dijkstra de `vers` jusqu'à `de` et rend le tracé. */
function traceLiaison(calcul, geometrie, de, vers) {
  const morceaux = []
  let x = vers
  while (x !== de && x !== -1) {
    const e = calcul.pereArete[x]
    if (e === -1) break
    morceaux.push(geometrie[e])
    x = calcul.pere[x]
  }
  return morceaux
}

/** Une polyligne d'arêtes remises bout à bout : les arêtes sont exportées dans
 *  leur sens de saisie, il faut les retourner quand elles ne se raccordent pas. */
function coudre(morceaux) {
  const out = []
  for (const m of morceaux) {
    if (!m || m.length < 2) continue
    let pts = m
    if (out.length) {
      const dernier = out[out.length - 1]
      const d0 = Math.hypot(dernier[1] - pts[0][1], dernier[0] - pts[0][0])
      const d1 = Math.hypot(dernier[1] - pts[pts.length - 1][1],
                            dernier[0] - pts[pts.length - 1][0])
      if (d1 < d0) pts = [...pts].reverse()
      out.push(...pts.slice(1).map((p) => [p[1], p[0]]))
    } else {
      out.push(...pts.map((p) => [p[1], p[0]]))
    }
  }
  return out
}

export default function Carte({ donnees, geometrie, resultat, fond, reseau, survol,
                               selection, onSurvol, onSelection, onDeplacer }) {
  const boite = useRef(null)
  const carte = useRef(null)
  const tuiles = useRef(null)
  const couches = useRef({})
  const depart = useRef(null)

  // --- création, une fois
  useEffect(() => {
    const c = L.map(boite.current, {
      center: [donnees.meta.centre.lat, donnees.meta.centre.lon],
      zoom: 12,
      zoomControl: true,
      preferCanvas: true,
    })
    carte.current = c
    couches.current = {
      amenagements: L.layerGroup().addTo(c),
      branches: L.layerGroup().addTo(c),
      surbrillance: L.layerGroup().addTo(c),
      jalons: L.layerGroup().addTo(c),
    }
    c.on('click', (e) => onDeplacer(e.latlng.lat, e.latlng.lng))
    if (import.meta.env.DEV) window.__carte = c
    return () => { c.remove(); carte.current = null }
  }, [])

  // --- fond
  useEffect(() => {
    const c = carte.current
    if (!c) return
    if (tuiles.current) c.removeLayer(tuiles.current)
    const f = FONDS[fond]
    tuiles.current = L.tileLayer(f.url, {
      attribution: f.attribution, maxZoom: 18, className: 'fond-attenue',
    }).addTo(c)
    tuiles.current.getContainer().style.filter = f.filtre
    tuiles.current.bringToBack()
  }, [fond])

  // --- réseau cyclable de la Métropole : il qualifie le territoire, il ne
  //     dépend pas du départ. Il reste en retrait : l'objet de la page est
  //     l'étoile des temps, le réseau en est le décor.
  useEffect(() => {
    const c = carte.current
    if (!c) return
    const g = couches.current.amenagements
    g.clearLayers()
    if (!reseau) return
    for (const t of AMENAGEMENTS) {
      const lignes = donnees.reference.amenagements[t.cle] || []
      for (const l of lignes) {
        const pts = l.map((p) => [p[1], p[0]])
        L.polyline(pts, { color: BLANC, weight: t.epaisseur + 1.4, opacity: 0.4,
                          interactive: false }).addTo(g)
        L.polyline(pts, { color: t.couleur, weight: t.epaisseur * 0.8, opacity: 0.55,
                          interactive: false }).addTo(g)
      }
    }
    g.eachLayer((l) => l.bringToBack())
    if (tuiles.current) tuiles.current.bringToBack()
  }, [donnees, reseau])

  // --- branches des corridors, redessinées à chaque départ
  useEffect(() => {
    const c = carte.current
    if (!c || !resultat || !geometrie) return
    const { corridors, calcul } = resultat
    const g = couches.current.branches
    g.clearLayers()
    for (const l of resultat.arbre.liaisons) {
      const pts = coudre(traceLiaison(calcul, geometrie, l.de, l.vers))
      if (pts.length < 2) continue
      const k = corridors.sousDestinations(l.vers).length
      const poids = 2.6 + 0.9 * Math.sqrt(Math.max(k, 1))
      L.polyline(pts, { color: BLANC, weight: poids + 2.4, opacity: 0.85,
                        interactive: false, lineCap: 'round' }).addTo(g)
      L.polyline(pts, { color: corridors.couleur.get(l.vers), weight: poids,
                        opacity: 1, interactive: false, lineCap: 'round' }).addTo(g)
    }
  }, [resultat, geometrie])

  // --- jalons : une pastille par destination, portant sa durée
  useEffect(() => {
    const c = carte.current
    if (!c || !resultat) return
    const g = couches.current.jalons
    g.clearLayers()
    const term = resultat.corridors.terminus()
    for (const d of resultat.dessertes) {
      const couleur = resultat.corridors.couleur.get(d.i) || NOIR
      const marque = L.marker([d.lat, d.lon], {
        icon: L.divIcon({
          className: 'jalon' + (term.has(d.i) ? ' terminus' : ''),
          html: `<span class="pastille" style="background:${couleur}">${Math.round(d.minutes)}</span>`
                + `<span class="nom">${d.carte}</span>`,
          iconSize: null,
        }),
        riseOnHover: true,
        keyboard: false,
      })
      marque.on('mouseover', () => onSurvol(d.i))
      marque.on('mouseout', () => onSurvol(null))
      marque.on('click', (e) => { L.DomEvent.stop(e); onSelection(d.i) })
      marque.addTo(g)
    }
  }, [resultat])

  // --- surbrillance : l'itinéraire de la destination tenue ou choisie
  useEffect(() => {
    const c = carte.current
    if (!c || !resultat || !geometrie) return
    const g = couches.current.surbrillance
    g.clearLayers()
    const cible = selection ?? survol
    if (cible === null || cible === undefined) return
    const d = resultat.dessertes.find((x) => x.i === cible)
    if (!d) return
    const pts = coudre(d.chemin.aretes.map((e) => geometrie[e]))
    if (pts.length < 2) return
    L.polyline(pts, { color: NOIR, weight: 10, opacity: 0.28,
                      interactive: false, lineCap: 'round' }).addTo(g)
    L.polyline(pts, { color: BLANC, weight: 4.2, opacity: 1,
                      interactive: false, dashArray: '1 7', lineCap: 'round' }).addTo(g)
  }, [survol, selection, resultat, geometrie])

  // --- point de départ, déplaçable
  useEffect(() => {
    const c = carte.current
    if (!c || !resultat) return
    const G = donnees.G
    const pos = [G.lat[resultat.depart], G.lon[resultat.depart]]
    if (!depart.current) {
      depart.current = L.marker(pos, {
        draggable: true,
        zIndexOffset: 1000,
        icon: L.divIcon({ className: 'depart', html: '<span></span>', iconSize: [26, 26] }),
      }).addTo(c)
      depart.current.on('dragend', (e) => {
        const p = e.target.getLatLng()
        onDeplacer(p.lat, p.lng)
      })
      depart.current.bindTooltip('Point de départ — déplacez-le', { direction: 'top' })
    } else {
      depart.current.setLatLng(pos)
    }
  }, [resultat])

  return <div className="carte" ref={boite} />
}

export { FONDS }
