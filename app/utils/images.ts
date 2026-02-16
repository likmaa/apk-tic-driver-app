import { API_URL } from '../../config';

/**
 * Convertit un chemin de fichier relatif (stocké par Laravel) en URL API accessible.
 * 
 * Utilise la route /api/storage/{path} pour servir les fichiers via l'API Laravel,
 * ce qui évite les problèmes de configuration Nginx/Apache.
 * 
 * Exemples :
 * - "profiles/abc.jpg"      → "https://api.ticmiton.com/api/storage/profiles/abc.jpg"
 * - "storage/profiles/abc.jpg" → "https://api.ticmiton.com/api/storage/profiles/abc.jpg"
 * - "https://..."            → retourné tel quel
 * - "file://..."             → retourné tel quel (URI locale)
 * - null                     → null
 */
export const getImageUrl = (path: string | null): string | null => {
    if (!path) return null;

    // URL complète ou URI locale — pas besoin de transformer
    if (path.startsWith('http') || path.startsWith('file://')) {
        return path;
    }

    // Chemin relatif Laravel — construire l'URL via l'API
    // Nettoyer : retirer les préfixes "/storage/" ou "storage/" s'ils existent
    const cleanedPath = path.replace(/^\/?(storage\/)?/, '');

    // Utilise la route API /api/storage/{path} au lieu du chemin statique /storage/
    const url = `${API_URL}/storage/${cleanedPath}`;

    return url;
};
