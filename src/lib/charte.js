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
//
// **Le réseau est monochrome ici, et c'est un choix.** Sur les planches, ces cinq
// types se distinguent par la couleur ; mais la palette des corridors sort de la
// même charte, et les deux couches ne coexistent sur aucun livrable : la planche
// de secteur porte le réseau, la spidermap porte les corridors. Superposées, un
// aménagement bleu et le corridor B bleu deviennent indiscernables à traits fins.
// La couleur est donc réservée aux corridors, qui sont le sujet de la page, et le
// réseau se lit par la graisse et par le motif du trait, sa hiérarchie propre
// restant intacte : Chronovélo, voie verte, aménagement, puis les deux familles
// sans aménagement propre, en tireté et en pointillé.
// Anthracite, entre le gris de texte de la charte et son noir. Mesuré : en gris
// moyen (#5F6163) à 80 % d'opacité, le réseau ne se détachait du Plan IGN que de
// 31 niveaux de gris sur 255, c'est-à-dire pas assez pour se voir. La lisibilité
// d'un décor tient au contraste de VALEUR, pas de teinte : sombre et opaque sous
// des corridors clairs et colorés, la séparation des deux couches est nette.
export const RESEAU = '#3D4043'

export const AMENAGEMENTS = [
  { cle: 'chronovelo', nom: 'Chronovélo', epaisseur: 3.4, tirets: null },
  { cle: 'voieverte', nom: 'Voie verte', epaisseur: 2.6, tirets: null },
  { cle: 'veloamenage', nom: 'Aménagement cyclable', epaisseur: 1.9, tirets: null },
  { cle: 'velononamenage', nom: 'Itinéraire sans aménagement', epaisseur: 1.9, tirets: '7 4' },
  { cle: 'velodifficile', nom: 'Section difficile', epaisseur: 1.9, tirets: '1.5 3.5' },
]

export const FAMILLES = {
  commune: 'commune',
  gare: 'gare',
  campus: 'pôle universitaire',
  sante: 'pôle de santé',
  commerce: 'pôle commercial',
  loisir: 'site de loisir et de visite',
}
