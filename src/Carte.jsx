import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BLANC, NOIR, AMENAGEMENTS, RESEAU } from './lib/charte.js'
import { orienter } from './lib/graphe.js'

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

/** Remonte l'arbre de Dijkstra de `vers` jusqu'à `de` et rend les tronçons,
 *  dans l'ordre de la marche et chacun dans le bon sens. */
function traceLiaison(G, calcul, geometrie, de, vers) {
  const morceaux = []
  let x = vers
  while (x !== de && x !== -1) {
    const e = calcul.pereArete[x]
    if (e === -1) break
    const p = calcul.pere[x]
    // on descend le père vers le fils : le tronçon part donc du père
    morceaux.push(orienter(G, geometrie, e, p))
    x = p
  }
  morceaux.reverse()
  return morceaux
}

/** Tronçons d'un itinéraire déjà connu par sa suite de sommets. */
function traceChemin(G, geometrie, chemin) {
  return chemin.aretes.map((e, k) => orienter(G, geometrie, e, chemin.sommets[k]))
}

/** Tronçons orientés remis bout à bout, en [lat, lon] pour Leaflet. Le point de
 *  raccord n'est écrit qu'une fois. */
function coudre(morceaux) {
  const out = []
  for (const m of morceaux) {
    if (!m || m.length < 2) continue
    const debut = out.length ? 1 : 0
    for (let i = debut; i < m.length; i++) out.push([m[i][1], m[i][0]])
  }
  return out
}

export default function Carte({ donnees, geometrie, resultat, fond, reseau, survol,
                               selection, onSurvol, onSelection, onDeplacer }) {
  const boite = useRef(null)
  const carte = useRef(null)
  const tuiles = useRef(null)
  const couches = useRef({})
  const rendus = useRef({})
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

    // Une pane et un canevas par couche, avec un z-index explicite.
    //
    // Sans cela, l'empilement se réglait par `bringToBack()` appliqué à chaque
    // polyligne du groupe, ce qui l'inverse : chaque appel envoie l'objet tout au
    // fond, donc le DERNIER traité finit dessous. Les liserés blancs, ajoutés
    // avant leur trait, se retrouvaient donc PAR-DESSUS lui et l'effaçaient. Le
    // réseau cyclable existait bien à l'écran, mais sous la forme de bandes
    // blanchâtres : c'est l'origine du « le réseau ne se voit pas très bien ».
    for (const [nom, z] of [['reseau', 400], ['branches', 450],
                            ['surbrillance', 475]]) {
      c.createPane(nom)
      c.getPane(nom).style.zIndex = String(z)
    }
    rendus.current = {
      reseau: L.canvas({ pane: 'reseau' }),
      branches: L.canvas({ pane: 'branches' }),
      surbrillance: L.canvas({ pane: 'surbrillance' }),
    }
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
        // liseré blanc continu sous le trait, même sous un tireté : c'est lui qui
        // détache le réseau du fond, clair comme sombre
        L.polyline(pts, { color: BLANC, weight: t.epaisseur + 2.4, opacity: 0.85,
                          interactive: false, renderer: rendus.current.reseau,
                          pane: 'reseau' }).addTo(g)
        L.polyline(pts, { color: RESEAU, weight: t.epaisseur, opacity: 1,
                          dashArray: t.tirets || undefined,
                          interactive: false, renderer: rendus.current.reseau,
                          pane: 'reseau' }).addTo(g)
      }
    }
  }, [donnees, reseau])

  // --- branches des corridors, redessinées à chaque départ
  useEffect(() => {
    const c = carte.current
    if (!c || !resultat || !geometrie) return
    const { corridors, calcul } = resultat
    const g = couches.current.branches
    g.clearLayers()
    for (const l of resultat.arbre.liaisons) {
      const pts = coudre(traceLiaison(donnees.G, calcul, geometrie, l.de, l.vers))
      if (pts.length < 2) continue
      const k = corridors.sousDestinations(l.vers).length
      const poids = 2.6 + 0.9 * Math.sqrt(Math.max(k, 1))
      L.polyline(pts, { color: BLANC, weight: poids + 2.4, opacity: 0.85,
                        interactive: false, lineCap: 'round',
                        renderer: rendus.current.branches, pane: 'branches' }).addTo(g)
      L.polyline(pts, { color: corridors.couleur.get(l.vers), weight: poids,
                        opacity: 1, interactive: false, lineCap: 'round',
                        renderer: rendus.current.branches, pane: 'branches' }).addTo(g)
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
    const pts = coudre(traceChemin(donnees.G, geometrie, d.chemin))
    if (pts.length < 2) return
    L.polyline(pts, { color: NOIR, weight: 10, opacity: 0.28,
                      interactive: false, lineCap: 'round',
                      renderer: rendus.current.surbrillance,
                      pane: 'surbrillance' }).addTo(g)
    L.polyline(pts, { color: BLANC, weight: 4.2, opacity: 1,
                      interactive: false, dashArray: '1 7', lineCap: 'round',
                      renderer: rendus.current.surbrillance,
                      pane: 'surbrillance' }).addTo(g)
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
