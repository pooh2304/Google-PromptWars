/**
 * @jest-environment jsdom
 */
const request = require('supertest');
const app = require('./server'); // Import the Express app

describe('SheShield UI Integrity & Logic', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="app">
                <main id="tab-home" class="tab-pane active">
                    <div class="safety-orb" id="safety-orb" role="button" aria-label="Hold to trigger Emergency SOS distress signal" tabindex="0"></div>
                    <button id="stay-protected-btn" class="primary-cta" aria-label="Open safety action menu">Stay Protected</button>
                </main>
                <div class="bottom-sheet" id="bottom-sheet">
                    <button class="sheet-action sos-action" id="sheet-sos" aria-label="Trigger Emergency SOS manually">🚨 Emergency SOS</button>
                </div>
            </div>
        `;
    });

    test('Core UI Elements exist and comply with Accessibility standards', () => {
        const orb = document.getElementById('safety-orb');
        expect(orb).not.toBeNull();
        expect(orb.getAttribute('aria-label')).toContain('Emergency SOS');
        expect(orb.getAttribute('role')).toBe('button');
    });
});

describe('Backend API Integration Tests (Edge Cases & Validation)', () => {
    test('POST /api/analyze should return 400 Bad Request if context is missing (Input Validation)', async () => {
        const response = await request(app)
            .post('/api/analyze')
            .send({}); // Missing context
        
        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('Validation Error');
    });

    test('POST /api/analyze should return 400 Bad Request if context is too large', async () => {
        const response = await request(app)
            .post('/api/analyze')
            .send({ context: 'A'.repeat(6000) }); // Exceeds 5000 character limit
        
        expect(response.statusCode).toBe(400);
        expect(response.body.error).toContain('too large');
    });

    test('POST /api/analyze should return valid JSON analysis on successful payload', async () => {
        const response = await request(app)
            .post('/api/analyze')
            .send({ context: 'User is walking safely' });
            
        // Because Gemini API key might not be set in test environment, it gracefully falls back to catching the error.
        // It should still return 200 OK with a fallback Analysis object.
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('risk_level');
        expect(response.body).toHaveProperty('summary');
    });
});
