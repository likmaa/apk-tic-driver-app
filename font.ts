// driver-app/font.ts
// Mapping des familles de polices utilisées dans l'app chauffeur.
// Les noms doivent correspondre exactement à ceux chargés dans app/_layout.tsx via useFonts.

export const Fonts = {
  unbounded: 'Unbounded-Regular',
  unboundedBold: 'Unbounded-Bold',

  titilliumWeb: 'Titillium-Regular',
  // Pas de "Titillium-Bold" dédiée, on réutilise la SemiBold comme bold
  titilliumWebBold: 'Titillium-SemiBold',
  titilliumWebSemiBold: 'Titillium-SemiBold',
};

export default Fonts;
