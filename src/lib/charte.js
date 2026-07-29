// Couleurs relevées dans « Itinéraires cyclables du territoire grenoblois »
// publié par le SMMAG (annexes/extraire_charte.py). Les planches de l'offre
// emploient les mêmes.
export const JAUNE = '#FFF200'
export const JAUNE_CLAIR = '#FFF78F'
export const AMBRE = '#FFCC31'
export const BLEU_M = '#2D2C73'
export const BLEU = '#0C9DD9'
export const BLEU_CLAIR = '#5BC3F0'
export const BLEU_EAU = '#8FD4F1'
export const VERT = '#65B745'
export const VERT_FONCE = '#00663A'
export const VERT_CLAIR = '#AECC36'
export const VIOLET = '#662C83'
export const ROSE = '#E7067E'
export const ORANGE = '#EA4824'
export const NOIR = '#231F20'
export const GRIS = '#939598'
export const GRIS_FONCE = '#5F6163'
export const GRIS_CLAIR = '#D7D8DA'
export const BLANC = '#FFFFFF'

// L'ordre compte : les corridors sont lettrés dans le sens des azimuts, deux
// couleurs voisines dans la liste se retrouvent donc côte à côte à l'écran.
export const PALETTE = [ORANGE, BLEU, VERT_FONCE, ROSE, BLEU_CLAIR, VIOLET,
                        VERT, BLEU_M]
export const LETTRES = 'ABCDEFGH'

// Les cinq types de la couche cyclable de la Métropole, dans l'ordre de lecture
// de la légende des planches.
export const AMENAGEMENTS = [
  { cle: 'chronovelo', nom: 'Chronovélo', couleur: ROSE, epaisseur: 3.2 },
  { cle: 'voieverte', nom: 'Voie verte', couleur: VERT_FONCE, epaisseur: 2.6 },
  { cle: 'veloamenage', nom: 'Aménagement cyclable', couleur: BLEU, epaisseur: 2.2 },
  { cle: 'velononamenage', nom: 'Itinéraire sans aménagement', couleur: BLEU_CLAIR, epaisseur: 1.6 },
  { cle: 'velodifficile', nom: 'Section difficile', couleur: ORANGE, epaisseur: 1.6 },
]

export const FAMILLES = {
  commune: 'commune',
  gare: 'gare',
  campus: 'pôle universitaire',
  sante: 'pôle de santé',
  commerce: 'pôle commercial',
  loisir: 'site de loisir et de visite',
}
