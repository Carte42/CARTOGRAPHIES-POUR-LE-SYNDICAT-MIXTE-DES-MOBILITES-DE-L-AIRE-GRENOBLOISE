# -*- coding: utf-8 -*-
"""Prépare pour le navigateur les données qui produisent les planches cyclables.

Rien n'est recopié à la main : ce script importe les modules qui composent les
annexes de l'offre (`reseau.py`, `temps_parcours.py`) et écrit dans
`public/data/` ce dont la page a besoin pour refaire elle-même le calcul. C'est
tout l'argument de la démonstration : la planche imprimée et la page en ligne
sortent de la même base.

Le dossier des annexes est celui du projet SMMAG, surchargeable :

    set SMMAG_ANNEXES=D:\\...\\SMMAG - Cartographie\\annexes
    python scripts/01_donnees_web.py

Quatre fichiers en sortent :

* `graphe.json`     topologie seule (sommets, arêtes, longueur, coût) — c'est ce
                    qui permet le Dijkstra côté client ;
* `geometrie.json`  tracé des arêtes, simplifié à 3 m ; il ne sert QU'À DESSINER,
                    les longueurs et les temps restent lus sur `graphe.json`, où
                    aucune coordonnée n'est simplifiée ;
* `reference.json`  destinations, aménagements cyclables, et les valeurs
                    publiées sur la planche pour le contrôle ;
* `meta.json`       vitesse, emprise, contrôle Chrono-map, chiffres clés.

Extension `.json` et non `.geojson` : GitHub Pages ne compresse que les types
MIME qu'il reconnaît.
"""
import gzip
import json
import math
import os
import sys
import time

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
SORTIE = os.path.join(RACINE, "public", "data")
ANNEXES = os.environ.get(
    "SMMAG_ANNEXES",
    r"D:\Projects\Archive\SMMAG - Cartographie\annexes")

sys.path.insert(0, ANNEXES)
import reseau  # noqa: E402
from shapely.geometry import LineString  # noqa: E402

TOL_TRACE = 3.0          # mètres, simplification du seul tracé
TOL_AMENAGEMENT = 2.0    # mètres, la couche cyclable est déjà légère
DEC = 5                  # décimales des coordonnées, soit ~1 m


def ecrire(nom, obj):
    chemin = os.path.join(SORTIE, nom)
    brut = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    with open(chemin, "wb") as f:
        f.write(brut)
    print("  %-18s %6.2f Mo   (%5.2f Mo une fois gzippé)"
          % (nom, len(brut) / 1e6, len(gzip.compress(brut, 9)) / 1e6))


def en_wgs(pts, tol=0.0):
    """Polyligne L93 vers WGS84, éventuellement simplifiée avant projection."""
    if tol and len(pts) > 2:
        pts = list(LineString(pts).simplify(tol).coords)
    out = []
    for x, y in pts:
        lon, lat = reseau.VERS_WGS.transform(x, y)
        out.append([round(lon, DEC), round(lat, DEC)])
    return out


