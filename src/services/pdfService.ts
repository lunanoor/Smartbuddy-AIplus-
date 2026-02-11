import * as pdfjsLib from 'pdfjs-dist';

// Setting the worker source for pdfjs using the local module path
// In Vite, this usually works better than CDN links which might be blocked or mismatch
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

export interface SlideContent {
    title: string;
    points: string[];
}

export const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        // Use the getDocument specifically for the modern ESM build
        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            useSystemFonts: true,
            stopAtErrors: false
        });

        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            // Join text items, making sure to handle potential undefined or different item structures
            const strings = content.items.map((item: any) => item.str || '');
            fullText += strings.join(' ') + '\n\n';
        }

        if (!fullText.trim()) {
            throw new Error('No text content found in PDF.');
        }

        return fullText;
    } catch (error) {
        console.error('Detailed PDF Extraction Error:', error);
        throw error;
    }
};

export const processTextIntoSlides = (text: string): SlideContent[] => {
    // Split by double newlines or single newlines with significant length
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 30);

    if (paragraphs.length === 0) {
        return [{ title: "Document Content", points: [text.slice(0, 500) + "..."] }];
    }

    return paragraphs.slice(0, 10).map((p, index) => {
        const cleanParagraph = p.trim();
        const sentences = cleanParagraph.split(/[.!?]\s+/).filter(s => s.length > 5);

        return {
            title: sentences[0].length < 60 ? sentences[0] : `Smart Insight ${index + 1}`,
            points: sentences.slice(sentences[0].length < 60 ? 1 : 0, 5).map(s => s.trim())
        };
    });
};
