import { API_URL } from '../config';

export const getImageUrl = (path: string | null) => {
    if (!path) return null;
    let url = path;

    if (!path.startsWith('http') && !path.startsWith('file://')) {
        const cleanedPath = path.replace(/^\/?storage\//, '');
        const baseUrl = API_URL ? API_URL.replace('/api', '') : '';
        url = `${baseUrl}/storage/${cleanedPath}`;
    }

    // Force HTTPS if the API_URL is secure
    if (API_URL?.startsWith('https:') && url.startsWith('http:')) {
        url = url.replace('http:', 'https:');
    }

    return url;
};
