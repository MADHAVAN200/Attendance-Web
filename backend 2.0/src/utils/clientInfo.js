
export const getEventSource = (req) => {
    const userAgent = req.get('User-Agent') || '';
    const customSource = req.get('X-Client-Source'); // Allow frontend to explicitly set it

    if (customSource) return customSource.toUpperCase();

    if (userAgent.includes('Postman')) return 'API_CLIENT';
    if (userAgent.includes('Dart') || userAgent.includes('Flutter')) return 'MOBILE_APP';
    if (userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari')) return 'WEB';

    return 'UNKNOWN';
};
