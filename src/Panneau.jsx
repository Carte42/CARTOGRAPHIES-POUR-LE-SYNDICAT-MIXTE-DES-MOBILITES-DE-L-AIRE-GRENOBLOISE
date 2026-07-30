import { AMENAGEMENTS, FAMILLES } from './lib/charte.js'

/** Nombre décimal à la française : la virgule, sur une pièce de marché public. */
function nb(v, d = 2) {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: d,
                                     maximumFractionDigits: d })
}

export default function Panneau({ donnees, resultat, depart, controle, survol,
                                  selection, onSurvol, onSelection, onRevenir }) {
  const { meta } = donnees
  const { resume, corridors, dessertes } = resultat
  const choisie = dessertes.find((d) => d.i === selection)

  return (
    <aside className="panneau">
      <header>
        <p className="marque">Carte 42</p>
        <h1>Temps de parcours à vélo</h1>
        <p className="sous-titre">Aire grenobloise · depuis {depart.libre
          ? 'un départ choisi' : meta.centre.nom}</p>
      </header>

      <section className="mode-emploi">
        <p>
          Cette page refait, dans votre navigateur, le calcul qui produit la
          planche « temps de parcours » jointe à l'offre. Le point de départ n'y
          est plus figé.
        </p>
        <ol>
          <li>Déplacez le point noir, ou cliquez ailleurs sur la carte.</li>
          <li>Les {resume.destinations} destinations et les corridors se recalculent.</li>
          <li>L'onglet « Spidermap » montre la planche recomposée pour ce départ.</li>
        </ol>
      </section>

      {choisie && (
        <section className="fiche">
          <button className="fermer" onClick={() => onSelection(choisie.i)}>×</button>
          <h2>{choisie.carte}</h2>
          <p className="famille">{FAMILLES[choisie.famille] || choisie.famille}</p>
          <dl>
            <div><dt>Durée</dt><dd>{nb(choisie.minutes, 1)} min</dd></div>
            <div><dt>Distance</dt><dd>{nb(choisie.km, 2)} km</dd></div>
            <div><dt>Sur aménagement</dt><dd>{Math.round(100 * choisie.part_amenagee)} %</dd></div>
            <div><dt>Détour</dt><dd>{choisie.detour ? nb(choisie.detour, 2) + ' ×' : '—'}</dd></div>
            <div><dt>Corridor</dt><dd>{corridors.lettre.get(corridors.tete.get(choisie.i)) || '—'}</dd></div>
          </dl>
        </section>
      )}

      <section className="corridors">
        <h2>Les corridors</h2>
        <p className="chapeau">
          Une branche est un itinéraire réellement emprunté : deux destinations
          desservies par le même chemin la partagent jusqu'à l'embranchement réel.
        </p>
        {corridors.groupes.map((g) => (
          <div className="corridor" key={g}>
            <span className="lettre" style={{ background: corridors.couleur.get(g) }}>
              {corridors.lettre.get(g)}
            </span>
            <p>
              {corridors.dessertes(g).map((d, k) => (
                <span key={d.i}
                      className={'desserte' + (survol === d.i || selection === d.i ? ' actif' : '')}
                      onMouseEnter={() => onSurvol(d.i)}
                      onMouseLeave={() => onSurvol(null)}
                      onClick={() => onSelection(d.i)}>
                  {k ? ' · ' : ''}{d.carte} <em>{Math.round(d.minutes)}</em>
                </span>
              ))}
            </p>
          </div>
        ))}
      </section>

      {/* Repliables : la liste sert à lire, la méthode sert à justifier. On ouvre
          la première, on referme la seconde. */}
      <details className="liste" open>
        <summary><h2>Toutes les destinations <em>{dessertes.length}</em></h2></summary>
        <table>
          <tbody>
            {dessertes.map((d) => (
              <tr key={d.i}
                  className={(survol === d.i ? 'survol ' : '') + (selection === d.i ? 'choisi' : '')}
                  onMouseEnter={() => onSurvol(d.i)}
                  onMouseLeave={() => onSurvol(null)}
                  onClick={() => onSelection(d.i)}>
                <td className="pastille-liste">
                  <span style={{ background: corridors.couleur.get(d.i) }} />
                </td>
                <td>{d.carte}</td>
                <td className="nombre">{Math.round(d.minutes)} min</td>
                <td className="nombre gris">{nb(d.km, 1)} km</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <section className="legende">
        <h2>Le réseau dessiné</h2>
        {AMENAGEMENTS.map((a) => (
          <div key={a.cle}>
            <span className="trait" style={{ background: a.couleur }} />
            {a.nom}
            <em>{meta.km_amenagements[a.cle]} km</em>
          </div>
        ))}
      </section>

      <details className="methode">
        <summary><h2>Données et méthode</h2></summary>
        <p>
          Itinéraires calculés sur le réseau viaire d'OpenStreetMap
          ({meta.graphe.sommets.toLocaleString('fr-FR')} sommets,
          {' '}{meta.graphe.aretes.toLocaleString('fr-FR')} tronçons), à
          {' '}{meta.vitesse_kmh} km/h, avec préférence donnée aux axes doublés
          d'un aménagement cyclable. La couche cyclable de Grenoble-Alpes
          Métropole ({meta.km_amenagements_total} km) qualifie le réseau et se
          dessine ; elle ne sert pas de support de calcul.
        </p>
        <p>
          Les durées sont contrôlées contre la Chrono-map publiée par le SMMAG
          en 2021 : écart médian de {nb(meta.controle_ecart_median_min, 1)} min sur
          {' '}{meta.controle_liaisons} liaisons.
          {controle && (
            <> Au départ de {meta.centre.nom}, cette page retrouve les valeurs de
              la planche sur ses {controle.n} destinations,
              {controle.ecartMin <= 0.05 && controle.ecartKm <= 0.005
                ? ' aux arrondis d’écriture près (0,1 min et 10 m).'
                : ` à ${nb(controle.ecartMin, 1)} min près.`}</>
          )}
        </p>
        <p className="mention">
          Démonstrateur produit par Carte 42 pour la consultation
          {' '}{meta.consultation}. Il n'est pas un livrable du marché : les
          livrables sont les planches imprimées et leurs fichiers sources. La
          charte graphique et le logo du SMMAG sont repris pour les seuls besoins
          de la démonstration. Le tracé affiché est simplifié à
          {' '}{meta.tolerance_trace_m} m ; les longueurs et les durées sont
          calculées sur la géométrie complète.
        </p>
        {depart.libre && (
          <button className="lien" onClick={onRevenir}>
            revenir au départ de la planche
          </button>
        )}
      </details>
    </aside>
  )
}
