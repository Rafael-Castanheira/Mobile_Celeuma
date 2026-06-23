const { getViewerScripts } = require('./src/features/viewer/html/viewerScripts.js');
const fs = require('fs');
fs.writeFileSync('test_output.js', getViewerScripts('http://localhost'));
try {
    require('./test_output.js');
    console.log("Syntax is OK!");
} catch (e) {
    console.error("Syntax Error:", e);
}
