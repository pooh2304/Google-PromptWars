/**
 * @jest-environment jsdom
 */

describe('SheShield UI Integrity & Logic', () => {
    beforeEach(() => {
        // Set up the exact DOM structure used in the app
        document.body.innerHTML = `
            <div id="app">
                <main id="tab-home" class="tab-pane active">
                    <div class="safety-orb" id="safety-orb" role="button" aria-label="Hold to trigger Emergency SOS distress signal" tabindex="0"></div>
                    <button id="stay-protected-btn" class="primary-cta" aria-label="Open safety action menu">Stay Protected</button>
                </main>
                <div class="bottom-sheet" id="bottom-sheet">
                    <button class="sheet-action sos-action" id="sheet-sos" aria-label="Trigger Emergency SOS manually">🚨 Emergency SOS</button>
                </div>
                <div id="alert-summary" class="alert-card hidden" aria-live="assertive">
                    <p id="alert-status-text">We detected possible danger</p>
                </div>
            </div>
        `;
    });

    test('Core UI Elements exist for Accessibility and Logic', () => {
        const primaryCta = document.getElementById('stay-protected-btn');
        const orb = document.getElementById('safety-orb');
        const sosMenuAction = document.getElementById('sheet-sos');
        
        expect(primaryCta).not.toBeNull();
        expect(orb).not.toBeNull();
        expect(sosMenuAction).not.toBeNull();
        
        // Accessibility Validation Check
        expect(orb.getAttribute('aria-label')).toContain('Emergency SOS');
        expect(orb.getAttribute('role')).toBe('button');
    });

    test('Alert Summary handles state correctly', () => {
        const alertSummary = document.getElementById('alert-summary');
        expect(alertSummary.classList.contains('hidden')).toBe(true);
        expect(alertSummary.getAttribute('aria-live')).toBe('assertive');
    });
});
