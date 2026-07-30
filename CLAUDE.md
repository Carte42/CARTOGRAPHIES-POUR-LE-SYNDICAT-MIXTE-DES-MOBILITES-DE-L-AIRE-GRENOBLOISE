# Temps de parcours à vélo — démonstrateur SMMAG

Démonstrateur en ligne accompagnant la réponse Carte 42 à la consultation
**2026-FCS-SMAG-0138**, « Cartographies pour le Syndicat mixte des mobilités de
l'aire grenobloise » (remise le 7 septembre 2026). Il est appelé depuis le
mémoire technique par un encart (`DEMO_URL` dans
`../../SMMAG - Cartographie/memoire/contenu_v2.py`).

Publié sur la branche `gh-pages` du dépôt
`Carte42/CARTOGRAPHIES-POUR-LE-SYNDICAT-MIXTE-DES-MOBILITES-DE-L-AIRE-GRENOBLOISE`.

## Ce que la démonstration doit prouver

Le CCTP ne demande aucune carte web : les livrables sont des documents imprimés
et leurs fichiers sources. La page est donc un différenciateur pur, et son seul
critère est de rendre crédible la thèse notée du mémoire, celle des « processus
de production et chaînes de traitement des données SIG » : **une planche est une
vue d'une base, pas un dessin**.

D'où le parti pris, et le geste unique : **le point de départ n'est plus figé**.
La planche `cart_3_2` jointe à l'offre fige la gare de Grenoble ; ici on déplace
le point noir et les 48 destinations, les 8 corridors et le diagramme en étoile
se recomposent, sur le même graphe et avec les mêmes coûts. Le recalcul complet
prend **13 à 42 ms** selon la charge de la machine, relevé par le contrôle.

