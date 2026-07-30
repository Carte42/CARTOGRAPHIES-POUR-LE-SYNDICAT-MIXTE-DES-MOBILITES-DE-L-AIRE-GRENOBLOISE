# -*- coding: utf-8 -*-
"""Contrôle : la page doit rendre les chiffres de la planche jointe à l'offre.

Le risque de cette démonstration n'est pas qu'elle tombe en panne, c'est qu'elle
mente : si le jury lit 12 minutes à l'écran là où la planche imprimée dit 10, la
pièce se retourne contre l'offre. Ce script vérifie donc, au départ de la
planche, que les 48 destinations ressortent aux mêmes valeurs, et il relève au
passage le temps de recalcul et les captures d'écran.

    npm run dev          (dans une autre fenêtre)
    python scripts/02_controle.py

La tolérance est celle de l'écriture du fichier de référence : `temps_parcours.py`
arrondit les durées au dixième de minute et les distances au centième de
kilomètre, donc un écart d'une demi-unité est du bruit d'arrondi, pas un
désaccord.
"""
import os
import sys

from playwright.sync_api import sync_playwright

URL = os.environ.get("DEMO_URL", "http://localhost:5176/")
ICI = os.path.dirname(os.path.abspath(__file__))
CAPTURES = os.path.join(ICI, "_captures")

TOL_MIN = 0.05      # demi-unité d'arrondi de la référence
TOL_KM = 0.005
# Les tronçons se suivent bout à bout : au raccord, il ne doit rester que
# l'arrondi des coordonnées exportées (5 décimales, soit environ 1 m).
TOL_RACCORD_M = 2.0


def main():
    os.makedirs(CAPTURES, exist_ok=True)
    with sync_playwright() as p:
        n = p.chromium.launch()
        page = n.new_page(viewport={"width": 1600, "height": 1000})
        erreurs = []
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.goto(URL, wait_until="networkidle")
        page.wait_for_selector(".panneau h1", timeout=60000)
        page.wait_for_function("() => window.__controle", timeout=60000)
        c = page.evaluate("() => window.__controle")

        page.wait_for_function("() => window.__raccords", timeout=60000)
        raccords = page.evaluate("() => window.__raccords")

        print("destinations comparées : %d" % c["n"])
        print("écart maximal          : %.3f min, %.4f km" % (c["ecartMin"], c["ecartKm"]))
        print("recalcul complet       : %d ms" % c["ms"])
        print("pire raccord de tracé  : %.2f m (%s)"
              % (raccords["m"], raccords["ou"] or "—"))

        page.wait_for_timeout(2500)
        page.screenshot(path=os.path.join(CAPTURES, "carte.png"))
        page.get_by_role("button", name="Spidermap").click()
        page.wait_for_timeout(1200)
        page.screenshot(path=os.path.join(CAPTURES, "spidermap.png"))

        # le départ doit vraiment changer le résultat, sinon la démonstration
        # ne démontre rien
        page.get_by_role("button", name="Carte", exact=True).click()
        page.wait_for_timeout(600)
        avant = page.inner_text(".chiffres")
        page.mouse.click(1150, 780)
        page.wait_for_timeout(1200)
        apres = page.inner_text(".chiffres")
        page.screenshot(path=os.path.join(CAPTURES, "depart-deplace.png"))
        n.close()

    ennuis = []
    if c["n"] < 48:
        ennuis.append("seulement %d destinations atteintes" % c["n"])
    if c["ecartMin"] > TOL_MIN or c["ecartKm"] > TOL_KM:
        ennuis.append("écart au-delà de l'arrondi de la référence")
    if raccords["m"] > TOL_RACCORD_M:
        ennuis.append("tracés discontinus : %.1f m au raccord (%s)"
                      % (raccords["m"], raccords["ou"]))
    if avant == apres:
        ennuis.append("déplacer le départ n'a rien changé aux chiffres")
    if erreurs:
        ennuis.append("erreurs de page : %s" % " | ".join(erreurs))

    if ennuis:
        print("\nCONTRÔLE EN DÉFAUT :")
        for e in ennuis:
            print(" -", e)
        sys.exit(1)
    print("\ncontrôle passé. Captures dans scripts/_captures/.")


if __name__ == "__main__":
    main()
