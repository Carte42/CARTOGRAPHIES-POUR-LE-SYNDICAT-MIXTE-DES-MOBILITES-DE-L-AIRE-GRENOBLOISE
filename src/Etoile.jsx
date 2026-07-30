import { useMemo } from 'react'
import { ecarterPoints } from './lib/corridors.js'
import { BLANC, NOIR, GRIS, GRIS_FONCE, JAUNE_CLAIR } from './lib/charte.js'

// Le diagramme en étoile de la planche cart_3_2, recomposé pour le départ
// courant. Mêmes règles qu'à l'impression : le rayon porte la durée, l'angle
// porte l'azimut réel, une branche est un corridor réellement emprunté.
//
// Le cadrage, lui, ne peut pas être celui de la planche : là-bas le pôle est
// posé à la main dans sa zone, ici le départ change et l'étoile avec lui. Le
// cadre suit donc les points, et les anneaux se laissent couper.

const RAYON_MAX = 430
const ANNEAUX = [15, 30, 45, 60, 75, 90, 105, 120, 150]
const CORPS = 15

function largeurApprochee(texte) {
  return texte.length * CORPS * 0.5
}

/** Directions du moins encombré au plus encombré : la graduation des anneaux et
 *  le nom du départ s'y posent, là où ils ne recouvrent aucune branche. */
