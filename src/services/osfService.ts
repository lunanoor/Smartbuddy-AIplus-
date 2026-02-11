const OSF_API_BASE = 'https://api.test.osf.io/v2';

export interface OSFResource {
    id: string;
    title: string;
    description: string;
    type: string;
    author: string;
    date: string;
    url: string;
}

export const searchOSFResources = async (query: string): Promise<OSFResource[]> => {
    if (!query) return [];

    try {
        const response = await fetch(`${OSF_API_BASE}/nodes/?filter[title]=${encodeURIComponent(query)}`);
        const json = await response.json();

        if (!json.data) return [];

        return json.data.map((item: any) => ({
            id: item.id,
            title: item.attributes.title,
            description: item.attributes.description || 'No description available.',
            type: item.attributes.category,
            author: 'OSF Contributor', // Simplified for MVP
            date: new Date(item.attributes.date_created).toLocaleDateString(),
            url: item.links.html
        }));
    } catch (error) {
        console.error('OSF Search Error:', error);
        return [];
    }
};
