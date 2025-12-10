// driver-app/font.ts
// Mapping des familles de polices utilisées dans l'app chauffeur.
// Les noms doivent correspondre exactement à ceux chargés dans app/_layout.tsx via useFonts.

export const Fonts = {
  unbounded: 'Unbounded_400Regular',
  unboundedBold: 'Unbounded_700Bold',

  titilliumWeb: 'TitilliumWeb_400Regular',
  titilliumWebBold: 'TitilliumWeb_600SemiBold', // Utilisation de SemiBold comme Bold pour l'harmonie
  titilliumWebSemiBold: 'TitilliumWeb_600SemiBold',
};

export default Fonts;
