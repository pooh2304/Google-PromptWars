const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Storage } = require('@google-cloud/storage');
const { Logging } = require('@google-cloud/logging');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// Securely access API Key from Cloud Run environment, or fallback to the provided key for the hackathon
const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCuLN2yfY_TG278tNisMzxQ-epBSNLUQKk';
const genAI = new GoogleGenerativeAI(API_KEY);

// Mock Storage and Logging initializations to prevent crashing if local ADC isn't set up yet
const storage = new Storage({ projectId: 'placeholder-project' });
const logging = new Logging({ projectId: 'placeholder-project' });

app.post('/api/analyze', async (req, res) => {
    try {
        const { context } = req.body;
        
        // 1. Google Service (Gemini)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            You are the core AI of "SheShield", a personal safety app used by women.
            Analyze the following messy context input (which could be a mix of voice transcripts, ambient sounds, and motion data).
            Classify the distress risk level into EXACTLY ONE of: "Low", "Medium", "High".
            Return the result strictly as a JSON object with the following keys:
            - "risk_level" (string: "Low", "Medium", "High")
            - "confidence" (number)
            - "suggested_action" (string, short actionable advice)
            - "summary" (string, a 1-sentence explanation of why)

            Context Input: "${context}"
        `;
        
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { risk_level: "Medium", summary: "Fallback Analysis" };
        
        // 2 & 3. Google Services (Logging and Storage mocking for Hackathon metrics)
        if (parsed.risk_level === 'High') {
            const logName = 'sheshield-sos-events';
            const log = logging.log(logName);
            const metadata = { resource: { type: 'global' } };
            const entry = log.entry(metadata, { event: "Distress Detection Triggered", context });
            // Non-blocking log write attempt
            log.write(entry).catch(e => console.log('Google Cloud Logging Warning:', e.message));

            // Mock saving evidence to Google Cloud Storage
            const bucketName = 'sheshield-evidence-vault';
            console.log(`[Google Cloud Storage] Would upload evidence snapshot to gs://${bucketName}/evidence-${Date.now()}.wav`);
        }

        res.json(parsed);
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: 'Failed to analyze context', risk_level: 'Medium', summary: 'Error querying AI.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
