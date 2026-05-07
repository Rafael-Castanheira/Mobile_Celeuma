import assert from 'assert';
import { resolveNavigationMode, buildNavigationPayload } from '../navigationHandlers.js';

function runTests() {
    console.log("Running navigationHandlers tests...");

    // Test resolveNavigationMode
    assert.strictEqual(resolveNavigationMode({ tipo: 'texto' }), null);
    assert.strictEqual(resolveNavigationMode({ tipo: 'navegacao', navigation_mode: 'invalid' }), null);
    assert.strictEqual(resolveNavigationMode({ tipo: 'navegacao', navigation_mode: 'point' }), 'point');
    assert.strictEqual(resolveNavigationMode({ tipo: 'navegacao', navigation_mode: 'file' }), 'file');
    assert.strictEqual(resolveNavigationMode({ tipo: 'navegacao', navigation_mode: 'back' }), 'back');

    // Test buildNavigationPayload
    let payload = buildNavigationPayload({ tipo: 'navegacao', navigation_mode: 'point', id_ponto_destino: 42 });
    assert.deepEqual(payload, { mode: 'point', pointId: 42 });

    payload = buildNavigationPayload({ 
        tipo: 'navegacao', 
        navigation_mode: 'file', 
        navigation_file_url: 'http://example.com/a.jpg',
        navigation_file_path: 'a.jpg' 
    });
    assert.deepEqual(payload, { mode: 'file', fileUrl: 'http://example.com/a.jpg', filePath: 'a.jpg' });

    payload = buildNavigationPayload({ tipo: 'navegacao', navigation_mode: 'back' });
    assert.deepEqual(payload, { mode: 'back' });

    payload = buildNavigationPayload({ tipo: 'texto' });
    assert.deepEqual(payload, { mode: null });

    console.log("All navigationHandlers tests passed!");
}

runTests();
