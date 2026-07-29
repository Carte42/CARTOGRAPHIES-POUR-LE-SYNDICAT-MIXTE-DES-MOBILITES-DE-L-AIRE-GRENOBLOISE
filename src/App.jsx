import { useEffect, useMemo, useRef, useState } from 'react'
import Carte, { FONDS } from './Carte.jsx'
import Etoile from './Etoile.jsx'
import Panneau from './Panneau.jsx'
import { charger, calculerDepuis, accrocher } from './lib/calcul.js'

export default function App() {
  const [donnees, setDonnees] = useState(null)
  const [geometrie, setGeometrie] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [depart, setDepart] = useState(null)     // { i, ecart_m, libre }
  const [vue, setVue] = useState('carte')
  const [fond, setFond] = useState('plan')
  const [reseau, setReseau] = useState(true)
  const [survol, setSurvol] = useState(null)
  const [selection, setSelection] = useState(null)
  const controle = useRef(null)

  useEffect(() => {
    charger(setGeometrie)
      .then((d) => {
        setDonnees(d)
        const a = accrocher(d.G, d.meta.centre.lat, d.meta.centre.lon)
        setDepart({ i: a.i, ecart_m: a.ecart_m, libre: false })
      })
      .catch((e) => setErreur(e.message))
  }, [])

  const resultat = useMemo(() => {
    if (!donnees || !depart) return null
    return calculerDepuis(donnees.G, donnees.reference, donnees.meta, depart.i)
  }, [donnees, depart])

  // Contrôle : au départ de la planche, la page doit rendre exactement ses
  // chiffres. Un écart ici voudrait dire que le jury lit deux valeurs
  // différentes pour la même liaison, sur la planche et à l'écran.
  useEffect(() => {
    if (!resultat || depart?.libre || controle.current) return
    let ecartMin = 0, ecartKm = 0
    for (const d of resultat.dessertes) {
      ecartMin = Math.max(ecartMin, Math.abs(d.minutes - d.min_planche))
      ecartKm = Math.max(ecartKm, Math.abs(d.km - d.km_planche))
    }
    controle.current = { n: resultat.dessertes.length, ecartMin, ecartKm }
    if (import.meta.env.DEV) {
      // relevé par scripts/02_controle.py
      window.__controle = { ...controle.current, ms: resultat.resume.ms }
      console.log('[contrôle planche] %d destinations, écart max %s min / %s km',
                  resultat.dessertes.length, ecartMin.toFixed(3), ecartKm.toFixed(4))
    }
  }, [resultat, depart])

  function deplacer(lat, lon) {
    if (!donnees) return
    const a = accrocher(donnees.G, lat, lon)
    setSelection(null)
    setDepart({ i: a.i, ecart_m: a.ecart_m, libre: true })
  }

  function revenir() {
    if (!donnees) return
    const a = accrocher(donnees.G, donnees.meta.centre.lat, donnees.meta.centre.lon)
    setSelection(null)
    setDepart({ i: a.i, ecart_m: a.ecart_m, libre: false })
  }

  if (erreur) {
    return <div className="attente"><p>Chargement impossible : {erreur}</p></div>
  }
  if (!donnees || !resultat) {
    return (
      <div className="attente">
        <p className="marque">Carte 42</p>
        <p>Chargement du réseau cyclable de l'aire grenobloise…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <Panneau
        donnees={donnees}
        resultat={resultat}
        depart={depart}
        controle={controle.current}
        survol={survol}
        selection={selection}
        onSurvol={setSurvol}
        onSelection={(i) => setSelection((s) => (s === i ? null : i))}
        onRevenir={revenir}
      />

      <main className="scene">
        <div className="barre">
          <div className="onglets">
            <button className={vue === 'carte' ? 'actif' : ''}
                    onClick={() => setVue('carte')}>Carte</button>
            <button className={vue === 'etoile' ? 'actif' : ''}
                    onClick={() => setVue('etoile')}>Spidermap</button>
          </div>
          {vue === 'carte' && (
            <div className="fonds">
              {Object.entries(FONDS).map(([cle, f]) => (
                <button key={cle} className={fond === cle ? 'actif' : ''}
                        onClick={() => setFond(cle)}>{f.nom}</button>
              ))}
              <button className={reseau ? 'actif' : ''}
                      onClick={() => setReseau((r) => !r)}>Réseau cyclable</button>
            </div>
          )}
          <p className="indication">
            {depart.libre
              ? <>Départ libre, accroché au réseau à {Math.round(depart.ecart_m)} m.{' '}
                  <button className="lien" onClick={revenir}>revenir à la gare de Grenoble</button></>
              : <>Départ de la planche jointe : {donnees.meta.centre.nom}. Déplacez le point noir, ou cliquez sur la carte.</>}
          </p>
        </div>

        <div className="vue">
          <div style={{ display: vue === 'carte' ? 'block' : 'none', height: '100%' }}>
            <Carte
              donnees={donnees}
              geometrie={geometrie}
              resultat={resultat}
              fond={fond}
              reseau={reseau}
              survol={survol}
              selection={selection}
              onSurvol={setSurvol}
              onSelection={(i) => setSelection((s) => (s === i ? null : i))}
              onDeplacer={deplacer}
            />
          </div>
          {vue === 'etoile' && (
            <div className="cadre-etoile">
              <Etoile resultat={resultat} survol={survol} selection={selection}
                      nomDepart={depart.libre ? 'Départ choisi' : donnees.meta.centre.nom}
                      vitesse={donnees.meta.vitesse_kmh}
                      onSurvol={setSurvol}
                      onSelection={(i) => setSelection((s) => (s === i ? null : i))} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
