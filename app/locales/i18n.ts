import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './fr.json';

const resources = {
    fr: { translation: fr },
};

i18n
    .use(initReactI18next)
    .init({
        compatibilityJSON: 'v4',
        resources,
        lng: 'fr',
        fallbackLng: 'fr',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
