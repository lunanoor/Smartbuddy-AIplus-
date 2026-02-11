import pptxgen from "pptxgenjs";
import type { SlideContent } from "./pdfService";

export const generatePptx = async (slides: SlideContent[], fileName: string) => {
    const pres = new pptxgen();

    slides.forEach((slideData) => {
        const slide = pres.addSlide();

        // Background
        slide.background = { color: "0F172A" }; // Matches --bg-dark

        // Title
        slide.addText(slideData.title, {
            x: 0.5,
            y: 0.5,
            w: "90%",
            fontSize: 24,
            bold: true,
            color: "60A5FA", // Matches primary-ish
            fontFace: "Arial",
        });

        // Content
        const bulletPoints = slideData.points.map(p => ({ text: p, options: { bullet: true, color: "F8FAFC" } }));

        slide.addText(bulletPoints as any, {
            x: 0.5,
            y: 1.5,
            w: "90%",
            h: "70%",
            fontSize: 14,
            color: "F8FAFC",
            valign: "top",
        });
    });

    await pres.writeFile({ fileName: `${fileName.replace(/\.[^/.]+$/, "")}_presentation.pptx` });
};