function directionsLibres(angles) {
  const secteurs = new Array(36).fill(0)
  for (const a of angles) {
    const k = Math.floor((((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * 36)
    for (let d = -2; d <= 2; d++) secteurs[(k + d + 36) % 36] += 3 - Math.abs(d)
  }
  return secteurs
    .map((poids, k) => ({ poids, angle: ((k + 0.5) / 36) * 2 * Math.PI }))
    .sort((a, b) => a.poids - b.poids)
    .map((s) => s.angle)
}

function dansLeCadre(x, y, cadre) {
  return x > cadre[0] + 30 && x < cadre[0] + cadre[2] - 30 &&
         y > cadre[1] + 18 && y < cadre[1] + cadre[3] - 10
}

/** Une seule direction pour toute la graduation : dégagée, et qui garde dans le
 *  cadre le plus d'anneaux possible.
 *
 *  Choisir la direction anneau par anneau, comme on le faisait d'abord, éparpille
 *  « 15 min » au nord et « 90 min » au nord-est : la graduation cesse de se lire
 *  comme une échelle. Le cadre étant rectangulaire et contenant le centre, un
 *  anneau qui tient dans une direction y fait tenir tous les plus petits.
 */
function directionGraduation(rayons, directions, cadre) {
  let meilleure = directions[0], mieux = -1
  for (const a of directions) {
    let n = 0
    for (const r of rayons) {
      if (dansLeCadre(r * Math.sin(a), -r * Math.cos(a), cadre)) n++
    }
    if (n > mieux) { mieux = n; meilleure = a }
    if (n === rayons.length) break
  }
  return meilleure
}

export default function Etoile({ resultat, nomDepart, vitesse, survol, selection,
                                 onSurvol, onSelection }) {
  const dessin = useMemo(() => {
    if (!resultat) return null
    const { corridors, dessertes } = resultat
    const maxMin = Math.max(...dessertes.map((d) => d.minutes), 1)
    const echelle = RAYON_MAX / maxMin
    const anglesDest = ecarterPoints(corridors, echelle, 17)

    const angle = (n) => anglesDest.get(n) ?? corridors.angle.get(n)
    const rayon = (n) => corridors.noeuds.get(n).minutes * echelle
    const xy = (n) => [rayon(n) * Math.sin(angle(n)), -rayon(n) * Math.cos(angle(n))]

    const branches = resultat.arbre.liaisons.map((l) => {
      const a = xy(l.de), b = xy(l.vers)
      const k = corridors.sousDestinations(l.vers).length
      return {
        cle: l.de + ':' + l.vers, a, b,
        poids: 3.4 + 1.5 * Math.sqrt(Math.max(k, 1)),
        couleur: corridors.couleur.get(l.vers),
      }
    })

    const terminus = corridors.terminus()
    // Les noms se posent du plus lointain au plus proche : les terminus, qu'on
    // cherche en premier sur un plan de réseau, prennent la place d'abord.
    const jalons = [...dessertes].sort((a, b) => b.minutes - a.minutes).map((d) => {
      const [x, y] = xy(d.i)
      return { d, x, y, couleur: corridors.couleur.get(d.i),
               terminus: terminus.has(d.i), a: angle(d.i) }
    })

    // Obstacles de départ : les pastilles elles-mêmes, qui ne bougent pas. Le
    // nom se cherche une place autour de son jalon, du plus près au plus loin ;
    // faute de place, le jalon reste anonyme et la colonne de gauche le nomme.
    const poses = jalons.map((j) => [j.x - 13, j.y - 13, j.x + 13, j.y + 13])
    const CANDIDATS = []
    for (const recul of [15, 24, 34, 46, 62]) {
      for (const cote of [1, -1]) {
        for (const dv of [0, -1.05, 1.05, -2.0, 2.0]) {
          CANDIDATS.push({ recul, cote, dv })
        }
      }
    }
    for (const j of jalons) {
      const prefere = Math.sin(j.a) >= 0 ? 1 : -1
      const w = largeurApprochee(j.d.carte)
      const essais = [...CANDIDATS].sort(
        (a, b) => (a.recul - b.recul) || (Math.abs(a.dv) - Math.abs(b.dv))
                  || (a.cote === prefere ? -1 : 1))
      for (const c of essais) {
        const x = j.x + c.cote * c.recul
        const y = j.y + CORPS * 0.34 + c.dv * CORPS * 1.15
        const boite = [c.cote > 0 ? x : x - w, y - CORPS, c.cote > 0 ? x + w : x, y + 4]
        const heurte = poses.some((b) => boite[0] < b[2] && b[0] < boite[2] &&
                                          boite[1] < b[3] && b[1] < boite[3])
        if (!heurte) {
          poses.push(boite)
          j.nom = { x, y, cote: c.cote,
                    filet: c.recul > 20 || Math.abs(c.dv) > 0.5 }
          break
        }
      }
    }

    // la lettre du corridor se pose sur son tronc, à mi-chemin du premier saut
    const lettres = corridors.groupes.map((g) => {
      const [x, y] = xy(g)
      const p = corridors.pere.get(g)
      const [px, py] = p !== undefined ? xy(p) : [0, 0]
      return { g, lettre: corridors.lettre.get(g), couleur: corridors.couleur.get(g),
               x: (x + px) / 2, y: (y + py) / 2 }
    })

    // cadre : la boîte de tout ce qui est dessiné, plus une marge
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0
    for (const b of poses) {
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1])
      x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3])
    }
    // marge du haut plus large : le titre du départ s'y loge
    const marge = 30
    const cadre = [x0 - marge, y0 - marge - 46,
                   x1 - x0 + 2 * marge, y1 - y0 + 2 * marge + 46]

    const directions = directionsLibres(jalons.map((j) => j.a))
    const minutesAnneaux = ANNEAUX.filter((m) => m <= maxMin)
    const dir = directionGraduation(minutesAnneaux.map((m) => m * echelle),
                                    directions, cadre)
    // Une graduation posée pile sur un jalon disparaît sous sa pastille : on la
    // fait glisser LE LONG de son anneau, en restant dans le même secteur pour
    // que l'échelle continue de se lire d'un seul coup d'œil.
    const anneaux = minutesAnneaux.map((m) => {
      const r = m * echelle
      let pose = null
      for (const ecart of [0, 3, -3, 6, -6, 10, -10, 15, -15, 21, -21, 28, -28]) {
        const a = dir + (ecart * Math.PI) / 180
        const x = r * Math.sin(a), y = -r * Math.cos(a)
        if (!dansLeCadre(x, y, cadre)) continue
        const gene = jalons.some((j) => Math.abs(j.x - x) < 34 && Math.abs(j.y - y) < 20)
        if (!gene) { pose = { x, y }; break }
      }
      return { m, r, pose }
    })

    return { branches, jalons, lettres, echelle, cadre, anneaux }
  }, [resultat])

  if (!dessin) return null
  const cible = selection ?? survol

  return (
    <svg className="etoile" viewBox={dessin.cadre.join(' ')} role="img"
         aria-label="Diagramme en étoile des temps de parcours">
      <g>
        {dessin.anneaux.map((a) => (
          <g key={a.m}>
            <circle cx="0" cy="0" r={a.r} fill="none" stroke={JAUNE_CLAIR}
                    strokeWidth="2.5" />
            {a.pose && (
              <text x={a.pose.x} y={a.pose.y} fill={GRIS} fontSize="14"
                    textAnchor="middle" className="nom-etoile">{a.m} min</text>
            )}
          </g>
        ))}
      </g>

      <g>
        {dessin.branches.map((b) => (
          <line key={b.cle} x1={b.a[0]} y1={b.a[1]} x2={b.b[0]} y2={b.b[1]}
                stroke={BLANC} strokeWidth={b.poids + 2.6} strokeLinecap="round" />
        ))}
        {dessin.branches.map((b) => (
          <line key={b.cle} x1={b.a[0]} y1={b.a[1]} x2={b.b[0]} y2={b.b[1]}
                stroke={b.couleur} strokeWidth={b.poids} strokeLinecap="round" />
        ))}
      </g>

      <g>
        {dessin.jalons.map((j) => {
          const actif = cible === j.d.i
          return (
            <g key={j.d.i} className={'jalon-etoile' + (actif ? ' actif' : '')}
               onMouseEnter={() => onSurvol(j.d.i)}
               onMouseLeave={() => onSurvol(null)}
               onClick={() => onSelection(j.d.i)}>
              {j.nom && j.nom.filet && (
                <line x1={j.x + j.nom.cote * 11} y1={j.y}
                      x2={j.nom.x - j.nom.cote * 2} y2={j.nom.y - 4}
                      stroke={GRIS} strokeWidth="1" />
              )}
              <circle cx={j.x} cy={j.y} r={actif ? 14 : j.terminus ? 11.5 : 9}
                      fill={j.terminus ? j.couleur : BLANC}
                      stroke={j.terminus ? BLANC : j.couleur}
                      strokeWidth={j.terminus ? 2.5 : 3.4} />
              <text x={j.x} y={j.y + 4} textAnchor="middle" fontSize="11.5"
                    fontWeight="700" fill={j.terminus ? BLANC : NOIR}
                    pointerEvents="none">
                {Math.round(j.d.minutes)}
              </text>
              {(j.nom || actif) && (
                <text x={j.nom ? j.nom.x : j.x + 15}
                      y={j.nom ? j.nom.y : j.y + 5}
                      textAnchor={(j.nom ? j.nom.cote : 1) > 0 ? 'start' : 'end'}
                      fontSize={CORPS} fill={actif ? NOIR : GRIS_FONCE}
                      fontWeight={j.terminus || actif ? '700' : '400'}
                      pointerEvents="none" className="nom-etoile">
                  {j.d.carte}
                </text>
              )}
            </g>
          )
        })}
      </g>

      <g>
        {dessin.lettres.map((l) => (
          <g key={l.g}>
            <circle cx={l.x} cy={l.y} r="13" fill={l.couleur} stroke={BLANC}
                    strokeWidth="2.5" />
            <text x={l.x} y={l.y + 5} textAnchor="middle" fontSize="15"
                  fontWeight="800" fill={BLANC}>{l.lettre}</text>
          </g>
        ))}
      </g>

      <circle cx="0" cy="0" r="12" fill={NOIR} stroke={BLANC} strokeWidth="3.5" />

      {/* Le départ se nomme en tête du cadre : au centre, l'espace appartient
          aux destinations les plus proches, qui s'y pressent. */}
      <g transform={`translate(${dessin.cadre[0] + 20} ${dessin.cadre[1] + 26})`}>
        <circle cx="9" cy="-5" r="9" fill={NOIR} stroke={BLANC} strokeWidth="2.5" />
        <text x="26" y="0" fontSize="18" fontWeight="800" fill={NOIR}>{nomDepart}</text>
        <text x="26" y="22" fontSize="14" fill={GRIS_FONCE}>
          temps de parcours à vélo, à {vitesse} km/h
        </text>
      </g>
    </svg>
  )
}
