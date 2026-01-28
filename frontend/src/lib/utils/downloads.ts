import { toDocx } from 'mdast2docx';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from "remark-gfm";
import type { Citation } from '$lib/stores/drafts';
import { listPlugin } from "@m2d/list";
import { tablePlugin } from '@m2d/table';
import { getUnifiedSettings } from '$lib/stores/settings';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { marked } from 'marked';

interface DraftData {
	id: string;
	projectTitle: string;
	manuscriptTitle?: string;
	paperType?: string;
	targetLength?: number;
	targetLanguage?: string;
	researchFocus?: string;
	citations?: Citation[];
	paperOutline?: Array<{title: string; bulletPoints: string[]; citationIndices: number[]}>;
	content?: string;
	createdAt: string;
	lastModified: string;
	modelName?: string;
	providerType?: string;
}

/**
 * Download draft content as markdown file
 */
export function downloadMarkdown(content: string, filename: string) {
	const blob = new Blob([content], { type: 'text/markdown' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${filename}.md`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Download draft content as DOCX file
 */
export async function downloadDocxFile(content: string, filename: string) {
	try {
		// Parse markdown to MDAST
		const mdast = unified().use(remarkParse).use(remarkGfm).parse(content);
		
		// Convert to DOCX
		const docxBlob = await toDocx(mdast, {
			styles: {
				default: {
					document: {
						run: {
							font: 'Arial',
						},
						paragraph: {
							spacing: {
								line: 480, // 200%
							}
						},
					},
					title: {
						run: {
							bold: true,
							size: 24, // 12pt
						}
					},
					heading1: {
						run: {
							bold: true,
							size: 22, // 11pt
						},
						paragraph: {
							spacing: {
								before: 240
							}
						}
					},
					heading2: {
						run: {
							italics: true,
							size: 22, // 10pt
						},
						paragraph: {
							spacing: {
								before: 240
							}
						}
					},
				}
			}
		}, {
			plugins: [listPlugin(), tablePlugin()]
		});
		
		// Download the file
		const url = URL.createObjectURL(docxBlob as Blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${filename}.docx`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	} catch (error) {
		console.error('Failed to convert to DOCX:', error);
		throw new Error('Failed to generate DOCX file');
	}
}

/**
 * Download draft content as PDF file using browser print to PDF
 */
export async function downloadPdfFilePrint(content: string, filename: string) {
	try {
		console.log('Starting PDF generation using browser print for:', filename);

		// Convert markdown to HTML
		const htmlContent = marked(content);
		console.log('HTML content length:', htmlContent.length);

		// Create a new window with the content
		const printWindow = window.open('', '_blank', 'width=800,height=600');
		if (!printWindow) {
			throw new Error('Unable to open print window. Please allow popups for this site.');
		}

		// Create styled HTML content
		const styledContent = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>${filename}</title>
				<style>
					body {
						font-family: "Microsoft YaHei", "SimSun", "Arial Unicode MS", "Noto Sans CJK", Arial, sans-serif;
						font-size: 12px;
						line-height: 1.5;
						margin: 20mm;
						color: black;
						background: white;
					}
					h1 { font-size: 18px; font-weight: bold; margin: 20px 0 10px 0; }
					h2 { font-size: 16px; font-weight: bold; margin: 18px 0 8px 0; }
					h3 { font-size: 14px; font-weight: bold; margin: 16px 0 6px 0; }
					p { margin: 8px 0; }
					ul, ol { margin: 8px 0; padding-left: 20px; }
					li { margin: 4px 0; }
					code {
						font-family: 'Courier New', monospace;
						background: #f5f5f5;
						padding: 2px 4px;
						border-radius: 3px;
					}
					pre {
						background: #f5f5f5;
						padding: 10px;
						border-radius: 3px;
						overflow-x: auto;
						font-family: 'Courier New', monospace;
						font-size: 11px;
					}
					@page {
						size: A4;
						margin: 20mm;
					}
					@media print {
						body { margin: 0; }
					}
				</style>
			</head>
			<body>
				${htmlContent}
			</body>
			</html>
		`;

		printWindow.document.write(styledContent);
		printWindow.document.close();

		// Wait for content to load
		await new Promise(resolve => {
			printWindow.onload = resolve;
			// Fallback timeout
			setTimeout(resolve, 1000);
		});

		// Trigger print dialog
		printWindow.print();

		// Close window after printing (user will save as PDF from print dialog)
		setTimeout(() => {
			printWindow.close();
		}, 1000);

		console.log('Print dialog opened for PDF generation');

	} catch (error) {
		console.error('Browser print PDF generation failed:', error);
		throw new Error(`Failed to generate PDF using browser print: ${error.message}`);
	}
}

/**
 * Download draft content as PDF file (fallback method using direct text rendering)
 */
export async function downloadPdfFileFallback(content: string, filename: string) {
	try {
		console.log('Starting PDF generation (fallback method) for:', filename);

		// Create PDF directly from text
		const pdf = new jsPDF('p', 'mm', 'a4');
		const pageWidth = 210;
		const pageHeight = 297;
		const margin = 20;
		const maxWidth = pageWidth - 2 * margin;
		const lineHeight = 6;
		let yPosition = margin;

		// Split content into lines
		const lines = content.split('\n');
		console.log('Total lines:', lines.length);

		for (const line of lines) {
			// Handle different markdown elements
			let processedLine = line;
			let fontSize = 12;
			let fontStyle = 'normal';

			// Handle headers
			if (line.startsWith('# ')) {
				processedLine = line.substring(2);
				fontSize = 16;
				fontStyle = 'bold';
			} else if (line.startsWith('## ')) {
				processedLine = line.substring(3);
				fontSize = 14;
				fontStyle = 'bold';
			} else if (line.startsWith('### ')) {
				processedLine = line.substring(4);
				fontSize = 12;
				fontStyle = 'bold';
			}

			// Remove markdown formatting
			processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
			processedLine = processedLine.replace(/\*(.*?)\*/g, '$1'); // Italic
			processedLine = processedLine.replace(/`(.*?)`/g, '$1'); // Code
			processedLine = processedLine.replace(/^\d+\.\s/, ''); // Numbered lists
			processedLine = processedLine.replace(/^-\s/, ''); // Bullet lists

			// Set font - use a font that supports Chinese
			pdf.setFontSize(fontSize);
			// Try to use a Unicode-compatible font
			try {
				pdf.setFont('helvetica', fontStyle);
			} catch (fontError) {
				console.warn('Font setting failed:', fontError);
				// Fallback to default font
			}

			// For Chinese text, ensure proper encoding
			let textToAdd = processedLine;
			// jsPDF handles UTF-8 automatically, but we can ensure proper encoding
			if (textToAdd) {
				// Split long lines properly for Chinese text
				const splitLines = pdf.splitTextToSize(textToAdd, maxWidth);

				for (const splitLine of splitLines) {
					// Check if we need a new page
					if (yPosition + lineHeight > pageHeight - margin) {
						pdf.addPage();
						yPosition = margin;
					}

					pdf.text(splitLine, margin, yPosition);
					yPosition += lineHeight;
				}
			}

			// Add extra space after headers
			if (fontStyle === 'bold' && fontSize > 12) {
				yPosition += lineHeight / 2;
			}
		}

		console.log('Saving PDF (fallback method)...');
		pdf.save(`${filename}.pdf`);
		console.log('PDF saved successfully (fallback method)');

	} catch (error) {
		console.error('Fallback PDF generation failed:', error);
		throw new Error(`Fallback PDF generation failed: ${error.message}`);
	}
}

/**
 * Download draft content as PDF file
 */
export async function downloadPdfFile(content: string, filename: string) {
	try {
		console.log('Starting PDF generation for:', filename);
		console.log('Content length:', content.length);
		console.log('Content preview:', content.substring(0, 200));

		// Always use fallback method for now (text-based PDF generation)
		// This handles Chinese characters better than canvas-based methods
		console.log('Using text-based PDF generation');
		await downloadPdfFileFallback(content, filename);

	} catch (error) {
		console.error('PDF generation failed:', error);
		console.error('Error details:', {
			name: error.name,
			message: error.message,
			stack: error.stack
		});
		throw new Error(`Failed to generate PDF file: ${error.message}`);
	}
}

/**
 * Download draft content as PDF file using canvas rendering
 */
async function downloadPdfFileCanvas(content: string, filename: string) {
	try {
		console.log('Starting PDF generation for:', filename);
		console.log('Content length:', content.length);

		// Convert markdown to HTML
		const htmlContent = marked(content);
		console.log('HTML content length:', htmlContent.length);

		// Create a temporary div to render HTML
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = htmlContent;
		tempDiv.style.width = '210mm'; // A4 width
		tempDiv.style.minHeight = '297mm'; // A4 height
		tempDiv.style.padding = '20mm';
		tempDiv.style.fontFamily = '"Microsoft YaHei", "SimSun", "Arial Unicode MS", "Noto Sans CJK", Arial, sans-serif';
		tempDiv.style.fontSize = '12px';
		tempDiv.style.lineHeight = '1.5';
		tempDiv.style.backgroundColor = 'white';
		tempDiv.style.color = 'black';
		tempDiv.style.position = 'absolute';
		tempDiv.style.left = '-9999px';
		tempDiv.style.top = '-9999px';
		tempDiv.style.boxSizing = 'border-box';
		tempDiv.style.wordWrap = 'break-word';
		tempDiv.style.overflowWrap = 'break-word';
		tempDiv.style.letterSpacing = '0.5px'; // Better spacing for Chinese characters

		document.body.appendChild(tempDiv);
		console.log('Temp div added to DOM');

		// Wait for DOM to render
		await new Promise(resolve => setTimeout(resolve, 100));

	// Use html2canvas to render the HTML to canvas
	console.log('Starting html2canvas...');
	let canvas: HTMLCanvasElement;
	try {
		canvas = await html2canvas(tempDiv, {
			scale: 2,
			useCORS: true,
			backgroundColor: '#ffffff',
			allowTaint: true,
			foreignObjectRendering: true,
			logging: false,
			letterRendering: true, // Better for text rendering
			width: tempDiv.scrollWidth,
			height: tempDiv.scrollHeight
		});
		console.log('html2canvas completed, canvas size:', canvas.width, 'x', canvas.height);
	} catch (canvasError) {
		console.error('html2canvas failed:', canvasError);
		throw new Error(`Canvas rendering failed: ${canvasError.message}`);
	}		// Create PDF
		console.log('Creating PDF...');
		let pdf: jsPDF;
		let imgData: string;
		try {
			pdf = new jsPDF({
				orientation: 'p',
				unit: 'mm',
				format: 'a4',
				putOnlyUsedFonts: true,
				compress: true
			});
			imgData = canvas.toDataURL('image/png');
			console.log('Image data URL length:', imgData.length);
		} catch (pdfInitError) {
			console.error('PDF initialization failed:', pdfInitError);
			throw new Error(`PDF initialization failed: ${pdfInitError.message}`);
		}

		const imgWidth = 210;
		const pageHeight = 295;
		const imgHeight = (canvas.height * imgWidth) / canvas.width;

		console.log('PDF dimensions - imgWidth:', imgWidth, 'imgHeight:', imgHeight, 'pageHeight:', pageHeight);

		// Calculate how many pages we need
		const totalPages = Math.ceil(imgHeight / pageHeight);
		console.log('Total pages needed:', totalPages);

		// Add pages
		try {
			for (let page = 0; page < totalPages; page++) {
				if (page > 0) {
					pdf.addPage();
				}

				// Calculate the Y position for this page (negative to move up)
				const yPosition = -page * pageHeight;

				console.log(`Adding page ${page + 1}, yPosition:`, yPosition);

				pdf.addImage(imgData, 'PNG', 0, yPosition, imgWidth, imgHeight);
			}
		} catch (pageError) {
			console.error('Page creation failed:', pageError);
			throw new Error(`PDF page creation failed: ${pageError.message}`);
		}

		// Download the PDF
		console.log('Saving PDF...');
		try {
			pdf.save(`${filename}.pdf`);
			console.log('PDF saved successfully');
		} catch (saveError) {
			console.error('PDF save failed:', saveError);
			throw new Error(`PDF save failed: ${saveError.message}`);
		}

		// Clean up
		document.body.removeChild(tempDiv);
		console.log('Cleanup completed');
	} catch (error) {
		console.error('Failed to convert to PDF:', error);
		console.error('Error details:', {
			name: error.name,
			message: error.message,
			stack: error.stack
		});
		throw new Error(`Failed to generate PDF file: ${error.message}`);
	}
}

export async function downloadProjectReport(draftData: DraftData) {
	const reportContent = generateTransparencyReportMarkdown(draftData);
	const filename = `${draftData.projectTitle.replace(/[^a-zA-Z0-9]/g, '_')}_transparency_report`;
	
	try {
		// Parse markdown to MDAST
		const mdast = unified().use(remarkParse).use(remarkGfm).parse(reportContent);
		
		// Convert to DOCX
		const docxBlob = await toDocx(mdast, {
			styles: {
				default: {
					document: {
						run: {
							font: 'Arial',
						},
						paragraph: {
							spacing: {
								line: 480, // 200%
							}
						},
					},
					title: {
						run: {
							bold: true,
							size: 24, // 12pt
						}
					},
					heading1: {
						run: {
							bold: true,
							size: 22, // 11pt
						},
						paragraph: {
							spacing: {
								before: 240
							}
						}
					},
					heading2: {
						run: {
							italics: true,
							size: 22, // 10pt
						},
						paragraph: {
							spacing: {
								before: 240
							}
						}
					},
				}
			}
		}, {
			plugins: [listPlugin(), tablePlugin()]
		});
		
		// Download the file
		const url = URL.createObjectURL(docxBlob as Blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${filename}.docx`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	} catch (error) {
		console.error('Failed to generate DOCX report:', error);
		throw new Error('Failed to generate transparency report');
	}
}

function generateTransparencyReportMarkdown(draftData: DraftData): string {
	const report: string[] = [];

	report.push('# AI-assisted Writing Transparency Report');
	report.push('');

	// Manuscript information table
	report.push(`**Manuscript Title:** ${draftData.manuscriptTitle}`);
	report.push('');
	report.push(`**Report Generated:** ${new Date().toUTCString()}`);
	report.push('');

	// Add AI model information table
	if (draftData.modelName || draftData.providerType) {
		report.push('## AI MODEL INFORMATION');
		report.push('');
		report.push('| Model Used | Provider |');
		report.push('|------------|----------|');
		report.push(`| ${draftData.modelName || 'N/A'} | ${draftData.providerType || 'N/A'} |`);
		report.push('');
	}

	report.push('');
	
	if (draftData.researchFocus) {
		report.push('## RESEARCH FOCUS');
		report.push('The following research focus was defined to generate the paper outline:');
		report.push('');
		report.push(draftData.researchFocus);
		report.push('');
	}
	
	if (draftData.paperOutline && draftData.paperOutline.length > 0) {
		report.push('## PAPER OUTLINE');
		
		draftData.paperOutline.forEach((section, index) => {
			report.push(`### ${index + 1}. ${section.title}`);
			section.bulletPoints.forEach((point) => {
				report.push(`- ${point}`);
			});
			report.push('');
		});
	}
	
	return report.join('\n');
}

/**
 * Load complete draft data from localStorage
 */
export function loadCompleteDraftData(draftId: string): DraftData | null {
	try {
		// Load main draft data
		const mainDrafts = JSON.parse(localStorage.getItem('paperwriter-drafts') || '[]');
		const mainDraft = mainDrafts.find((d: any) => d.id === draftId);
		
		if (!mainDraft) return null;

		const draftData: DraftData = {
			id: mainDraft.id,
			projectTitle: mainDraft.projectTitle,
			createdAt: mainDraft.createdAt,
			lastModified: mainDraft.lastModified
		};

		// Load format data
		const formatData = localStorage.getItem(`paperwriter-draft-${draftId}-format`);
		if (formatData) {
			const format = JSON.parse(formatData);
			draftData.paperType = format.paperType;
			draftData.targetLength = format.targetLength;
			draftData.targetLanguage = format.targetLanguage;
		}

		// Load outline data
		const outlineData = localStorage.getItem(`paperwriter-draft-${draftId}-outline`);
		if (outlineData) {
			const outline = JSON.parse(outlineData);
			draftData.manuscriptTitle = outline.title;
			draftData.paperOutline = outline.paperOutline;
		}

		// Load documents data
		const documentsData = localStorage.getItem(`paperwriter-draft-${draftId}-documents`);
		if (documentsData) {
			const documents = JSON.parse(documentsData);
			draftData.citations = documents.citations;
		}

		// Load focus data
		const focusData = localStorage.getItem(`paperwriter-draft-${draftId}-focus`);
		if (focusData) {
			const focus = JSON.parse(focusData);
			draftData.researchFocus = focus.researchFocus;
		}

		// Load writing data
		const writingData = localStorage.getItem(`paperwriter-draft-${draftId}-writing`);
		if (writingData) {
			const writing = JSON.parse(writingData);
			draftData.content = writing.content || writing.paperContent;
			
			// Load model information from writing data (the actual model used during writing)
			draftData.modelName = writing.modelName;
			draftData.providerType = writing.providerType;
		}

		return draftData;
	} catch (error) {
		console.error('Failed to load complete draft data:', error);
		return null;
	}
}