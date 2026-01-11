const axios = require("axios");
const FormData = require("form-data");

/**
 * OCR API endpoint using Azure Computer Vision
 * POST /api/ocr
 * 
 * Accepts multipart form data with image file
 * Returns extracted text from the image
 */
module.exports = async function (context, req) {
    context.log('OCR request received');

    // Only allow POST
    if (req.method !== 'POST') {
        context.res = {
            status: 405,
            body: { error: 'Method not allowed' }
        };
        return;
    }

    // Get Azure Vision credentials from environment (loaded from Key Vault)
    const visionEndpoint = process.env.AZURE_VISION_ENDPOINT;
    const visionKey = process.env.AZURE_VISION_KEY;

    if (!visionEndpoint || !visionKey) {
        context.log.error('Azure Vision credentials not configured');
        context.res = {
            status: 500,
            body: { error: 'OCR service not configured' }
        };
        return;
    }

    try {
        // Handle both base64 and raw buffer
        let imageBuffer;
        let contentType = 'application/octet-stream';

        if (req.body.imageBase64) {
            // Base64 encoded image
            const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
            
            // Extract content type if provided
            const match = req.body.imageBase64.match(/^data:(image\/\w+);base64,/);
            if (match) {
                contentType = match[1];
            }
        } else if (Buffer.isBuffer(req.body)) {
            // Raw buffer
            imageBuffer = req.body;
        } else {
            context.res = {
                status: 400,
                body: { error: 'No image data provided. Send imageBase64 in JSON body.' }
            };
            return;
        }

        // Call Azure Computer Vision Read API (OCR 3.2+)
        const readUrl = `${visionEndpoint}/vision/v3.2/read/analyze`;
        
        // Step 1: Submit image for analysis
        const submitResponse = await axios.post(readUrl, imageBuffer, {
            headers: {
                'Ocp-Apim-Subscription-Key': visionKey,
                'Content-Type': contentType
            }
        });

        // Get operation location from headers
        const operationLocation = submitResponse.headers['operation-location'];
        
        if (!operationLocation) {
            throw new Error('No operation location returned from Vision API');
        }

        // Step 2: Poll for results (with timeout)
        let result = null;
        const maxAttempts = 10;
        const pollInterval = 1000; // 1 second

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            const resultResponse = await axios.get(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': visionKey
                }
            });

            const status = resultResponse.data.status;
            
            if (status === 'succeeded') {
                result = resultResponse.data.analyzeResult;
                break;
            } else if (status === 'failed') {
                throw new Error('OCR analysis failed');
            }
            // Continue polling if 'running' or 'notStarted'
        }

        if (!result) {
            throw new Error('OCR timed out');
        }

        // Extract text from results
        const lines = [];
        
        if (result.readResults) {
            for (const page of result.readResults) {
                for (const line of page.lines || []) {
                    lines.push({
                        text: line.text,
                        confidence: line.words ? 
                            line.words.reduce((sum, w) => sum + (w.confidence || 0), 0) / line.words.length :
                            null,
                        boundingBox: line.boundingBox
                    });
                }
            }
        }

        const fullText = lines.map(l => l.text).join('\n');

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                success: true,
                text: fullText,
                lines: lines,
                pageCount: result.readResults?.length || 0
            }
        };

    } catch (error) {
        context.log.error('OCR error:', error);
        
        // Handle specific Azure errors
        if (error.response?.status === 401) {
            context.res = {
                status: 500,
                body: { error: 'OCR authentication failed' }
            };
        } else if (error.response?.status === 400) {
            context.res = {
                status: 400,
                body: { 
                    error: 'Invalid image format',
                    details: error.response?.data?.error?.message 
                }
            };
        } else {
            context.res = {
                status: 500,
                body: { 
                    error: 'OCR processing failed',
                    details: error.message 
                }
            };
        }
    }
};