def main():
    os.makedirs(SORTIE, exist_ok=True)
    t0 = time.time()

    with open(os.path.join(ANNEXES, "donnees", "temps_parcours.json"),
              encoding="utf-8") as f:
        planche = json.load(f)

    print("construction du réseau ...", flush=True)
    r = reseau.Reseau()
    n_sommets = r.G.number_of_nodes()
    n_aretes = r.G.number_of_edges()
    km_reseau = sum(d["L"] for _, _, d in r.G.edges(data=True)) / 1000
    print("  %d sommets, %d arêtes, %.0f km (%.0f s)"
          % (n_sommets, n_aretes, km_reseau, time.time() - t0))

    # ------------------------------------------------------------- topologie
    # Les sommets sont réindexés de 0 à n-1 : le navigateur travaille sur des
    # tableaux typés, pas sur des identifiants OSM à onze chiffres.
    cles = list(r.G.nodes)
    rang = {n: i for i, n in enumerate(cles)}
    lon, lat = [], []
    for n in cles:
        a, b = reseau.VERS_WGS.transform(*r.xy[n])
        lon.append(round(a, DEC))
        lat.append(round(b, DEC))

    u, v, L, cout, amenage = [], [], [], [], []
    traces = []
    retournees = 0
    for a, b, d in r.G.edges(data=True):
        u.append(rang[a])
        v.append(rang[b])
        # deux décimales : le plus court chemin ne doit pas dépendre d'un arrondi
        L.append(round(d["L"], 2))
        cout.append(round(d["cout"], 2))
        amenage.append(1 if d["amenage"] else 0)
        # La géométrie est orientée du premier sommet vers le second, une fois
        # pour toutes. Sans cela, la page devrait DEVINER le sens de chaque
        # tronçon pour les recoller, et un tronçon pris à l'envers dessine une
        # corde à travers le paysage. `networkx` rend les extrémités dans un
        # ordre qui n'est pas celui de la saisie : 31 % des géométries partent du
        # second sommet.
        pts = d["pts"]
        if math.dist(pts[0], r.xy[a]) > math.dist(pts[0], r.xy[b]):
            pts = pts[::-1]
            retournees += 1
        traces.append(en_wgs(pts, TOL_TRACE))
    print("  géométries réorientées : %d sur %d" % (retournees, len(traces)))

    print("écriture ...")
    ecrire("graphe.json", {"lon": lon, "lat": lat, "u": u, "v": v,
                           "L": L, "cout": cout, "amenage": amenage})
    ecrire("geometrie.json", traces)

    # ---------------------------------------------------------- destinations
    # Chaque destination garde le sommet auquel la planche l'a accrochée : le
    # calcul du navigateur porte donc exactement sur les mêmes points d'arrivée.
    manquantes = []
    destinations = []
    for d in planche["destinations"]:
        s = int(d["sommet"])
        if s not in rang:
            manquantes.append(d["nom_carte"])
            continue
        destinations.append({
            "nom": d["nom"], "carte": d["nom_carte"], "famille": d["famille"],
            "lat": d["lat"], "lon": d["lon"], "i": rang[s],
            # valeurs de la planche, conservées pour le contrôle affiché
            "km_planche": d["km"], "min_planche": d["minutes"],
            "part_amenagee_planche": d["part_amenagee"],
        })
    if manquantes:
        raise SystemExit("destinations absentes du graphe exporté : %s"
                         % ", ".join(manquantes))
    print("  %d destinations" % len(destinations))

    # ------------------------------------------------- aménagements cyclables
    # La couche publiée par la Métropole : elle qualifie le réseau et se dessine,
    # elle ne sert pas au calcul (voir l'en-tête de reseau.py).
    lignes, familles = reseau.amenagements()
    amenagements = {}
    km_par_type = {}
    for g, fam in zip(lignes, familles):
        amenagements.setdefault(fam, []).append(en_wgs(list(g.coords),
                                                       TOL_AMENAGEMENT))
        km_par_type[fam] = km_par_type.get(fam, 0.0) + g.length / 1000
    for fam in sorted(km_par_type):
        print("  %-16s %4d tronçons, %5.0f km"
              % (fam, len(amenagements[fam]), km_par_type[fam]))

    ecrire("reference.json", {"destinations": destinations,
                              "amenagements": amenagements})

    # ------------------------------------------------------------------ méta
    emprise = [min(lat), min(lon), max(lat), max(lon)]
    meta = {
        "consultation": "2026-FCS-SMAG-0138",
        "centre": planche["centre"],
        "vitesse_kmh": planche["vitesse_kmh"],
        "preference": reseau.PREFERENCE,
        "preference_defaut": reseau.DEFAUT,
        "bonus_amenage": reseau.BONUS_AMENAGE,
        "emprise": [round(x, DEC) for x in emprise],
        "graphe": {"sommets": n_sommets, "aretes": n_aretes,
                   "km": round(km_reseau)},
        "km_amenagements": {k: round(x) for k, x in km_par_type.items()},
        "km_amenagements_total": round(sum(km_par_type.values())),
        "controle_chronomap": planche["controle"],
        "tolerance_trace_m": TOL_TRACE,
    }
    # écart médian au contrôle publié, calculé ici plutôt qu'écrit en dur
    ecarts = sorted(abs(c["min_calcule"] - c["min_publie"])
                    for c in planche["controle"])
    if ecarts:
        meta["controle_ecart_median_min"] = round(ecarts[len(ecarts) // 2], 1)
        meta["controle_liaisons"] = len(ecarts)
    ecrire("meta.json", meta)

    print("terminé en %.0f s." % (time.time() - t0))


if __name__ == "__main__":
    main()