Ni calculateur d'itinéraire personnel, ni sélecteur de trajet : le SMMAG n'achète
pas une application grand public.

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5176  (ou double-clic sur « Lancer l'app.bat »)
npm run build
npm run deploy     # build + gh-pages
```

## Chaîne de données

```bash
python scripts/01_donnees_web.py    # ~30 s
python scripts/02_controle.py       # avec npm run dev dans une autre fenêtre
```

`01` **importe les modules qui composent les annexes de l'offre**
(`annexes/reseau.py`, `annexes/temps_parcours.py` du projet SMMAG, chemin
surchargeable par `SMMAG_ANNEXES`) : rien n'est recopié à la main, c'est ce qui
garantit que la planche et la page disent le même chiffre. Il écrit dans
`public/data/` :

| Fichier | Contenu | Poids gzippé |
|---|---|---|
| `graphe.json` | 53 831 sommets, 67 582 arêtes, longueur et coût | 0,80 Mo |
| `geometrie.json` | tracé des arêtes, simplifié à 3 m | 1,05 Mo |
| `reference.json` | 48 destinations, 1 202 tronçons cyclables qualifiés | 0,04 Mo |
| `meta.json` | vitesse, emprise, coefficients, contrôle Chrono-map | — |

**Chaque tracé est orienté du premier vers le second sommet de son arête**, à
l'écriture. `networkx` rend les extrémités d'une arête dans un ordre qui n'est
pas celui de la saisie : **31 % des géométries partaient du second sommet**. Sans
cette orientation, la page doit deviner le sens de chaque tronçon pour les
recoller, et un tronçon pris à l'envers dessine une corde à travers le paysage.
C'est l'origine du défaut signalé le 30/07/2026 (« les itinéraires passent sur
des rivières ») : la couture comparait une extrémité en [lat, lon] à une autre en
[lon, lat], donc lat contre lon, ce qui rendait le choix du sens arbitraire. Sur
le seul itinéraire de Le Gua, **251 raccords sur 288 étaient disjoints**, jusqu'à
1 159 m, et le tracé mesurait 32,8 km pour 23,4 km calculés. Ne jamais revenir à
un choix de sens par comparaison de distances : le sens se déduit du parcours de
l'arbre (`orienter()` dans `src/lib/graphe.js`).

**La simplification à 3 m ne touche que le trait.** Les longueurs et les durées
sont lues sur `graphe.json`, où aucune coordonnée n'est simplifiée : un
Douglas-Peucker sur la géométrie perd jusqu'à 91 m sur une arête sinueuse, ce qui
serait faux s'il servait au calcul et se voit sur aucun écran quand il ne sert
qu'à dessiner.

Extension `.json` et non `.geojson` : GitHub Pages ne compresse que les types
MIME qu'il reconnaît.

## Le calcul, porté du Python

- `src/lib/graphe.js` — listes d'adjacence compressées, Dijkstra à tas binaire
  sur le **coût de préférence** (pas la longueur : le coût dit quel itinéraire un
  cycliste choisit, la durée se lit ensuite sur la longueur réelle du chemin
  retenu), accrochage du départ par balayage direct des 54 000 sommets.
- `src/lib/corridors.js` — port de `temps_parcours.py:construire_arbre` et de la
  classe `Arbre` de `spidermap.py` : arbre réduit aux points remarquables,
  ouverture des corridors à la fourche qui sépare le plus de destinations dans
  les directions les plus opposées, lettrage A–H dans le sens des azimuts,
  écartement angulaire borné à 9°.

**Les azimuts sont calculés en équirectangulaire local**, pas en Lambert 93 comme
côté Python : l'écart reste sous le demi-degré sur trente kilomètres et l'angle
ne sert qu'à orienter une branche. Les durées, elles, ne dépendent pas de la
projection.

## Contrôle, à ne pas retirer

`scripts/02_controle.py` vérifie qu'au départ de la planche la page retrouve ses
48 destinations **aux arrondis d'écriture près** (0,05 min et 5 m, soit la
demi-unité d'arrondi de `temps_parcours.json`), que **le pire raccord entre deux
tronçons reste sous 2 m** (il est à 0,00 m ; c'est le garde-fou du défaut
ci-dessus, qu'aucun autre contrôle n'attrapait), que déplacer le départ change
réellement les chiffres, et qu'aucune erreur de page n'est levée.

**Ce qui n'est pas un défaut, et qu'il ne faut pas « corriger » :** des tronçons
réellement rectilignes sur un kilomètre ou plus. Vérifié sur l'orthophoto : la
digue rive gauche de l'Isère, les sentiers de Chartreuse (`highway=path` de 35 à
153 nœuds, segments jusqu'à 530 m) et la véloroute longeant la voie ferrée vers
Vif. Contrôle indépendant des franchissements d'eau : sur les 48 itinéraires,
**22 croisements de rivière ou canal, dont 15 exactement sur un pont OSM**, et les
deux cas les plus écartés vérifiés à la main (un canal busé sous la voirie
d'Échirolles, un ruisseau franchi par un ouvrage non renseigné dans OSM près de
Vif). Retirer les 49 tronçons droits de plus de 200 m du graphe ne changerait les
durées que de 0,00 min en médiane et 0,06 min au p90 : le jeu n'en vaut pas la
chandelle, et cela toucherait aussi les planches. Le risque de
cette pièce n'est pas la panne, c'est le désaccord : un jury qui lit 12 minutes à
l'écran et 10 sur la planche jointe n'y verra pas une nuance de méthode.

## Points d'attention

- **Les polices de la charte ne sont pas embarquées.** Leurs sous-ensembles
  proviennent des PDF publiés par le SMMAG ; ils servent aux planches, en local,
  et n'ont pas à être republiés. Les couleurs, elles, sont bien celles de la
  charte (`src/lib/charte.js`, relevées par `annexes/extraire_charte.py`).
- **Le réseau cyclable de la Métropole se dessine, il ne calcule pas.** 516 km
  d'aménagements seulement : un plus court chemin calculé dessus rallonge les
  trajets de moitié. Le routage est sur le viaire OSM, la couche cyclable
  qualifie les tronçons et pèse sur le coût (`BONUS_AMENAGE`).
- **`base: './'`** dans `vite.config.js` : le dépôt a un nom très long, les
  chemins relatifs évitent d'avoir à le répéter dans la configuration.
- **Rendu canvas** (`preferCanvas: true`) : les branches et les 1 202 tronçons
  cyclables en SVG rament au zoom.
- Le fond IGN vient de la **Géoplateforme, sans clé**. Les fonds sont atténués
  par filtre CSS, comme sur le SDE 35 et sur Crozon, pour que le réseau reste
  lisible sur le plan comme sur l'ortho sans changer de couleur.
- **`window.__controle`** et **`window.__carte`** ne sont exposés qu'en dev.

## Honnêteté de la démonstration

Le bandeau « Données et méthode » énonce les sources, la vitesse retenue, le
contrôle contre la Chrono-map SMMAG 2021, et dit que **la page n'est pas un
livrable du marché**. Ne pas le retirer : la valeur de la pièce tient à ce
qu'elle montre une méthode, pas à ce qu'elle passe pour un produit fini.
